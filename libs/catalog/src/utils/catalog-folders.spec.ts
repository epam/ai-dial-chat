import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG_FOLDER_ROOTS } from '../constants/catalog-folders';
import type { CatalogItem } from '../models/catalog-item';
import { CatalogFolderRootKind } from '../types/catalog-folders';
import {
  buildCatalogFolderTree,
  filterByFolder,
  getCatalogItemFolderPath,
  isFolderSelectionValid,
} from './catalog-folders';

const roots = DEFAULT_CATALOG_FOLDER_ROOTS;

const makeItem = (
  id: string,
  folder: string[],
  flags: Partial<CatalogItem> = {},
): CatalogItem => ({
  id,
  type: CatalogEntityType.Agent,
  name: id,
  version: '1',
  lastUsed: '',
  description: '',
  folder,
  topics: [],
  ...flags,
});

const items = [
  makeItem('a', ['Organization', 'Design Assets']),
  makeItem('b', ['Organization', 'Design Assets', 'Icons']),
  makeItem('c', ['Organization', 'Clients']),
  makeItem('p', ['Personal', 'drafts'], { isMyApp: true }),
  makeItem('s', ['Shared with me'], { sharedWithMe: true }),
];

describe('getCatalogItemFolderPath', () => {
  it('puts an own item under Personal and strips the root label', () => {
    expect(getCatalogItemFolderPath(items[3], roots)).toEqual({
      root: CatalogFolderRootKind.Personal,
      path: ['drafts'],
    });
  });

  it('puts a shared item under Shared', () => {
    expect(getCatalogItemFolderPath(items[4], roots)).toEqual({
      root: CatalogFolderRootKind.Shared,
      path: [],
    });
  });

  it('prefers the own flag over the shared flag', () => {
    const item = makeItem('x', [], { isMyApp: true, sharedWithMe: true });
    expect(getCatalogItemFolderPath(item, roots).root).toBe(
      CatalogFolderRootKind.Personal,
    );
  });

  it('keeps the whole path when the first segment is not the root label', () => {
    expect(
      getCatalogItemFolderPath(makeItem('x', ['raw', 'path']), roots),
    ).toEqual({
      root: CatalogFolderRootKind.Organization,
      path: ['raw', 'path'],
    });
  });

  it('places an item without a folder at the Organization root', () => {
    expect(getCatalogItemFolderPath(makeItem('x', []), roots)).toEqual({
      root: CatalogFolderRootKind.Organization,
      path: [],
    });
  });
});

describe('buildCatalogFolderTree', () => {
  it('returns one node per root in the order of roots', () => {
    const tree = buildCatalogFolderTree(items, roots);
    expect(tree.map((n) => n.label)).toEqual([
      'Personal',
      'Shared with me',
      'Organization',
    ]);
  });

  it('nests and sorts subfolders under their root', () => {
    const org = buildCatalogFolderTree(items, roots)[2];
    expect(org.children.map((n) => n.label)).toEqual([
      'Clients',
      'Design Assets',
    ]);
    expect(org.children[1].children.map((n) => n.label)).toEqual(['Icons']);
    expect(org.children[1].children[0].path).toEqual([
      'Design Assets',
      'Icons',
    ]);
  });

  it('keeps an empty root', () => {
    const tree = buildCatalogFolderTree([items[0]], roots);
    expect(tree[0]).toMatchObject({
      root: CatalogFolderRootKind.Personal,
      children: [],
    });
  });

  it('encodes a slash inside a segment so ids cannot collide', () => {
    const tree = buildCatalogFolderTree(
      [
        makeItem('x', ['Organization', 'a/b']),
        makeItem('y', ['Organization', 'a', 'b']),
      ],
      roots,
    );
    const org = tree[2];
    const slashed = org.children.find((n) => n.label === 'a/b');
    const nested = org.children.find((n) => n.label === 'a')?.children[0];
    expect(slashed?.id).toBe('organization/a%2Fb');
    expect(nested?.id).toBe('organization/a/b');
  });

  it('adds no node for items whose root is missing from roots', () => {
    const tree = buildCatalogFolderTree(items, roots.slice(1));
    expect(tree.map((n) => n.root)).toEqual([
      CatalogFolderRootKind.Shared,
      CatalogFolderRootKind.Organization,
    ]);
  });
});

describe('filterByFolder', () => {
  it('keeps every item for All entities', () => {
    expect(filterByFolder(items, { path: [] }, roots)).toBe(items);
  });

  it('keeps the folder and its subfolders', () => {
    const result = filterByFolder(
      items,
      { root: CatalogFolderRootKind.Organization, path: ['Design Assets'] },
      roots,
    );
    expect(result.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('keeps every item of a root', () => {
    const result = filterByFolder(
      items,
      { root: CatalogFolderRootKind.Personal, path: [] },
      roots,
    );
    expect(result.map((i) => i.id)).toEqual(['p']);
  });
});

describe('isFolderSelectionValid', () => {
  const tree = buildCatalogFolderTree(items, roots);

  it('accepts All entities', () => {
    expect(isFolderSelectionValid({ path: [] }, tree)).toBe(true);
  });

  it('accepts an existing folder', () => {
    expect(
      isFolderSelectionValid(
        {
          root: CatalogFolderRootKind.Organization,
          path: ['Design Assets', 'Icons'],
        },
        tree,
      ),
    ).toBe(true);
  });

  it('rejects a stale path', () => {
    expect(
      isFolderSelectionValid(
        { root: CatalogFolderRootKind.Organization, path: ['Archived'] },
        tree,
      ),
    ).toBe(false);
  });

  it('rejects a root missing from the tree', () => {
    expect(
      isFolderSelectionValid(
        { root: CatalogFolderRootKind.Personal, path: [] },
        buildCatalogFolderTree(items, roots.slice(1)),
      ),
    ).toBe(false);
  });
});
