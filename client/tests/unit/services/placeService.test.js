import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeResponse } from '../_fakes/fetch.js';

vi.mock('@/config/api.js', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/config/api.js';
import {
  getCurrentUser,
  getPlaceCategories,
  getNearbyPlaces,
  getPlaceById,
  getPlaceReviews,
  togglePlaceBookmark,
  checkPlaceBookmark,
  deletePlace,
  createPlace,
  createPlaceReview,
  uploadPlaceImages,
} from '@/services/placeService.js';

function jwtWithPayload(payloadObj) {
  const b64 = (s) => btoa(s).replace(/=+$/, '');
  const header = b64('{}');
  const payload = b64(JSON.stringify(payloadObj));
  return `${header}.${payload}.sig`;
}

describe('placeService', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  describe('getCurrentUser', () => {
    it('returns_null_when_no_token', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('returns_id_from_sub_and_default_role', () => {
      const t = jwtWithPayload({ sub: 'user-99' });
      localStorage.setItem('token', t);
      expect(getCurrentUser()).toEqual({ id: 'user-99', role: 'user' });
    });

    it('returns_role_from_payload', () => {
      const t = jwtWithPayload({ sub: 'a', role: 'admin' });
      localStorage.setItem('token', t);
      expect(getCurrentUser()).toEqual({ id: 'a', role: 'admin' });
    });

    it('falls_back_to_id_when_sub_missing', () => {
      const t = jwtWithPayload({ id: 'legacy-1' });
      localStorage.setItem('token', t);
      expect(getCurrentUser()).toEqual({ id: 'legacy-1', role: 'user' });
    });

    it('returns_null_when_atob_payload_invalid', () => {
      localStorage.setItem('token', 'a.b%%%invalid%%%');
      expect(getCurrentUser()).toBeNull();
    });

    it('returns_null_when_token_not_three_parts', () => {
      localStorage.setItem('token', 'onlytwo');
      expect(getCurrentUser()).toBeNull();
    });
  });

  it('getPlaceCategories_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getPlaceCategories();
    expect(apiFetch).toHaveBeenCalledWith('/place/categories');
  });

  it('getNearbyPlaces_default_lat_lng_radius_in_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getNearbyPlaces();
    expect(apiFetch).toHaveBeenCalledWith(
      '/place/?lat=10.762622&lng=106.660172&radius=10',
    );
  });

  it('getNearbyPlaces_explicit_empty_params_uses_place_slash', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getNearbyPlaces({});
    expect(apiFetch).toHaveBeenCalledWith('/place/');
  });

  it('getNearbyPlaces_custom_params', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getNearbyPlaces({ lat: 1, lng: 2, radius: 3 });
    expect(apiFetch).toHaveBeenCalledWith('/place/?lat=1&lng=2&radius=3');
  });

  it('getPlaceById_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await getPlaceById('p1');
    expect(apiFetch).toHaveBeenCalledWith('/place/p1');
  });

  it('getPlaceReviews_no_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getPlaceReviews('p2');
    expect(apiFetch).toHaveBeenCalledWith('/place/p2/reviews');
  });

  it('getPlaceReviews_with_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getPlaceReviews('p2', { page: 2 });
    expect(apiFetch).toHaveBeenCalledWith('/place/p2/reviews?page=2');
  });

  it('togglePlaceBookmark_POST', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await togglePlaceBookmark('p3');
    expect(apiFetch).toHaveBeenCalledWith('/place/p3/bookmark', { method: 'POST' });
  });

  it('checkPlaceBookmark_GET', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { bookmarked: true }));
    await checkPlaceBookmark('p4');
    expect(apiFetch).toHaveBeenCalledWith('/place/p4/bookmark');
  });

  it('deletePlace_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await deletePlace('p5');
    expect(apiFetch).toHaveBeenCalledWith('/place/p5', { method: 'DELETE' });
  });

  it('createPlace_POST_json', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: 'n' }));
    const data = { name: 'Cafe' };
    await createPlace(data);
    expect(apiFetch).toHaveBeenCalledWith('/place/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('createPlace_error_detail_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: 'taken' }));
    await expect(createPlace({})).rejects.toThrow('taken');
  });

  it('createPlaceReview_error_detail_string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: 'bad' }));
    await expect(createPlaceReview('1', {})).rejects.toThrow('bad');
  });

  it('createPlaceReview_POST_success', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { ok: 1 }));
    await createPlaceReview('pl', { stars: 5 });
    expect(apiFetch).toHaveBeenCalledWith('/place/pl/reviews', {
      method: 'POST',
      body: JSON.stringify({ stars: 5 }),
    });
  });

  it('uploadPlaceImages_FormData_files_field', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const f1 = new File(['1'], '1.jpg');
    const f2 = new File(['2'], '2.jpg');
    await uploadPlaceImages('pid', [f1, f2]);
    expect(apiFetch).toHaveBeenCalledWith(
      '/place/pid/images',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const fd = apiFetch.mock.calls[0][1].body;
    expect([...fd.getAll('files')]).toEqual([f1, f2]);
  });

  it('uploadPlaceImages_not_ok_throws', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(500, {}));
    await expect(uploadPlaceImages('p', [])).rejects.toThrow('Failed to upload images');
  });

  it('propagates_rejection', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('net'));
    await expect(getPlaceById('1')).rejects.toThrow('net');
  });
});
