import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const hoisted = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getItems: vi.fn(),
  getCart: vi.fn(),
  addToCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeFromCart: vi.fn(),
  createOrder: vi.fn(),
  createVNPayUrl: vi.fn(),
  updateItem: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  uploadItemImages: vi.fn(),
}));

vi.mock('@/services/shopService.js', () => ({ ...hoisted }));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

import Shop from '@/components/Shop/Shop.jsx';

const SAMPLE_ITEMS = [
  { id: 'p-cheap', title: 'Cheap Supply', category_id: 'supplies', price: 10000, avg_rating: 3, rating_count: 0, images: [], description: 'd' },
  { id: 'p-doc', title: 'Alpha Doc', category_id: 'docs', price: 100000, avg_rating: 4, rating_count: 2, images: [], description: 'd' },
  { id: 'p-book', title: 'Beta Book', category_id: 'books', price: 800000, avg_rating: 5, rating_count: 1, images: [], description: 'd' },
];

function setupDefaultShopData() {
  hoisted.getCategories.mockResolvedValue([
    { id: 'docs', name: 'Tài liệu' },
    { id: 'books', name: 'Giáo trình' },
    { id: 'supplies', name: 'Vật dụng' },
  ]);
  hoisted.getItems.mockResolvedValue({ items: [...SAMPLE_ITEMS] });
  hoisted.getCart.mockResolvedValue({ items: [] });
}

function productTitlesInGrid() {
  return [...document.querySelectorAll('.shop-page-container .pin-card h3.body-strong')].map(
    (n) => n.textContent?.trim() || ''
  );
}

describe('Shop — filter & sort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
    });
    setupDefaultShopData();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mount_calls_getCategories_getItems_getCart', async () => {
    render(<Shop />);
    await waitFor(() => {
      expect(hoisted.getCategories).toHaveBeenCalled();
      expect(hoisted.getItems).toHaveBeenCalledWith({ limit: 100 });
      expect(hoisted.getCart).toHaveBeenCalled();
    });
  });

  it('activeCategory_all_shows_all_products', async () => {
    render(<Shop />);
    await waitFor(() => expect(screen.getByText('Alpha Doc')).toBeInTheDocument());
    expect(screen.getByText('Beta Book')).toBeInTheDocument();
    expect(screen.getByText('Cheap Supply')).toBeInTheDocument();
  });

  it('activeCategory_specific_filters_by_category_id', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    const sidebar = document.querySelector('.shop-sidebar');
    await user.click(within(sidebar).getByRole('button', { name: /Tài liệu/ }));
    await waitFor(() => {
      expect(screen.getByText('Alpha Doc')).toBeInTheDocument();
      expect(screen.queryByText('Beta Book')).not.toBeInTheDocument();
      expect(screen.queryByText('Cheap Supply')).not.toBeInTheDocument();
    });
  });

  it('searchQuery_matches_title_case_insensitive', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.type(screen.getByPlaceholderText(/Nhập từ khóa/), 'BETA');
    await waitFor(() => {
      expect(screen.getByText('Beta Book')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Doc')).not.toBeInTheDocument();
    });
  });

  it('maxPrice_onBlur_caps_to_2_000_000', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    const maxInput = screen.getByPlaceholderText('Đến (đ)');
    await user.clear(maxInput);
    await user.type(maxInput, '9.999.999');
    await user.tab();
    await waitFor(() => expect(maxInput).toHaveValue('2.000.000'));
  });

  it('price_filter_parses_dot_thousands_and_caps_max_for_comparison', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Beta Book');
    await user.click(screen.getByRole('button', { name: 'Dưới 500k' }));
    await waitFor(() => {
      expect(screen.getByText('Cheap Supply')).toBeInTheDocument();
      expect(screen.queryByText('Beta Book')).not.toBeInTheDocument();
    });
  });

  it('preset_500k_to_1tr_filters_range', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.click(screen.getByRole('button', { name: '500k - 1tr' }));
    await waitFor(() => {
      expect(screen.getByText('Beta Book')).toBeInTheDocument();
      expect(screen.queryByText('Cheap Supply')).not.toBeInTheDocument();
      expect(screen.queryByText('Alpha Doc')).not.toBeInTheDocument();
    });
  });

  it('preset_1tr_to_2tr_excludes_all_sample_products_under_1m', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.click(screen.getByRole('button', { name: '1tr - 2tr' }));
    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy vật phẩm nào phù hợp.')).toBeInTheDocument();
      expect(screen.queryByText('Beta Book')).not.toBeInTheDocument();
    });
  });

  it('clear_price_filters_resets_min_max', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.click(screen.getByRole('button', { name: 'Dưới 500k' }));
    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Từ (đ)')).toHaveValue('');
      expect(screen.getByPlaceholderText('Đến (đ)')).toHaveValue('');
      expect(screen.getByText('Beta Book')).toBeInTheDocument();
    });
  });

  it('sort_price_asc_orders_by_price', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.click(screen.getByRole('button', { name: /Mới nhất/ }));
    await user.click(screen.getByText('Giá tăng dần'));
    await waitFor(() => {
      const titles = productTitlesInGrid();
      expect(titles[0]).toContain('Cheap');
      expect(titles[1]).toContain('Alpha');
      expect(titles[2]).toContain('Beta');
    });
  });

  it('sort_price_desc_orders_by_price_desc', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.click(screen.getByRole('button', { name: /Mới nhất/ }));
    await user.click(screen.getByText('Giá giảm dần'));
    await waitFor(() => {
      const titles = productTitlesInGrid();
      expect(titles[0]).toContain('Beta');
      expect(titles[1]).toContain('Alpha');
      expect(titles[2]).toContain('Cheap');
    });
  });

  it('sort_rating_orders_by_avg_rating_desc', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.click(screen.getByRole('button', { name: /Mới nhất/ }));
    await user.click(screen.getByText('Đánh giá cao'));
    await waitFor(() => {
      const titles = productTitlesInGrid();
      expect(titles[0]).toContain('Beta');
      expect(titles[1]).toContain('Alpha');
      expect(titles[2]).toContain('Cheap');
    });
  });

  it('sort_popular_keeps_original_array_order', async () => {
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    const titles = productTitlesInGrid();
    expect(titles.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(['Cheap Supply', 'Alpha Doc', 'Beta Book']);
  });

  it('handleMinPriceChange_ignores_non_numeric_input_so_value_unchanged', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    const minInput = screen.getByPlaceholderText('Từ (đ)');
    await user.type(minInput, 'abc');
    expect(minInput).toHaveValue('');
  });

  it('combined_search_and_category_narrows_results', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    const sidebar = document.querySelector('.shop-sidebar');
    await user.click(within(sidebar).getByRole('button', { name: /Giáo trình/ }));
    await user.type(screen.getByPlaceholderText(/Nhập từ khóa/), 'book');
    await waitFor(() => {
      expect(screen.getByText('Beta Book')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Doc')).not.toBeInTheDocument();
    });
  });

  it('no_matches_shows_empty_state', async () => {
    const user = userEvent.setup();
    render(<Shop />);
    await screen.findByText('Alpha Doc');
    await user.type(screen.getByPlaceholderText(/Nhập từ khóa/), 'ZZZ_NOPE');
    await waitFor(() => expect(screen.getByText('Không tìm thấy vật phẩm nào phù hợp.')).toBeInTheDocument());
  });
});
