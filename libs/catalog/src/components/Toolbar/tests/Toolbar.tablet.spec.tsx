import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogViewMode } from '../../../types/view-mode';
import { Toolbar } from '../Toolbar';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsPhone: () => viewport.phone,
}));

const props = {
  viewMode: CatalogViewMode.Grid,
  onViewModeChange: vi.fn(),
  query: '',
  onQueryChange: vi.fn(),
  sortKey: 'name',
  sortOptions: [{ value: 'name', label: 'Name' }],
  onSortChange: vi.fn(),
  filters: new Set<string>(),
  onFiltersChange: vi.fn(),
  filterValues: new Set(['Business']),
};

describe('tablet browse menus', () => {
  it('returns focus to Browse settings with a nonempty search', async () => {
    viewport.phone = false;
    const { rerender } = render(<Toolbar {...props} query="existing" />);
    await userEvent.click(screen.getByRole('button', { name: 'Sort' }));
    act(() => screen.getByRole('menuitemradio', { name: 'Name' }).focus());
    viewport.phone = true;
    rerender(<Toolbar {...props} query="existing" />);
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Browse settings' })
          .matches(':focus'),
      ).toBe(true),
    );
  });

  it('offers anchored controls rather than a settings sheet', async () => {
    viewport.phone = false;
    render(<Toolbar {...props} />);
    expect(
      screen.queryByRole('button', { name: 'Browse settings' }),
    ).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sort' }));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('puts the view toggle and the sort button between the search and the filter', () => {
    viewport.phone = false;
    render(<Toolbar {...props} />);

    const search = screen.getByRole('search');
    const viewToggle = screen.getByRole('radiogroup', { name: 'View mode' });
    const sort = screen.getByRole('button', { name: 'Sort' });
    const filter = screen.getByRole('button', { name: 'From' });
    const follows = (first: Element, second: Element) =>
      Boolean(
        first.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      );

    expect(follows(search, viewToggle)).toBe(true);
    expect(follows(viewToggle, sort)).toBe(true);
    expect(follows(sort, filter)).toBe(true);
    expect(search.parentElement?.contains(viewToggle)).toBe(true);
  });

  it('names the sort button after the control rather than the applied order', () => {
    viewport.phone = false;
    render(<Toolbar {...props} />);

    expect(screen.getByRole('button', { name: 'Sort' }).textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Name' })).toBeNull();
  });

  it('keeps the same control order under RTL', () => {
    viewport.phone = false;
    document.documentElement.dir = 'rtl';
    try {
      render(<Toolbar {...props} />);

      const viewToggle = screen.getByRole('radiogroup', { name: 'View mode' });
      const sort = screen.getByRole('button', { name: 'Sort' });
      expect(
        viewToggle.compareDocumentPosition(sort) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        // eslint-disable-next-line testing-library/no-node-access -- CSS-level check of the glyph's classes
        sort.querySelector('svg')?.getAttribute('class') ?? '',
      ).not.toMatch(/scale-x|rotate/);
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('dismisses the phone sheet when desktop controls replace its trigger', async () => {
    viewport.phone = true;
    const { rerender } = render(<Toolbar {...props} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Browse settings' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Browse settings' }),
    ).toBeTruthy();
    viewport.phone = false;
    rerender(<Toolbar {...props} />);
    expect(
      screen.queryByRole('dialog', { name: 'Browse settings' }),
    ).toBeNull();
    expect(props.onFiltersChange).not.toHaveBeenCalled();
    viewport.phone = true;
    rerender(<Toolbar {...props} />);
    expect(
      screen
        .getByRole('button', { name: 'Browse settings' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });
});
