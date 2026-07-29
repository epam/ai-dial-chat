import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import { PublishFolderNode } from '../models/publish';
import {
  collectFolderKeys,
  filterFolderTree,
  fromFolderPathKey,
  getSiblingFolderNames,
  getUniqueFolderName,
  toDialFileTree,
  toFolderPathKey,
  validateFolderName,
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

describe('validateFolderName', () => {
  const messages = {
    empty: 'empty',
    invalid: 'invalid',
    duplicate: 'duplicate',
  };

  it('returns null for a valid, non-duplicate name', () => {
    expect(validateFolderName('New folder', ['Shared'], messages)).toBeNull();
  });

  it('trims the value before validating', () => {
    expect(validateFolderName('  New folder  ', [], messages)).toBeNull();
  });

  it('returns the empty message for a blank name', () => {
    expect(validateFolderName('   ', [], messages)).toBe('empty');
  });

  it.each([
    '../EscapeFolder',
    '..',
    'a/b',
    'a\\b',
    'a:b',
    'a;b',
    'a,b',
    'a=b',
    'a{b}',
    'a&b',
    'a"b',
  ])('returns the invalid message for %s', (name) => {
    expect(validateFolderName(name, [], messages)).toBe('invalid');
  });

  it('returns the duplicate message for a case-insensitive sibling match', () => {
    expect(validateFolderName('shared', ['Shared'], messages)).toBe(
      'duplicate',
    );
  });
});

describe('getUniqueFolderName', () => {
  it('returns the base name unchanged when no sibling has it', () => {
    expect(getUniqueFolderName('New folder', ['Shared'])).toBe('New folder');
  });

  it('appends " 2" when a sibling already has the base name', () => {
    expect(getUniqueFolderName('New folder', ['New folder'])).toBe(
      'New folder 2',
    );
  });

  it('matches case-insensitively when checking for a taken name', () => {
    expect(getUniqueFolderName('New folder', ['new folder'])).toBe(
      'New folder 2',
    );
  });

  it('skips every already-taken suffix to find the first free one', () => {
    expect(
      getUniqueFolderName('New folder', [
        'New folder',
        'New folder 2',
        'New folder 3',
      ]),
    ).toBe('New folder 4');
  });
});
