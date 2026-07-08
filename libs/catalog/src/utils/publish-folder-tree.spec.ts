import { describe, expect, it } from 'vitest';
import { PublishFolderNode } from '../models/publish';
import { collectFolderKeys, filterFolderTree } from './publish-folder-tree';

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
