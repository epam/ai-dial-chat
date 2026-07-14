import { DialFile, DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import { PublishFolderNode } from '../models/publish';
import {
  collectFolderKeys,
  filterFolderTree,
  fromFolderPathKey,
  getSiblingFolderNames,
  insertPlaceholderDialFile,
  toDialFileTree,
  toFolderPathKey,
} from './publish-folder-tree';

const tree: PublishFolderNode[] = [
  {
    path: ['Shared'],
    name: 'Shared',
    children: [
      {
        path: ['Shared', 'Data Science'],
        name: 'Data Science',
        children: [
          {
            path: ['Shared', 'Data Science', 'Published models'],
            name: 'Published models',
          },
        ],
      },
    ],
  },
  {
    path: ['My workspace'],
    name: 'My workspace',
    children: [{ path: ['My workspace', 'Drafts'], name: 'Drafts' }],
  },
];

describe('filterFolderTree', () => {
  it('returns all items unchanged for an empty query', () => {
    expect(filterFolderTree(tree, '')).toEqual(tree);
  });

  it('returns all items unchanged for a whitespace-only query', () => {
    expect(filterFolderTree(tree, '   ')).toEqual(tree);
  });

  it('keeps a branch when a descendant name matches', () => {
    const result = filterFolderTree(tree, 'drafts');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My workspace');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children?.[0].name).toBe('Drafts');
  });

  it('drops branches with no matching name and no matching descendant', () => {
    const result = filterFolderTree(tree, 'drafts');
    expect(result.find((node) => node.name === 'Shared')).toBeUndefined();
  });

  it('keeps a node whose own name matches, along with all its descendants', () => {
    const result = filterFolderTree(tree, 'data science');
    expect(result[0].children?.[0].children).toHaveLength(1);
  });

  it('matches case-insensitively', () => {
    const result = filterFolderTree(tree, 'PUBLISHED');
    expect(result[0]?.children?.[0]?.children?.[0]?.name).toBe(
      'Published models',
    );
  });
});

describe('collectFolderKeys', () => {
  it('returns every path in the tree, recursively', () => {
    expect(collectFolderKeys(tree)).toEqual([
      'Shared',
      'Shared/Data Science',
      'Shared/Data Science/Published models',
      'My workspace',
      'My workspace/Drafts',
    ]);
  });
});

describe('toFolderPathKey / fromFolderPathKey', () => {
  it('joins and splits path segments symmetrically', () => {
    const segments = ['Shared', 'Data Science'];
    expect(fromFolderPathKey(toFolderPathKey(segments))).toEqual(segments);
  });

  it('round-trips an empty path to an empty array', () => {
    expect(fromFolderPathKey(toFolderPathKey([]))).toEqual([]);
  });
});

describe('toDialFileTree', () => {
  it('converts nodes to DialFile with folder node type and joined path', () => {
    const result = toDialFileTree(tree);
    expect(result[0]).toMatchObject({
      path: 'Shared',
      name: 'Shared',
      folderId: 'Shared',
      nodeType: DialFileNodeType.FOLDER,
    });
    expect(result[0].items?.[0]).toMatchObject({
      path: 'Shared/Data Science',
      name: 'Data Science',
    });
  });

  it('leaves items undefined for leaf nodes', () => {
    const result = toDialFileTree(tree);
    const leaf = result[0].items?.[0].items?.[0];
    expect(leaf?.items).toBeUndefined();
  });
});

describe('insertPlaceholderDialFile', () => {
  const files: DialFile[] = toDialFileTree(tree);

  it('inserts a root-level placeholder', () => {
    const result = insertPlaceholderDialFile(files, [], 'New folder');
    expect(result.at(-1)).toMatchObject({
      path: 'New folder',
      name: 'New folder',
    });
  });

  it('inserts a placeholder under a nested parent', () => {
    const result = insertPlaceholderDialFile(
      files,
      ['Shared', 'Data Science'],
      'New folder',
    );
    const parent = result[0].items?.[0];
    expect(parent?.items?.at(-1)).toMatchObject({
      path: 'Shared/Data Science/New folder',
      name: 'New folder',
    });
  });
});

describe('getSiblingFolderNames', () => {
  it('returns root-level names when parentPath is empty', () => {
    expect(getSiblingFolderNames(tree, [])).toEqual(['Shared', 'My workspace']);
  });

  it('returns child names for a nested parent', () => {
    expect(getSiblingFolderNames(tree, ['Shared'])).toEqual(['Data Science']);
  });

  it('returns an empty array for a parent with no children', () => {
    expect(
      getSiblingFolderNames(tree, [
        'Shared',
        'Data Science',
        'Published models',
      ]),
    ).toEqual([]);
  });
});
