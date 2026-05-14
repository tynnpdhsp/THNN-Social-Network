import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AddLocationModal from '@/components/Map/AddLocationModal.jsx';

const CATEGORIES = [
  { id: 'cat-1', name: 'Ăn uống' },
  { id: 'cat-2', name: 'Học tập' },
];

describe('AddLocationModal', () => {
  const onClose = vi.fn();
  const onAdd = vi.fn();
  let origRaf;
  let origFetch;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    origFetch = globalThis.fetch;
    vi.clearAllMocks();
    onClose.mockClear();
    onAdd.mockClear();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    globalThis.fetch = origFetch;
  });

  it('isOpen_false_no_modal_title', () => {
    render(
      <AddLocationModal
        isOpen={false}
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={null}
      />
    );
    expect(screen.queryByRole('heading', { name: /Thêm địa điểm mới/ })).not.toBeInTheDocument();
  });

  it('nominatim_success_with_address_parts_builds_joined_address', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          display_name: 'Fallback full',
          address: {
            house_number: '12',
            road: 'Lê Lợi',
            city: 'TP.HCM',
          },
        }),
    });

    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 10.1, lng: 106.2 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('nominatim.openstreetmap.org/reverse'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('THNN') }),
        })
      );
    });
    await waitFor(() => {
      const v = screen.getByPlaceholderText(/Số nhà/).value;
      expect(v).toContain('12');
      expect(v).toContain('Lê Lợi');
      expect(v).toContain('TP.HCM');
    });
  });

  it('nominatim_no_address_uses_display_name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ display_name: 'Only display', address: {} }),
    });
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 1, lng: 2 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() => expect(screen.getByPlaceholderText(/Số nhà/)).toHaveValue('Only display'));
  });

  it('nominatim_rejects_then_photon_sets_address', async () => {
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.includes('nominatim')) return Promise.reject(new Error('nope'));
      if (u.includes('photon')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              features: [
                {
                  properties: {
                    housenumber: '5',
                    street: 'Trần Hưng Đạo',
                    city: 'Q5',
                  },
                },
              ],
            }),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 3, lng: 4 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() => {
      const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
      expect(urls.some((x) => x.includes('photon.komoot.io/reverse'))).toBe(true);
    });
    await waitFor(() => {
      const v = screen.getByPlaceholderText(/Số nhà/).value;
      expect(v).toContain('5');
      expect(v).toContain('Trần Hưng Đạo');
    });
  });

  it('both_geocode_fail_leaves_address_empty', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 9, lng: 9 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() => expect(screen.getByPlaceholderText(/Số nhà/)).toHaveValue(''));
  });

  it('categories_load_shows_default_category_label', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ display_name: 'X' }) });
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 1, lng: 1 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Ăn uống/ })).toBeInTheDocument()
    );
  });

  it('handleFileChange_sets_preview', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ display_name: 'X' }) });
    const user = userEvent.setup();
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 1, lng: 1 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    await user.upload(input, new File(['x'], 'p.png', { type: 'image/png' }));
    expect(document.querySelector('img[src^="blob:mock"]')).toBeTruthy();
  });

  it('removeFile_clears_preview', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ display_name: 'X' }) });
    const user = userEvent.setup();
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 1, lng: 1 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    await user.upload(input, new File(['x'], 'p.png', { type: 'image/png' }));
    expect(document.querySelector('img[src^="blob:"]')).toBeTruthy();
    const previewRemoveBtn = screen.getAllByRole('button').find((b) => {
      const svg = b.querySelector('svg.lucide-x');
      return svg && svg.getAttribute('width') === '12';
    });
    expect(previewRemoveBtn).toBeTruthy();
    await user.click(previewRemoveBtn);
    await waitFor(() => {
      expect(document.querySelector('img[src^="blob:"]')).toBeFalsy();
      expect(document.querySelector('svg.lucide-camera')).toBeTruthy();
    });
  });

  it('submit_without_name_does_not_call_onAdd', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ display_name: 'X' }) });
    const user = userEvent.setup();
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 1, lng: 1 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() => expect(screen.getByRole('button', { name: /Ăn uống/ })).toBeInTheDocument());
    await user.clear(screen.getByPlaceholderText(/Ví dụ: Thư viện/));
    await user.click(screen.getByRole('button', { name: /Chia sẻ địa điểm/ }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('submit_valid_calls_onAdd_with_files_and_onClose', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ display_name: 'Addr' }) });
    const user = userEvent.setup();
    render(
      <AddLocationModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        categories={CATEGORIES}
        initialCoords={{ lat: 10.5, lng: 106.6 }}
      />
    );
    await screen.findByRole('heading', { name: /Thêm địa điểm mới/ });
    await waitFor(() => expect(screen.getByPlaceholderText(/Số nhà/)).toHaveValue('Addr'));
    await user.type(screen.getByPlaceholderText(/Ví dụ: Thư viện/), 'Thư viện nhỏ');
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    const f = new File(['b'], 'x.png', { type: 'image/png' });
    await user.upload(input, f);
    await user.click(screen.getByRole('button', { name: /Chia sẻ địa điểm/ }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Thư viện nhỏ',
        category_id: 'cat-1',
        address: 'Addr',
        latitude: 10.5,
        longitude: 106.6,
        files: [f],
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
