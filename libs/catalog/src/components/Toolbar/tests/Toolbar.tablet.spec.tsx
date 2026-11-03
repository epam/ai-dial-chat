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
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(screen.getByRole('menu')).toBeTruthy();
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
