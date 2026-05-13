import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeResponse } from '../_fakes/fetch.js';

vi.mock('@/config/api.js', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/config/api.js';
import {
  getItems,
  getCategories,
  getCart,
  clearCart,
  uploadItemImages,
  createItem,
  updateItem,
  deleteItem,
  createOrder,
  createVNPayUrl,
  addToCart,
  updateCartItem,
  removeFromCart,
  createReview,
  getReviews,
} from '@/services/shopService.js';

describe('shopService', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it('getItems_empty_params_no_query_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { items: [] }));
    await getItems({});
    expect(apiFetch).toHaveBeenCalledWith('/shop/items');
  });

  it('getItems_undefined_params_no_query_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getItems();
    expect(apiFetch).toHaveBeenCalledWith('/shop/items');
  });

  it('getItems_builds_ordered_query_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await getItems({ limit: 10, skip: 0, sort: 'price' });
    const q = new URLSearchParams({ limit: '10', skip: '0', sort: 'price' }).toString();
    expect(apiFetch).toHaveBeenCalledWith(`/shop/items?${q}`);
  });

  it('getCategories_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getCategories();
    expect(apiFetch).toHaveBeenCalledWith('/shop/categories');
  });

  it('getCart_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await getCart();
    expect(apiFetch).toHaveBeenCalledWith('/shop/cart');
  });

  it('clearCart_DELETE_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await clearCart();
    expect(apiFetch).toHaveBeenCalledWith('/shop/cart', { method: 'DELETE' });
  });

  it('uploadItemImages_POST_FormData_multiple_files', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { urls: [] }));
    const f1 = new File(['a'], 'a.png', { type: 'image/png' });
    const f2 = new File(['b'], 'b.png', { type: 'image/png' });
    await uploadItemImages([f1, f2]);
    expect(apiFetch).toHaveBeenCalledWith(
      '/shop/items/upload-images',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const fd = apiFetch.mock.calls[0][1].body;
    const names = [...fd.getAll('files')].map((f) => f.name).sort();
    expect(names).toEqual(['a.png', 'b.png']);
  });

  it('uploadItemImages_error_detail_object_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeResponse(400, { detail: { message: 'too large' } }),
    );
    await expect(uploadItemImages([])).rejects.toThrow('too large');
  });

  it('uploadItemImages_error_detail_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: 'bad' }));
    await expect(uploadItemImages([])).rejects.toThrow('bad');
  });

  it('uploadItemImages_error_detail_array_first_msg', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: [{ msg: 'first' }, { msg: 'x' }] }));
    await expect(uploadItemImages([])).rejects.toThrow('first');
  });

  it('uploadItemImages_error_fallback_when_no_detail_shape', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, {}));
    await expect(uploadItemImages([])).rejects.toThrow('Failed to upload images');
  });

  it('createItem_POST_json', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: 1 }));
    const body = { name: 'N', price: 1 };
    await createItem(body);
    expect(apiFetch).toHaveBeenCalledWith('/shop/items', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  });

  it('createItem_error_detail_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: 'dup' }));
    await expect(createItem({})).rejects.toThrow('dup');
  });

  it('createItem_error_detail_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { message: 'm' } }));
    await expect(createItem({})).rejects.toThrow('m');
  });

  it('createItem_error_detail_array_msg', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: [{ msg: 'arr' }] }));
    await expect(createItem({})).rejects.toThrow('arr');
  });

  it('updateItem_PATCH', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await updateItem('5', { name: 'x' });
    expect(apiFetch).toHaveBeenCalledWith('/shop/items/5', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x' }),
    });
  });

  it('deleteItem_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await deleteItem('9');
    expect(apiFetch).toHaveBeenCalledWith('/shop/items/9', { method: 'DELETE' });
  });

  it('createOrder_error_detail_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { message: 'no stock' } }));
    await expect(createOrder({})).rejects.toThrow('no stock');
  });

  it('createOrder_error_fallback', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, {}));
    await expect(createOrder({})).rejects.toThrow('Failed to create order');
  });

  it('createVNPayUrl_error_detail_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { message: 'pay err' } }));
    await expect(createVNPayUrl({})).rejects.toThrow('pay err');
  });

  it('addToCart_POST_body_item_id_quantity_default', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await addToCart('i1');
    expect(apiFetch).toHaveBeenCalledWith('/shop/cart', {
      method: 'POST',
      body: JSON.stringify({ item_id: 'i1', quantity: 1 }),
    });
  });

  it('addToCart_explicit_quantity', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await addToCart('i1', 3);
    expect(apiFetch).toHaveBeenCalledWith('/shop/cart', {
      method: 'POST',
      body: JSON.stringify({ item_id: 'i1', quantity: 3 }),
    });
  });

  it('updateCartItem_PATCH', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await updateCartItem('i2', 4);
    expect(apiFetch).toHaveBeenCalledWith('/shop/cart/i2', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 4 }),
    });
  });

  it('removeFromCart_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await removeFromCart('i3');
    expect(apiFetch).toHaveBeenCalledWith('/shop/cart/i3', { method: 'DELETE' });
  });

  it('createReview_POST_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: 'r' }));
    const data = { rating: 5, text: 'ok' };
    await createReview('item-1', data);
    expect(apiFetch).toHaveBeenCalledWith('/shop/items/item-1/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('createReview_error_detail_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { message: 'bad review' } }));
    await expect(createReview('1', {})).rejects.toThrow('bad review');
  });

  it('getReviews_no_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getReviews('p1');
    expect(apiFetch).toHaveBeenCalledWith('/shop/items/p1/reviews');
  });

  it('getReviews_with_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getReviews('p1', { limit: 5 });
    expect(apiFetch).toHaveBeenCalledWith('/shop/items/p1/reviews?limit=5');
  });

  it('getItems_not_ok_throws', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(500, {}));
    await expect(getItems()).rejects.toThrow('Failed to fetch items');
  });

  it('propagates_apiFetch_rejection', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
    await expect(getCart()).rejects.toThrow('offline');
  });
});
