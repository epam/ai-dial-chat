import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATALOG_FOLDER_ROOTS } from '../../../constants/catalog-folders';
import type { CatalogItem } from '../../../models/catalog-item';
import type { ToolbarProps } from '../../../models/toolbar-props';
import {
  CatalogFolderRootKind,
  type CatalogFolderSelection,
} from '../../../types/catalog-folders';
import { CatalogViewMode } from '../../../types/view-mode';
import { buildCatalogFolderTree } from '../../../utils/catalog-folders';
import { Toolbar } from '../Toolbar';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsPhone: () => viewport.phone };
});

const makeItem = (id: string, folder: string[]): CatalogItem => ({
  id,
  type: CatalogEntityType.Agent,
  name: id,
  version: '1',
  lastUsed: '',
  description: '',
  folder,
  topics: [],
});

const folderTree = buildCatalogFolderTree(
  [makeItem('a', ['Organization', 'Design Assets'])],
  DEFAULT_CATALOG_FOLDER_ROOTS,
);

const DESIGN_ASSETS: CatalogFolderSelection = {
  root: CatalogFolderRootKind.Organization,
  path: ['Design Assets'],
};

const renderToolbar = (props: Partial<ToolbarProps> = {}) =>
  render(
    <Toolbar
      viewMode={CatalogViewMode.Grid}
      onViewModeChange={vi.fn()}
      query=""
      onQueryChange={vi.fn()}
      folderTree={folderTree}
      onFolderSelectionChange={vi.fn()}
      {...props}
    />,
  );

describe('Toolbar — folders', () => {
  beforeEach(() => {
    viewport.phone = false;
  });

  it('reads All entities with the count, followed by a Folders button', () => {
    renderToolbar({ totalCount: 512 });

    const heading = screen.getByRole('heading', { name: 'All entities' });
    expect(heading.parentElement?.textContent).toContain('512');
    expect(
      heading.compareDocumentPosition(
        screen.getByRole('button', { name: 'Folders' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('forwards the Folders control and tree colors from the toolbar styles', async () => {
    renderToolbar({
      styles: {
        foldersButton: { label: '#ff0000' },
        folderTree: { rowSelectedBackground: '#00ff00' },
      },
    });

    const button = screen.getByRole('button', { name: 'Folders' });
    expect(button.style.getPropertyValue('--cat-folders-btn-label')).toBe(
      '#ff0000',
    );
    await userEvent.click(button);
    const tree = await screen.findByRole('tree', { name: 'Folders' });
    expect(
      tree.style.getPropertyValue('--cat-folder-tree-row-selected-bg'),
    ).toBe('#00ff00');
  });

  it('shows the breadcrumb trail of a selected folder with the count after it', () => {
    renderToolbar({ folderSelection: DESIGN_ASSETS, totalCount: 24 });

    const trail = screen.getByRole('navigation', { name: 'Folder path' });
    expect(
      within(trail).getByRole('button', { name: 'All entities' }),
    ).toBeTruthy();
    expect(
      within(trail).getByRole('button', { name: 'Organization' }),
    ).toBeTruthy();
    const current = within(trail).getByText('Design Assets');
    // The kit puts aria-current on the segment's wrapper, which no query names.
    // eslint-disable-next-line testing-library/no-node-access
    expect(current.closest('[aria-current="page"]')).toBeTruthy();
    expect(trail.parentElement?.textContent).toContain('24');
    expect(screen.queryByRole('heading', { name: 'All entities' })).toBeNull();
  });

  it('navigates up from a breadcrumb segment', async () => {
    const onFolderSelectionChange = vi.fn();
    renderToolbar({ folderSelection: DESIGN_ASSETS, onFolderSelectionChange });

    await userEvent.click(screen.getByRole('button', { name: 'Organization' }));
    expect(onFolderSelectionChange).toHaveBeenCalledWith({
      root: CatalogFolderRootKind.Organization,
      path: [],
    });

    await userEvent.click(screen.getByRole('button', { name: 'All entities' }));
    expect(onFolderSelectionChange).toHaveBeenLastCalledWith({ path: [] });
  });

  it('keeps the Folders button after a host heading', () => {
    renderToolbar({ browseHeaderRenderer: <h2>Custom heading</h2> });

    expect(
      screen.getByRole('heading', { name: 'Custom heading' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Folders' })).toBeTruthy();
  });

  it('uses the host folder labels', () => {
    renderToolbar({
      title: 'Tous',
      folderSelection: DESIGN_ASSETS,
      folderLabels: { breadcrumb: 'Chemin', button: 'Dossiers' },
    });

    const trail = screen.getByRole('navigation', { name: 'Chemin' });
    expect(within(trail).getByRole('button', { name: 'Tous' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dossiers' })).toBeTruthy();
  });

  it('collapses the middle of a long trail on a phone', () => {
    viewport.phone = true;
    renderToolbar({
      folderSelection: {
        root: CatalogFolderRootKind.Organization,
        path: ['Clients', 'Design Assets'],
      },
    });

    const trail = screen.getByRole('navigation', { name: 'Folder path' });
    expect(within(trail).getByText('All entities')).toBeTruthy();
    expect(within(trail).getByText('Design Assets')).toBeTruthy();
    expect(
      within(trail).getByRole('button', { name: 'Show hidden path segments' }),
    ).toBeTruthy();
    expect(within(trail).queryByText('Organization')).toBeNull();
  });

  it('opens a Folders sheet from the round phone button', async () => {
    viewport.phone = true;
    renderToolbar();

    await userEvent.click(screen.getByRole('button', { name: 'Folders' }));

    const sheet = await screen.findByRole('dialog', { name: 'Folders' });
    expect(within(sheet).getByRole('tree', { name: 'Folders' })).toBeTruthy();
  });
});
