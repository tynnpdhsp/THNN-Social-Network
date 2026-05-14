import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const flyTo = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children, eventHandlers }) => (
    <div data-testid="marker" role="button" tabIndex={0} onClick={() => eventHandlers?.click?.()}>
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ flyTo, setView: vi.fn() }),
  useMapEvents: (handlers) => {
    globalThis.__mapEventHandlers = handlers;
    return null;
  },
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

vi.mock('leaflet', () => {
  const proto = {};
  Object.defineProperty(proto, '_getIconUrl', { configurable: true, value: vi.fn(), writable: true });
  const Def = function () {};
  Def.prototype = proto;
  Def.mergeOptions = vi.fn();
  return { __esModule: true, default: { Icon: { Default: Def } } };
});

vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: '' }));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: '' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: '' }));

const hoisted = vi.hoisted(() => ({
  getPlaceCategories: vi.fn(),
  getNearbyPlaces: vi.fn(),
  getPlaceReviews: vi.fn(),
  createPlaceReview: vi.fn(),
  togglePlaceBookmark: vi.fn(),
  checkPlaceBookmark: vi.fn(),
  uploadPlaceImages: vi.fn(),
  deletePlace: vi.fn(),
  createPlace: vi.fn(),
  getCurrentUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/services/placeService.js', () => ({
  getPlaceCategories: (...a) => hoisted.getPlaceCategories(...a),
  getNearbyPlaces: (...a) => hoisted.getNearbyPlaces(...a),
  getPlaceReviews: (...a) => hoisted.getPlaceReviews(...a),
  createPlaceReview: (...a) => hoisted.createPlaceReview(...a),
  togglePlaceBookmark: (...a) => hoisted.togglePlaceBookmark(...a),
  checkPlaceBookmark: (...a) => hoisted.checkPlaceBookmark(...a),
  uploadPlaceImages: (...a) => hoisted.uploadPlaceImages(...a),
  deletePlace: (...a) => hoisted.deletePlace(...a),
  createPlace: (...a) => hoisted.createPlace(...a),
  getCurrentUser: (...a) => hoisted.getCurrentUser(...a),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: (...a) => hoisted.toastError(...a),
    success: (...a) => hoisted.toastSuccess(...a),
  },
}));

import Map from '@/components/Map/Map.jsx';

const CATS = [
  { id: 'c1', name: 'Ăn uống' },
  { id: 'c2', name: 'Học tập' },
];

const PLACES = [
  {
    id: 'p1',
    name: 'Căn tin A',
    latitude: 10.77,
    longitude: 106.68,
    description: 'Gần cổng',
    address: '123 Đường X',
    category: { id: 'c1', name: 'Ăn uống' },
    avg_rating: 4,
    rating_count: 2,
    user_info: { id: 'owner-1' },
    images: [],
  },
  {
    id: 'p2',
    name: 'Thư viện',
    latitude: 10.76,
    longitude: 106.67,
    description: 'Yên tĩnh',
    address: 'Khu B',
    category: { id: 'c2', name: 'Học tập' },
    avg_rating: 5,
    rating_count: 1,
    user_info: { id: 'other' },
    images: [],
  },
];

function setupData() {
  hoisted.getPlaceCategories.mockResolvedValue(CATS);
  hoisted.getNearbyPlaces.mockResolvedValue({ data: PLACES });
  hoisted.getPlaceReviews.mockResolvedValue({ items: [] });
  hoisted.checkPlaceBookmark.mockResolvedValue({ is_bookmarked: false });
  hoisted.createPlaceReview.mockImplementation(async (_id, body) => ({ id: 'nr1', ...body, user_info: { full_name: 'Me' } }));
  hoisted.togglePlaceBookmark.mockResolvedValue({});
  hoisted.deletePlace.mockResolvedValue({});
  hoisted.createPlace.mockResolvedValue({ id: 'new-p' });
  hoisted.uploadPlaceImages.mockResolvedValue({});
}

