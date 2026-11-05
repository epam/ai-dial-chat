import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgUnitFolderIcon } from '../OrgUnitFolderIcon';

/* Past the kit tooltip's 500ms hover-open delay. */
const TOOLTIP_OPEN_DELAY = 600;

/* jsdom has no IntersectionObserver, which the kit tooltip observes its trigger with. */
class IntersectionObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

describe('OrgUnitFolderIcon', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders an image named Organization unit by default', () => {
    render(<OrgUnitFolderIcon />);

    expect(screen.getByRole('img', { name: 'Organization unit' })).toBeTruthy();
  });

  it('shows the label in the kit tooltip on hover', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<OrgUnitFolderIcon />);

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .hover(screen.getByRole('img', { name: 'Organization unit' }));
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY);
    });

    expect(screen.getByRole('tooltip').textContent).toBe('Organization unit');
  });

  it('draws no native title tooltip', () => {
    render(<OrgUnitFolderIcon />);

    expect(screen.queryByTitle('Organization unit')).toBeNull();
  });

  it('uses the host label', () => {
    render(<OrgUnitFolderIcon label="Unité" />);

    expect(screen.getByRole('img', { name: 'Unité' })).toBeTruthy();
  });

  it('exposes a single image, keeping the glyph out of the accessibility tree', () => {
    render(<OrgUnitFolderIcon />);

    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('sets the icon color variable from colors', () => {
    render(<OrgUnitFolderIcon colors={{ icon: 'red' }} />);

    const icon = screen.getByRole('img', { name: 'Organization unit' });
    expect(icon.style.getPropertyValue('--oufi-icon')).toBe('red');
    expect(icon.className).toMatch(/icon/);
  });
});
