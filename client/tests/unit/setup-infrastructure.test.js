import { describe, it, expect } from 'vitest';

describe('global test setup (tests/unit/setup.js)', () => {
  it('window_matchMedia_is_stubbed', () => {
    expect(window.matchMedia('(min-width: 1px)')).toBeTruthy();
    expect(typeof window.matchMedia('all').addEventListener).toBe('function');
  });

  it('IntersectionObserver_and_ResizeObserver_exist', () => {
    expect(typeof IntersectionObserver).toBe('function');
    expect(typeof ResizeObserver).toBe('function');
  });

  it('URL_createObjectURL_returns_mock_blob_url', () => {
    const u = URL.createObjectURL(new Blob(['x']));
    expect(u.startsWith('blob:mock-')).toBe(true);
  });

  it('navigator_clipboard_writeText_is_mocked', async () => {
    await expect(navigator.clipboard.writeText('x')).resolves.toBeUndefined();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('x');
  });

  it('window_scrollTo_is_mocked', () => {
    window.scrollTo(0, 100);
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('Element_scrollIntoView_is_mocked', () => {
    document.body.innerHTML = '<div id="x"></div>';
    const el = document.getElementById('x');
    el.scrollIntoView();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('localStorage_is_isolated_between_tests', () => {
    localStorage.setItem('__probe', '1');
    expect(localStorage.getItem('__probe')).toBe('1');
  });

  it('localStorage_empty_on_fresh_test_start', () => {
    expect(localStorage.getItem('__probe')).toBeNull();
  });
});