describe('Map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(hoisted).forEach((fn) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
    });
    setupData();
    hoisted.getCurrentUser.mockReturnValue(null);
    flyTo.mockClear();
    globalThis.__mapEventHandlers = undefined;
  });

  it('mount_loads_categories_and_nearby_places', async () => {
    render(<Map />);
    await waitFor(() => {
      expect(hoisted.getPlaceCategories).toHaveBeenCalled();
      expect(hoisted.getNearbyPlaces).toHaveBeenCalledWith({
        lat: 10.761353,
        lng: 106.682205,
        radius: 50,
      });
    });
  });

  it('fetch_failure_shows_toast_error', async () => {
    hoisted.getPlaceCategories.mockRejectedValueOnce(new Error('net'));
    render(<Map />);
    await waitFor(() => expect(hoisted.toastError).toHaveBeenCalledWith('Không thể tải dữ liệu bản đồ'));
  });

  it('map_click_sets_clickedCoords_and_opens_add_modal', async () => {
    render(<Map />);
    await screen.findByText('Căn tin A');
    globalThis.__mapEventHandlers.click({ latlng: { lat: 10.9, lng: 106.5 } });
    expect(await screen.findByRole('heading', { name: /Thêm địa điểm mới/ })).toBeInTheDocument();
  });

  it('category_filter_hides_non_matching', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getByRole('button', { name: 'Học tập' }));
    expect(screen.getByText('Thư viện')).toBeInTheDocument();
    expect(screen.queryByText('Căn tin A')).not.toBeInTheDocument();
  });

  it('search_filters_by_name_only', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.type(screen.getByPlaceholderText(/Tìm địa điểm/), 'Thư');
    expect(screen.getByText('Thư viện')).toBeInTheDocument();
    expect(screen.queryByText('Căn tin A')).not.toBeInTheDocument();
  });

  it('search_by_address_substring_does_not_match_when_only_name_is_used', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.type(screen.getByPlaceholderText(/Tìm địa điểm/), 'Khu B');
    expect(screen.queryByText('Thư viện')).not.toBeInTheDocument();
  });

  it('marker_click_selects_place_fetches_reviews_and_bookmark', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    const markers = screen.getAllByTestId('marker');
    await user.click(markers[0]);
    await waitFor(() => {
      expect(hoisted.getPlaceReviews).toHaveBeenCalledWith('p1');
      expect(hoisted.checkPlaceBookmark).toHaveBeenCalledWith('p1');
    });
    expect(screen.getAllByText('Căn tin A').length).toBeGreaterThanOrEqual(1);
  });

  it('selectedLocation_triggers_flyTo', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getAllByTestId('marker')[0]);
    await waitFor(() =>
      expect(flyTo).toHaveBeenCalledWith([10.77, 106.68], 16, expect.objectContaining({ duration: 1.5 }))
    );
  });

  it('submit_review_calls_createPlaceReview_and_refetch_places', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getAllByTestId('marker')[0]);
    await screen.findByPlaceholderText(/Viết nhận xét/);
    hoisted.getNearbyPlaces.mockClear();
    await user.type(screen.getByPlaceholderText(/Viết nhận xét/), 'Tốt');
    const sendIcons = document.querySelectorAll('svg.lucide-send');
    fireEvent.click(sendIcons[sendIcons.length - 1]);
    await waitFor(() => {
      expect(hoisted.createPlaceReview).toHaveBeenCalledWith('p1', expect.objectContaining({ comment: 'Tốt', rating: 5 }));
      expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã đăng nhận xét');
      expect(hoisted.getNearbyPlaces.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('toggle_bookmark_calls_service_and_flips_ui', async () => {
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getAllByTestId('marker')[0]);
    const bm = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-bookmark'));
    await user.click(bm);
    await waitFor(() => expect(hoisted.togglePlaceBookmark).toHaveBeenCalledWith('p1'));
    expect(hoisted.toastSuccess).toHaveBeenCalled();
  });

  it('delete_button_only_when_admin_or_owner', async () => {
    hoisted.getCurrentUser.mockReturnValue({ id: 'owner-1', role: 'user' });
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getAllByTestId('marker')[0]);
    expect(screen.getByTitle('Xóa địa điểm')).toBeInTheDocument();
  });

  it('delete_hidden_for_non_owner_non_admin', async () => {
    hoisted.getCurrentUser.mockReturnValue({ id: 'x', role: 'user' });
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getAllByTestId('marker')[0]);
    expect(screen.queryByTitle('Xóa địa điểm')).not.toBeInTheDocument();
  });

  it('admin_sees_delete', async () => {
    hoisted.getCurrentUser.mockReturnValue({ id: 'adm', role: 'admin' });
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Thư viện');
    await user.click(screen.getAllByTestId('marker')[1]);
    expect(screen.getByTitle('Xóa địa điểm')).toBeInTheDocument();
  });

  it('execute_delete_calls_deletePlace_and_refetch', async () => {
    hoisted.getCurrentUser.mockReturnValue({ id: 'owner-1', role: 'user' });
    const user = userEvent.setup();
    render(<Map />);
    await screen.findByText('Căn tin A');
    await user.click(screen.getAllByTestId('marker')[0]);
    await user.click(screen.getByTitle('Xóa địa điểm'));
    await user.click(screen.getByRole('button', { name: 'Xóa ngay' }));
    await waitFor(() => {
      expect(hoisted.deletePlace).toHaveBeenCalledWith('p1');
      expect(hoisted.toastSuccess).toHaveBeenCalledWith('Đã xóa địa điểm');
    });
  });
});
