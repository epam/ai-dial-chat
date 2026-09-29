import { CatalogContentNodeType } from '@epam/ai-dial-catalog';
import type { CatalogContentTreeNode } from '@epam/ai-dial-catalog';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { describe, expect, it } from 'vitest';
import { mapCatalogContentTreeToDialFiles } from '../catalog-content-dial-files';

describe('mapCatalogContentTreeToDialFiles', () => {
  it('returns an empty list for an empty tree', () => {
    expect(mapCatalogContentTreeToDialFiles([])).toEqual([]);
  });

  it('maps root files onto items whose path is the opaque id', () => {
    const nodes: CatalogContentTreeNode[] = [
      {
        type: CatalogContentNodeType.File,
        id: 'file:SKILL.md',
        name: 'SKILL.md',
      },
    ];

    expect(mapCatalogContentTreeToDialFiles(nodes)).toEqual([
      {
        path: 'file:SKILL.md',
        name: 'SKILL.md',
        nodeType: DialFileNodeType.ITEM,
        parentPath: null,
        folderId: '',
      },
    ]);
  });

  it('nests folders and links each child to its parent id', () => {
    const nodes: CatalogContentTreeNode[] = [
      {
        type: CatalogContentNodeType.Folder,
        id: 'scripts',
        name: 'scripts',
        items: [
          {
            type: CatalogContentNodeType.Folder,
            id: 'scripts/lib',
            name: 'lib',
            items: [
              {
                type: CatalogContentNodeType.File,
                id: 'scripts/lib/util.py',
                name: 'util.py',
              },
            ],
          },
        ],
      },
    ];

    const [scripts] = mapCatalogContentTreeToDialFiles(nodes);
    expect(scripts).toMatchObject({
      path: 'scripts',
      nodeType: DialFileNodeType.FOLDER,
      parentPath: null,
      folderId: 'scripts',
    });
    const [lib] = scripts.items ?? [];
    expect(lib).toMatchObject({
      path: 'scripts/lib',
      name: 'lib',
      nodeType: DialFileNodeType.FOLDER,
      parentPath: 'scripts',
    });
    expect(lib.items).toEqual([
      {
        path: 'scripts/lib/util.py',
        name: 'util.py',
        nodeType: DialFileNodeType.ITEM,
        parentPath: 'scripts/lib',
        folderId: 'scripts/lib',
      },
    ]);
  });

  it('keeps an empty folder as a folder with no items', () => {
    const [empty] = mapCatalogContentTreeToDialFiles([
      {
        type: CatalogContentNodeType.Folder,
        id: 'assets',
        name: 'assets',
        items: [],
      },
    ]);

    expect(empty.nodeType).toBe(DialFileNodeType.FOLDER);
    expect(empty.items).toEqual([]);
  });

  it('preserves sibling order', () => {
    const names = mapCatalogContentTreeToDialFiles([
      { type: CatalogContentNodeType.File, id: 'b', name: 'b.md' },
      { type: CatalogContentNodeType.File, id: 'a', name: 'a.md' },
    ]).map((file) => file.name);

    expect(names).toEqual(['b.md', 'a.md']);
  });
});
