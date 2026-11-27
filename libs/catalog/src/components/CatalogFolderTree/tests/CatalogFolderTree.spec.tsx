import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATALOG_FOLDER_ROOTS } from '../../../constants/catalog-folders';
import type { CatalogItem } from '../../../models/catalog-item';
import {
  CatalogFolderRootKind,
  type CatalogFolderSelection,
} from '../../../types/catalog-folders';
import { buildCatalogFolderTree } from '../../../utils/catalog-folders';
import { CatalogFolderTree } from '../CatalogFolderTree';

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

const tree = buildCatalogFolderTree(
  [
    makeItem('a', ['Organization', 'Design Assets', 'Icons']),
    makeItem('b', ['Organization', 'Clients']),
  ],
  DEFAULT_CATALOG_FOLDER_ROOTS,
);

const setupTree = (
  selection: CatalogFolderSelection = { path: [] },
  onSelect = vi.fn(),
) => {
  render(
    <CatalogFolderTree tree={tree} selection={selection} onSelect={onSelect} />,
  );
  return onSelect;
};

const item = (name: string) => screen.getByRole('treeitem', { name });

describe('CatalogFolderTree', () => {
  afterEach(() => {
    document.documentElement.dir = '';
  });

  it('renders a named tree with All entities at level 1 and the roots at level 2', () => {
    setupTree();
    expect(screen.getByRole('tree', { name: 'Folders' })).toBeTruthy();
    expect(item('All entities').getAttribute('aria-level')).toBe('1');
    expect(item('All entities').getAttribute('aria-expanded')).toBe('true');
    expect(item('Personal').getAttribute('aria-level')).toBe('2');
    expect(item('Organization').getAttribute('aria-expanded')).toBe('false');
    expect(item('Personal').getAttribute('aria-expanded')).toBeNull();
  });

  it('marks and focuses the selected row on mount', () => {
    setupTree();
    expect(item('All entities').getAttribute('aria-selected')).toBe('true');
    expect(item('All entities').matches(':focus')).toBe(true);
  });

  it('expands the ancestors of the selection and focuses it', () => {
    setupTree({
      root: CatalogFolderRootKind.Organization,
      path: ['Design Assets'],
    });
    expect(item('Organization').getAttribute('aria-expanded')).toBe('true');
    expect(item('Design Assets').getAttribute('aria-selected')).toBe('true');
    expect(item('Design Assets').matches(':focus')).toBe(true);
    expect(screen.queryByRole('treeitem', { name: 'Icons' })).toBeNull();
  });

  it('expands with ArrowRight, enters with ArrowDown and selects with Enter', async () => {
    const onSelect = setupTree({
      root: CatalogFolderRootKind.Organization,
      path: [],
    });
    expect(item('Organization').matches(':focus')).toBe(true);

    await userEvent.keyboard('{ArrowRight}');
    expect(item('Organization').getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{ArrowRight}');
    expect(item('Clients').matches(':focus')).toBe(true);
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith({
      root: CatalogFolderRootKind.Organization,
      path: ['Design Assets'],
    });
  });

  it('collapses with ArrowLeft, then moves to the parent', async () => {
    setupTree({
      root: CatalogFolderRootKind.Organization,
      path: ['Design Assets'],
    });
    await userEvent.keyboard('{ArrowLeft}');
    expect(item('Organization').matches(':focus')).toBe(true);
    await userEvent.keyboard('{ArrowLeft}');
    expect(item('Organization').getAttribute('aria-expanded')).toBe('false');
  });

  it('jumps to the ends with Home and End', async () => {
    setupTree();
    await userEvent.keyboard('{End}');
    expect(item('Organization').matches(':focus')).toBe(true);
    await userEvent.keyboard('{Home}');
    expect(item('All entities').matches(':focus')).toBe(true);
  });

  it('selects a row on click, and toggles without selecting from the caret', async () => {
    const onSelect = setupTree();
    // The caret is pointer-only and aria-hidden, so no query can reach it.
    // eslint-disable-next-line testing-library/no-node-access
    const caret = item('Organization').querySelector('[aria-hidden]');
    await userEvent.click(caret as Element);
    expect(item('Organization').getAttribute('aria-expanded')).toBe('true');
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.click(item('Clients'));
    expect(onSelect).toHaveBeenCalledWith({
      root: CatalogFolderRootKind.Organization,
      path: ['Clients'],
    });
  });

  it('follows the visual direction of ArrowLeft and ArrowRight under RTL', async () => {
    document.documentElement.dir = 'rtl';
    render(
      <div dir="rtl">
        <CatalogFolderTree
          tree={tree}
          selection={{ root: CatalogFolderRootKind.Organization, path: [] }}
          onSelect={vi.fn()}
        />
      </div>,
    );
    await userEvent.keyboard('{ArrowLeft}');
    expect(item('Organization').getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{ArrowRight}');
    expect(item('Organization').getAttribute('aria-expanded')).toBe('false');
  });
});
