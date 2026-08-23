/* eslint-disable @typescript-eslint/no-empty-function */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavicon } from './useFavicon';

// Mock getIconPath
vi.mock('../../utils/icon-path', () => ({
  getIconPath: vi.fn(
    (url) => `/api/theme-icon?iconName=${encodeURIComponent(url || '')}`,
  ),
}));

describe('useFavicon', () => {
  let mockLink: HTMLLinkElement;
  let imageInstances: HTMLImageElement[] = [];

  beforeEach(() => {
    // Reset state
    imageInstances = [];
    document.head.innerHTML = '';

    // Mock link element
    mockLink = document.createElement('link');
    mockLink.rel = 'icon';
    mockLink.type = 'image/png';

    // Mock global Image constructor as a proper class
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: class MockImage {
        onload: ((this: HTMLImageElement, ev: Event) => void) | null = null;
        onerror: ((this: HTMLImageElement, ev: Event) => void) | null = null;
        src = '';

        constructor() {
          imageInstances.push(this as unknown as HTMLImageElement);
        }
      },
    });

    // Spy on console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle undefined URL gracefully', () => {
    renderHook(() => useFavicon(undefined));

    expect(console.error).toHaveBeenCalledWith(
      'No favicon URL provided, using default',
    );
    expect(imageInstances).toHaveLength(0);
  });

  it('should create link element if none exists', () => {
    const faviconUrl = 'https://example.com/favicon.png';

    renderHook(() => useFavicon(faviconUrl));

    /*
     * The favicon <link> lives in document.head, which Testing Library's
     * `screen` (bound to document.body) never reaches and which has no
     * accessible role for a semantic query — raw DOM access is the only way.
     */
    // eslint-disable-next-line testing-library/no-node-access
    const link = document.querySelector("link[rel~='icon']");
    expect(link).toBeTruthy();
    expect(link?.getAttribute('rel')).toBe('icon');
    expect(link?.getAttribute('type')).toBe('image/png');
  });

  it('should use existing link element if present', () => {
    // Pre-add a link element
    document.head.appendChild(mockLink);
    const faviconUrl = 'https://example.com/favicon.png';

    renderHook(() => useFavicon(faviconUrl));

    // Should still only have one link element
    // eslint-disable-next-line testing-library/no-node-access
    const links = document.querySelectorAll("link[rel~='icon']");
    expect(links.length).toBe(1);
  });

  it('should update link href on successful image load', () => {
    document.head.appendChild(mockLink);
    const faviconUrl = 'https://example.com/favicon.png';

    renderHook(() => useFavicon(faviconUrl));

    expect(imageInstances).toHaveLength(1);
    // Simulate successful image load
    imageInstances[0].onload?.call(imageInstances[0], new Event('load'));

    expect(mockLink.href).toContain('iconName=');
  });

  it('should handle image load error gracefully', () => {
    document.head.appendChild(mockLink);
    const faviconUrl = 'https://example.com/invalid-favicon.png';
    const originalHref = mockLink.href;

    renderHook(() => useFavicon(faviconUrl));

    expect(imageInstances).toHaveLength(1);
    // Simulate image load error
    imageInstances[0].onerror?.call(imageInstances[0], new Event('error'));

    // Link href should not change
    expect(mockLink.href).toBe(originalHref);
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load favicon from ${faviconUrl}`,
    );
  });

  it('should update favicon when URL changes', () => {
    document.head.appendChild(mockLink);
    const url1 = 'https://example.com/favicon1.png';
    const url2 = 'https://example.com/favicon2.png';

    const { rerender } = renderHook(({ url }) => useFavicon(url), {
      initialProps: { url: url1 },
    });

    expect(imageInstances).toHaveLength(1);
    // First load
    imageInstances[0].onload?.call(imageInstances[0], new Event('load'));
    expect(mockLink.href).toContain(encodeURIComponent(url1));

    // Change URL
    rerender({ url: url2 });
    expect(imageInstances).toHaveLength(2);
    imageInstances[1].onload?.call(imageInstances[1], new Event('load'));
    expect(mockLink.href).toContain(encodeURIComponent(url2));
  });

  it('should preload image before updating link', () => {
    document.head.appendChild(mockLink);
    const faviconUrl = 'https://example.com/favicon.png';
    const originalHref = mockLink.href;

    renderHook(() => useFavicon(faviconUrl));

    expect(imageInstances).toHaveLength(1);
    // Before onload is called, link should not be updated
    expect(mockLink.href).toBe(originalHref);

    // After onload is called, link should be updated
    imageInstances[0].onload?.call(imageInstances[0], new Event('load'));
    expect(mockLink.href).toContain('iconName=');
  });
});
