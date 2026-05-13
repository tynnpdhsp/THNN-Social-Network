import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeResponse } from '../_fakes/fetch.js';

vi.mock('@/config/api.js', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/config/api.js';
import {
  getDocuments,
  getDocumentCategories,
  uploadDocument,
  getDocumentById,
  getDocumentReviews,
  createDocumentReview,
  deleteDocument,
} from '@/services/documentService.js';

describe('documentService', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it('getDocuments_empty_object_yields_trailing_slash_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getDocuments({});
    expect(apiFetch).toHaveBeenCalledWith('/documents/');
  });

  it('getDocuments_no_arg_same_as_empty', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getDocuments();
    expect(apiFetch).toHaveBeenCalledWith('/documents/');
  });

  it('getDocuments_builds_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getDocuments({ limit: 5, skip: 10, sort: '-created', category_id: 'c1' });
    const q = new URLSearchParams({ limit: '5', skip: '10', sort: '-created', category_id: 'c1' }).toString();
    expect(apiFetch).toHaveBeenCalledWith(`/documents/?${q}`);
  });

  it('getDocumentCategories_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getDocumentCategories();
    expect(apiFetch).toHaveBeenCalledWith('/documents/categories');
  });

  it('getDocumentById_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await getDocumentById('doc-9');
    expect(apiFetch).toHaveBeenCalledWith('/documents/doc-9');
  });

  it('getDocumentReviews_no_params', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getDocumentReviews('d1');
    expect(apiFetch).toHaveBeenCalledWith('/documents/d1/reviews');
  });

  it('getDocumentReviews_with_params', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getDocumentReviews('d1', { limit: 2 });
    expect(apiFetch).toHaveBeenCalledWith('/documents/d1/reviews?limit=2');
  });

  it('uploadDocument_FormData_file_title_only', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: 'n' }));
    const file = new File(['x'], 'f.pdf', { type: 'application/pdf' });
    await uploadDocument({ file, title: 'T' });
    expect(apiFetch).toHaveBeenCalledWith(
      '/documents/',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const fd = apiFetch.mock.calls[0][1].body;
    expect(fd.get('file')).toBe(file);
    expect(fd.get('title')).toBe('T');
    expect(fd.has('description')).toBe(false);
    expect(fd.has('category_id')).toBe(false);
  });

  it('uploadDocument_appends_description_and_category_when_provided', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const file = new File(['x'], 'f.pdf');
    await uploadDocument({
      file,
      title: 'T2',
      description: 'D',
      category_id: 'cat1',
    });
    const fd = apiFetch.mock.calls[0][1].body;
    expect(fd.get('description')).toBe('D');
    expect(fd.get('category_id')).toBe('cat1');
  });

  it('uploadDocument_falsy_description_not_appended', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const file = new File(['x'], 'f.pdf');
    await uploadDocument({ file, title: 'T', description: '', category_id: null });
    const fd = apiFetch.mock.calls[0][1].body;
    expect(fd.has('description')).toBe(false);
    expect(fd.has('category_id')).toBe(false);
  });

  it('uploadDocument_error_detail_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { message: 'virus' } }));
    const file = new File(['x'], 'f.pdf');
    await expect(uploadDocument({ file, title: 't' })).rejects.toThrow('virus');
  });

  it('uploadDocument_error_fallback', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, {}));
    const file = new File(['x'], 'f.pdf');
    await expect(uploadDocument({ file, title: 't' })).rejects.toThrow('Failed to upload document');
  });

  it('createDocumentReview_POST', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: 'r' }));
    const data = { rating: 4 };
    await createDocumentReview('d2', data);
    expect(apiFetch).toHaveBeenCalledWith('/documents/d2/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('createDocumentReview_error_message', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(400, { detail: { message: 'spam' } }));
    await expect(createDocumentReview('1', {})).rejects.toThrow('spam');
  });

  it('deleteDocument_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await deleteDocument('d3');
    expect(apiFetch).toHaveBeenCalledWith('/documents/d3', { method: 'DELETE' });
  });

  it('getDocuments_not_ok_throws', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(500, {}));
    await expect(getDocuments()).rejects.toThrow('Failed to fetch documents');
  });

  it('propagates_rejection', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('x'));
    await expect(getDocumentById('1')).rejects.toThrow('x');
  });
});
