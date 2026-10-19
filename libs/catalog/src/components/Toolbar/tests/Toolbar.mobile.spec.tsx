import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogViewMode } from '../../../types/view-mode';
import { Toolbar } from '../Toolbar';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: () => true };
});

const sortOptions = [
  { value: 'recent', label: 'Recently Updated' },
  { value: 'name', label: 'Name A-Z' },
];

const setupToolbar = (
  overrides: Partial<Parameters<typeof Toolbar>[0]> = {},
) => {
  const props = {
    viewMode: CatalogViewMode.Grid,
    onViewModeChange: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    sortKey: 'recent',
    sortOptions,
    onSortChange: vi.fn(),
    filters: new Set<string>(),
    onFiltersChange: vi.fn(),
    filterValues: new Set(['Business', 'Analysis']),
    isMyAppsActive: false,
    onMyAppsChange: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
};

const openSheet = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Browse settings' }),
  );
  return screen.findByRole('dialog', { name: 'Browse settings' });
};

describe('Toolbar — mobile', () => {
  it('replaces the view toggle, sort and filter dropdowns with one settings button', () => {
    setupToolbar();

    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Recently Updated' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'From' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Browse settings' }),
    ).toBeTruthy();
  });

  it('lists View, Sorting and Filtering on the root page', async () => {
    setupToolbar();

    const sheet = await openSheet();

    expect(
      within(sheet)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['View', 'Sorting', 'Filtering']);
  });

  it('applies a view mode on pick and closes the sheet', async () => {
    const props = setupToolbar();

    const sheet = await openSheet();
    await userEvent.click(
      within(sheet).getByRole('menuitem', { name: 'View' }),
    );
    await userEvent.click(
      within(sheet).getByRole('menuitemradio', { name: 'List' }),
    );

    expect(props.onViewModeChange).toHaveBeenCalledWith(CatalogViewMode.Cards);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks the applied sort order and applies a new one', async () => {
    const props = setupToolbar();

    const sheet = await openSheet();
    await userEvent.click(
      within(sheet).getByRole('menuitem', { name: 'Sorting' }),
    );

    expect(
      within(sheet)
        .getByRole('menuitemradio', { name: 'Recently Updated' })
        .getAttribute('aria-checked'),
    ).toBe('true');

    await userEvent.click(
      within(sheet).getByRole('menuitemradio', { name: 'Name A-Z' }),
    );
    expect(props.onSortChange).toHaveBeenCalledWith('name');
  });

  it('buffers filter changes until Apply', async () => {
    const props = setupToolbar();

    const sheet = await openSheet();
    await userEvent.click(
      within(sheet).getByRole('menuitem', { name: 'Filtering' }),
    );
    await userEvent.click(
      within(sheet).getByRole('menuitemcheckbox', { name: 'Business' }),
    );
    await userEvent.click(
      within(sheet).getByRole('menuitemcheckbox', { name: 'My' }),
    );

    expect(props.onFiltersChange).not.toHaveBeenCalled();

    await userEvent.click(within(sheet).getByRole('button', { name: 'Apply' }));

    expect(props.onFiltersChange).toHaveBeenCalledWith(new Set(['Business']));
    expect(props.onMyAppsChange).toHaveBeenCalledWith(true);
  });

  it('clears every filter', async () => {
    const props = setupToolbar({
      filters: new Set(['Business']),
      isMyAppsActive: true,
    });

    const sheet = await openSheet();
    await userEvent.click(
      within(sheet).getByRole('menuitem', { name: /Filtering/ }),
    );
    await userEvent.click(within(sheet).getByRole('button', { name: 'Clear' }));

    expect(props.onFiltersChange).toHaveBeenCalledWith(new Set());
    expect(props.onMyAppsChange).toHaveBeenCalledWith(false);
  });

  it('summarises the applied filters on the Filtering row', async () => {
    setupToolbar({
      filters: new Set(['Business', 'Analysis']),
      browseSettingsLabels: {
        formatFilterCount: (selected, total) => `${selected}/${total}`,
      },
    });

    const sheet = await openSheet();

    expect(
      within(sheet).getByRole('menuitem', { name: /Filtering/ }).textContent,
    ).toContain('2/3');
  });

  it('uses the host-supplied labels', async () => {
    setupToolbar({
      browseSettingsLabels: { title: 'Réglages', view: 'Affichage' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    const sheet = await screen.findByRole('dialog', { name: 'Réglages' });

    expect(
      within(sheet).getByRole('menuitem', { name: 'Affichage' }),
    ).toBeTruthy();
  });
});
