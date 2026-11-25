import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { describe, expect, it } from 'vitest';
import {
  findFolder,
  findSectionRoot,
  isSameOrInsidePath,
  toDestinationFolderNodes,
  toDestinationPath,
  toPathSegments,
} from '../destination-folders';

const folder = (path: string, items?: DialFile[]): DialFile => ({
  id: path,
  name: path.split('/').filter(Boolean).pop() ?? '',
  path,
  folderId: path,
  nodeType: DialFileNodeType.FOLDER,
  items,
});

const file = (path: string): DialFile => ({
  id: path,
  name: path.split('/').pop() ?? '',
  path,
  folderId: path,
  nodeType: DialFileNodeType.ITEM,
});

describe('toPathSegments', () => {
  it('drops empty segments and slashes at both ends', () => {
    expect(toPathSegments('/My files/reports/')).toEqual([
      'My files',
      'reports',
    ]);
  });
});

describe('isSameOrInsidePath', () => {
  it('matches the path itself and anything below it, segment by segment', () => {
    expect(isSameOrInsidePath('/My files/a', '/My files/a/')).toBe(true);
    expect(isSameOrInsidePath('/My files/a/b', '/My files/a')).toBe(true);
    expect(isSameOrInsidePath('/My files/ab', '/My files/a')).toBe(false);
    expect(isSameOrInsidePath('/My files', '/My files/a')).toBe(false);
  });
});

describe('findSectionRoot', () => {
  const roots = [folder('/My files'), folder('/Shared with me')];

  it('returns the root the source folder belongs to', () => {
    expect(findSectionRoot(roots, '/Shared with me/x/')?.path).toBe(
      '/Shared with me',
    );
  });

  it('falls back to the first root when none matches', () => {
    expect(findSectionRoot(roots, '/Other')?.path).toBe('/My files');
  });
});

describe('toDestinationPath', () => {
  it('joins the root and the segments below it', () => {
    expect(toDestinationPath('/My files', ['a', 'b'])).toBe('/My files/a/b');
    expect(toDestinationPath('/My files/', [])).toBe('/My files');
  });
});

describe('toDestinationFolderNodes', () => {
  const tree = [
    folder('/My files/a', [file('/My files/a/f.txt'), folder('/My files/a/b')]),
    folder('/My files/.hidden'),
    folder('/My files/unloaded'),
    folder('/My files/empty', []),
    file('/My files/readme.md'),
  ];

  it('keeps folders only, relative to the root, without dot-folders', () => {
    const nodes = toDestinationFolderNodes(tree, 1, () => false);

    expect(nodes.map((node) => node.path)).toEqual([
      ['a'],
      ['unloaded'],
      ['empty'],
    ]);
    expect(nodes[0].children?.map((node) => node.path)).toEqual([['a', 'b']]);
  });

  it('leaves children undefined for a folder whose contents are not loaded', () => {
    const [, unloaded, empty] = toDestinationFolderNodes(tree, 1, () => false);

    expect(unloaded.children).toBeUndefined();
    expect(empty.children).toBeUndefined();
  });

  it('gives an empty children list to a loaded folder without subfolders', () => {
    const nodes = toDestinationFolderNodes(
      tree,
      1,
      (path) => path === '/My files/empty',
    );

    expect(nodes[2].children).toEqual([]);
  });
});

describe('findFolder', () => {
  const root = folder('/My files', [
    folder('/My files/a', [folder('/My files/a/b')]),
  ]);

  it('finds a nested folder by virtual path', () => {
    expect(findFolder(root, '/My files/a/b/')?.path).toBe('/My files/a/b');
  });

  it('returns the root for the root path and undefined for an unknown path', () => {
    expect(findFolder(root, '/My files')).toBe(root);
    expect(findFolder(root, '/My files/x')).toBeUndefined();
  });
});
