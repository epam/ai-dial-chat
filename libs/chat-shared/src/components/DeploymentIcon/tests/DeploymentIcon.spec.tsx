import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type DeploymentIconProps, DeploymentIcon } from '../DeploymentIcon';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * Stubs the global `Image` constructor used by `DeploymentIcon` to preload a
 * new `src` before displaying it. Resolves `onload` for any src not listed in
 * `failingSrcs`, and `onerror` otherwise — both asynchronously, mirroring a
 * real network fetch.
 */
const stubImagePreload = (failingSrcs: string[] = []) => {
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      const shouldFail = failingSrcs.includes(value);
      queueMicrotask(() => {
        if (shouldFail) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  vi.stubGlobal('Image', MockImage);
};

const renderIcon = (
  props: Omit<DeploymentIconProps, 'size' | 'initialsName'> &
    Partial<Pick<DeploymentIconProps, 'initialsName'>> = {},
) => render(<DeploymentIcon size={36} initialsName="" {...props} />);

describe('DeploymentIcon', () => {
  beforeEach(() => {
    stubImagePreload();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders InitialsAvatar with initialsName when src is absent', () => {
    renderIcon({ initialsName: 'My App' });
    expect(screen.getByText('MA')).toBeTruthy();
  });

  it('renders InitialsAvatar with "?" when initialsName is empty', () => {
    renderIcon({ initialsName: '' });
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders the image immediately on initial mount without preloading', () => {
    renderIcon({
      src: 'https://example.com/icon.png',
      initialsName: 'My App',
    });
    // The image has alt="" (decorative), so it has role "presentation" and
    // must be queried with { hidden: true }.
    const img = screen.getByRole('presentation', { hidden: true });
    expect(img.getAttribute('src')).toBe('https://example.com/icon.png');
  });

  it('renders custom fallback node when fallback prop is provided', () => {
    renderIcon({ fallback: <span>custom</span> });
    expect(screen.getByText('custom')).toBeTruthy();
  });

  it('shows the fallback avatar once the image fails to load', () => {
    renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });
    const img = screen.getByRole('presentation', { hidden: true });
    fireEvent.error(img);
    expect(screen.getByText('MA')).toBeTruthy();
  });

  it('keeps the previous image visible while the new src preloads', async () => {
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });

    rerender(
      <DeploymentIcon
        size={36}
        src="https://example.com/b.png"
        initialsName="Model B"
      />,
    );

    const img = screen.getByRole('presentation', { hidden: true });
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('shows the fallback avatar when src becomes absent after a previous src failed', () => {
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });
    fireEvent.error(screen.getByRole('presentation', { hidden: true }));

    rerender(<DeploymentIcon size={36} initialsName="Model A" />);

    expect(screen.getByText('MA')).toBeTruthy();
  });

  it('never shows fallback when switching between two working icons', async () => {
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });

    // No error event fired, so image should be present and fallback not rendered
    const img = screen.getByRole('presentation', { hidden: true });
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
    expect(screen.queryByText('MA')).toBeNull();

    rerender(
      <DeploymentIcon
        size={36}
        src="https://example.com/b.png"
        initialsName="Model B"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('presentation', { hidden: true }).getAttribute('src'),
      ).toBe('https://example.com/b.png'),
    );
    expect(screen.queryByText('MB')).toBeNull();
    expect(screen.queryByText('?')).toBeNull();
  });

  it('shows the new image once it finishes preloading, with no fallback frame', async () => {
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });

    rerender(
      <DeploymentIcon
        size={36}
        src="https://example.com/b.png"
        initialsName="Model B"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('presentation', { hidden: true }).getAttribute('src'),
      ).toBe('https://example.com/b.png'),
    );
    expect(screen.queryByText('MB')).toBeNull();
  });

  it('shows the new image immediately when src changes after a previous src failed', async () => {
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });
    fireEvent.error(screen.getByRole('presentation', { hidden: true }));
    expect(screen.getByText('MA')).toBeTruthy();

    rerender(
      <DeploymentIcon
        size={36}
        src="https://example.com/b.png"
        initialsName="Model B"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('presentation', { hidden: true }).getAttribute('src'),
      ).toBe('https://example.com/b.png'),
    );
    expect(screen.queryByText('MB')).toBeNull();
  });

  it('shows the fallback avatar when the new src also fails to preload', async () => {
    stubImagePreload(['https://example.com/b.png']);
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });

    rerender(
      <DeploymentIcon
        size={36}
        src="https://example.com/b.png"
        initialsName="Model B"
      />,
    );

    await screen.findByText('MB');
  });

  it('shows the fallback avatar when src becomes absent', () => {
    const { rerender } = renderIcon({
      src: 'https://example.com/a.png',
      initialsName: 'Model A',
    });

    rerender(<DeploymentIcon size={36} initialsName="Model A" />);

    expect(screen.getByText('MA')).toBeTruthy();
  });
});
