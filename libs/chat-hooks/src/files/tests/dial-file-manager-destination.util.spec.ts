import {
  DestinationFolderMode,
  DialFileNodeType,
  DialFilePermission,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { describe, expect, it } from 'vitest';
import {
  buildDestinationRoots,
  DestinationRestriction,
  findDestinationForVirtualPath,
  getDestinationRestriction,
  getDestinationVirtualPath,
  getExpandedKeyVirtualPath,
  toDestinationVirtualPath,
} from '../dial-file-manager-destination.util';

const folder = (
  name: string,
  path: string,
  items: DialFile[] = [],
  permissions: DialFilePermission[] = [DialFilePermission.WRITE],
): DialFile =>
  ({
    id: path,
    name,
    path,
    nodeType: DialFileNodeType.FOLDER,
    items,
    permissions,
  }) as DialFile;

const file = (name: string, path: string): DialFile =>
  ({ id: path, name, path, nodeType: DialFileNodeType.ITEM }) as DialFile;

const items: DialFile[] = [
  folder('My files', '/My files', [
    folder('reports', '/My files/reports/', [
      folder('2024', '/My files/reports/2024'),
      file('a.pdf', '/My files/reports/a.pdf'),
    ]),
    file('b.txt', '/My files/b.txt'),
  ]),
  folder('Shared with me', '/Shared with me', [], []),
];

describe('buildDestinationRoots', () => {
  const build = (loading = new Set<string>()) =>
    buildDestinationRoots(items, new Map(), () => undefined, loading);

  it('builds one root per top-level folder', () => {
    expect(build().map((root) => root.key)).toEqual([
      'My files',
      'Shared with me',
    ]);
  });

  it('keeps only folders, with paths relative to the root', () => {
    const [root] = build();
    expect(root?.items).toEqual([
      {
        path: ['reports'],
        name: 'reports',
        children: [{ path: ['reports', '2024'], name: '2024', children: [] }],
      },
    ]);
  });

  it('offers folder creation only under roots the user can write to', () => {
    const [writable, readOnly] = build();
    expect(writable?.canCreateFolders).toBe(true);
    expect(readOnly?.canCreateFolders).toBe(false);
  });

  it('maps loading virtual paths to folder keys inside their root', () => {
    const [root] = build(new Set(['/My files/reports/']));
    expect(root?.loadingPaths).toEqual(new Set(['reports']));
  });

  it('reports a root expansion change with its key', () => {
    const calls: [string, Set<string>][] = [];
    const [root] = buildDestinationRoots(
      items,
      new Map(),
      (key, paths) => calls.push([key, paths]),
      new Set(),
    );
    root?.onExpandedPathsChange?.(new Set(['reports']));
    expect(calls).toEqual([['My files', new Set(['reports'])]]);
  });
});

describe('destination paths', () => {
  it('joins a root and relative segments into a virtual path', () => {
    expect(toDestinationVirtualPath(items[0] as DialFile, ['reports'])).toBe(
      '/My files/reports',
    );
    expect(toDestinationVirtualPath(items[0] as DialFile, [])).toBe(
      '/My files',
    );
  });

  it('finds the destination for a virtual path inside a root', () => {
    expect(findDestinationForVirtualPath(items, '/My files/reports/')).toEqual({
      rootKey: 'My files',
      path: ['reports'],
    });
    expect(findDestinationForVirtualPath(items, '/My files')).toEqual({
      rootKey: 'My files',
      path: [],
    });
  });

  it('returns undefined for a virtual path outside every root', () => {
    expect(
      findDestinationForVirtualPath(items, '/Elsewhere/x'),
    ).toBeUndefined();
  });

  it('converts a destination back to its virtual path', () => {
    expect(
      getDestinationVirtualPath(items, {
        rootKey: 'My files',
        path: ['reports', '2024'],
      }),
    ).toBe('/My files/reports/2024');
    expect(
      getDestinationVirtualPath(items, { rootKey: 'Nope', path: [] }),
    ).toBeUndefined();
  });

  it('converts an expanded folder key to its virtual path', () => {
    expect(getExpandedKeyVirtualPath(items, 'My files', 'reports/2024')).toBe(
      '/My files/reports/2024',
    );
  });
});

describe('getDestinationRestriction', () => {
  const moved = [folder('reports', '/My files/reports')];

  it('rejects the folder the items are already in', () => {
    expect(
      getDestinationRestriction(
        DestinationFolderMode.Copy,
        '/My files/',
        '/My files',
        moved,
      ),
    ).toBe(DestinationRestriction.SourceFolder);
  });

  it('rejects moving a folder into itself or its subfolders', () => {
    expect(
      getDestinationRestriction(
        DestinationFolderMode.Move,
        '/My files/reports/2024',
        '/My files',
        moved,
      ),
    ).toBe(DestinationRestriction.IntoItself);
  });

  it('allows copying a folder into its own subfolder tree path', () => {
    expect(
      getDestinationRestriction(
        DestinationFolderMode.Copy,
        '/My files/reports/2024',
        '/My files',
        moved,
      ),
    ).toBeUndefined();
  });

  it('allows a different folder', () => {
    expect(
      getDestinationRestriction(
        DestinationFolderMode.Move,
        '/Shared with me',
        '/My files',
        moved,
      ),
    ).toBeUndefined();
  });
});
