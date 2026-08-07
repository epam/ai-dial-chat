import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import { PublishFolderNode } from '../models/publish';
import {
  collectFolderKeys,
  filterFolderTree,
  fromFolderPathKey,
  getSiblingFolderNames,
  getUniqueFolderName,
  mergeFolderPaths,
  sortFolderTree,
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

describe('sortFolderTree', () => {
  it('orders root nodes by name', () => {
    expect(sortFolderTree(tree).map((node) => node.name)).toEqual([
      'My workspace',
      'Shared',
    ]);
  });

  it('orders nested children too', () => {
    const unsorted: PublishFolderNode[] = [
      {
        path: ['Shared'],
        name: 'Shared',
        children: [
          { path: ['Shared', 'Zeta'], name: 'Zeta' },
          { path: ['Shared', 'alpha'], name: 'alpha' },
        ],
      },
    ];
    expect(
      sortFolderTree(unsorted)[0].children?.map((node) => node.name),
    ).toEqual(['alpha', 'Zeta']);
  });

  it('compares digits numerically so "Report 2" precedes "Report 10"', () => {
    const unsorted: PublishFolderNode[] = [
      { path: ['Report 10'], name: 'Report 10' },
      { path: ['Report 2'], name: 'Report 2' },
    ];
    expect(sortFolderTree(unsorted).map((node) => node.name)).toEqual([
      'Report 2',
      'Report 10',
    ]);
  });

  it('leaves the input array and its nodes untouched', () => {
    const input: PublishFolderNode[] = [
      { path: ['b'], name: 'b' },
      { path: ['a'], name: 'a' },
    ];
    sortFolderTree(input);
    expect(input.map((node) => node.name)).toEqual(['b', 'a']);
  });

  it('keeps children undefined for a leaf node', () => {
    expect(
      sortFolderTree([{ path: ['a'], name: 'a' }])[0].children,
    ).toBeUndefined();
  });
});

describe('mergeFolderPaths', () => {
  it('adds a missing root-level folder', () => {
    const result = mergeFolderPaths(tree, [['Model releases']]);
    expect(result.map((node) => node.name)).toEqual([
      'Shared',
      'My workspace',
      'Model releases',
    ]);
    expect(result[2]).toEqual({
      path: ['Model releases'],
      name: 'Model releases',
      children: undefined,
    });
  });

  it('adds a missing folder under an existing parent, keeping its siblings', () => {
    const result = mergeFolderPaths(tree, [['My workspace', 'Model releases']]);
    expect(result[1].children?.map((node) => node.name)).toEqual([
      'Drafts',
      'Model releases',
    ]);
    expect(result[1].children?.[1].path).toEqual([
      'My workspace',
      'Model releases',
    ]);
  });

  it('creates every missing ancestor of a nested path', () => {
    const result = mergeFolderPaths([], [['Org', 'Team', 'Q3']]);
    expect(result[0].children?.[0].children?.[0]).toEqual({
      path: ['Org', 'Team', 'Q3'],
      name: 'Q3',
      children: undefined,
    });
  });

  it('leaves the tree unchanged when every path is already present', () => {
    expect(
      mergeFolderPaths(tree, [['Shared'], ['Shared', 'Data Science']]),
    ).toEqual(tree);
  });

  it('ignores empty paths (the bucket root is not a folder node)', () => {
    expect(mergeFolderPaths(tree, [[]])).toEqual(tree);
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
