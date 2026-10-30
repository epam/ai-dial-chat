import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewVersionFallback from '../NewVersionFallback';

// react-i18next is globally mocked in test-setup.ts; t(key) returns the key string.

describe('NewVersionFallback', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a region named by the heading, not a live region', () => {
    render(<NewVersionFallback />);
    expect(
      screen.getByRole('region', { name: 'appUpdate.heading' }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the heading as the screen h1', () => {
    render(<NewVersionFallback />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'appUpdate.heading' }),
    ).toBeTruthy();
  });

  it('renders the message', () => {
    render(<NewVersionFallback />);
    expect(screen.getByText('appUpdate.message')).toBeTruthy();
  });

  it('renders the reload button focused on mount', () => {
    render(<NewVersionFallback />);
    const button = screen.getByRole('button', {
      name: 'errorBoundary.reloadLabel',
    });
    expect(button).toBeTruthy();
    expect(button.matches(':focus')).toBe(true);
  });

  it('reloads the page when the reload button is clicked', async () => {
    render(<NewVersionFallback />);
    await userEvent.click(
      screen.getByRole('button', { name: 'errorBoundary.reloadLabel' }),
    );
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
