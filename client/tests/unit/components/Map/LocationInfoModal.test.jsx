import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import LocationInfoModal from '@/components/Map/LocationInfoModal.jsx';

const LOCATION = {
  id: 'l1',
  name: 'Hội trường A',
  category: { name: 'Sự kiện' },
  avg_rating: 4.25,
  rating_count: 7,
  description: 'Rộng rãi',
  address: 'Tầng 2',
  images: [{ image_url: 'https://cdn/img.jpg' }],
};

describe('LocationInfoModal', () => {
  const onClose = vi.fn();
  let origRaf;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
  });

  it('location_null_returns_null', () => {
    const { container } = render(
      <LocationInfoModal isOpen onClose={onClose} location={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders_name_category_rating_description_address', async () => {
    render(<LocationInfoModal isOpen onClose={onClose} location={LOCATION} />);
    expect(await screen.findByText('Hội trường A')).toBeInTheDocument();
    expect(screen.getByText('Sự kiện')).toBeInTheDocument();
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('7 nhận xét')).toBeInTheDocument();
    expect(screen.getByText('Rộng rãi')).toBeInTheDocument();
    expect(screen.getByText('Tầng 2')).toBeInTheDocument();
  });

  it('avg_rating_missing_shows_zero_point_zero', async () => {
    render(
      <LocationInfoModal
        isOpen
        onClose={onClose}
        location={{ ...LOCATION, avg_rating: undefined, rating_count: 0 }}
      />
    );
    expect(await screen.findByText('0.0')).toBeInTheDocument();
  });

  it('description_placeholder_when_empty', async () => {
    render(
      <LocationInfoModal isOpen onClose={onClose} location={{ ...LOCATION, description: '' }} />
    );
    expect(await screen.findByText(/Chưa có mô tả chi tiết/)).toBeInTheDocument();
  });

  it('address_placeholder_when_empty', async () => {
    render(
      <LocationInfoModal isOpen onClose={onClose} location={{ ...LOCATION, address: '' }} />
    );
    expect(await screen.findByText(/Chưa có địa chỉ cụ thể/)).toBeInTheDocument();
  });

  it('header_X_calls_onClose', async () => {
    const user = userEvent.setup();
    render(<LocationInfoModal isOpen onClose={onClose} location={LOCATION} />);
    await screen.findByText('Hội trường A');
    const xBtn = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-x'));
    await user.click(xBtn);
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 500 });
  });
});
