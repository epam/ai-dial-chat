import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileNodeType,
  DialFilePermission,
} from '@epam/ai-dial-react-file-manager';
import { describe, expect, it } from 'vitest';
import {
  buildSharedItemVirtualPath,
  dialCorePathToRelative,
  findDialFileByPath,
  findFolderByVirtualPath,
  formatOperationFolderName,
  hasDialFileWritePermission,
  hasForbiddenNameSymbols,
  isCopyMoveDuplicateAllowed,
  isShareActionsAllowed,
  normalizeVirtualPath,
  parseNewFolderVirtualPath,
  resolveOwnerCoords,
} from '../dial-file-manager-path.util';
import type { SharedRootMeta } from '../dial-file-manager.model';
import { DialFileManagerActionProfile } from '../file-manager-variant';

const makeFile = (overrides: Partial<DialFile>): DialFile => ({
  id: 'id',
  name: 'name',
  path: '/My files/name',
  parentPath: '/My files',
  nodeType: DialFileNodeType.ITEM,
  folderId: 'bucket',
  bucket: 'bucket',
  ...overrides,
});

describe('hasForbiddenNameSymbols', () => {
  it('rejects names containing a path separator', () => {
    expect(hasForbiddenNameSymbols('a/b')).toBe(true);
    expect(hasForbiddenNameSymbols('a\\b')).toBe(true);
  });

  it('accepts names with no forbidden regexp supplied', () => {
    expect(hasForbiddenNameSymbols('report.pdf')).toBe(false);
  });

  it('rejects names matching the supplied forbidden-symbols regexp', () => {
    expect(hasForbiddenNameSymbols('a:b', /[:]/g)).toBe(true);
    expect(hasForbiddenNameSymbols('ab', /[:]/g)).toBe(false);
  });

  it('resets a global regexp lastIndex so repeated calls are stateless', () => {
    const regexp = /[:]/g;
    expect(hasForbiddenNameSymbols('a:b', regexp)).toBe(true);
    expect(regexp.lastIndex).toBe(0);
    expect(hasForbiddenNameSymbols('a:b', regexp)).toBe(true);
  });
});

describe('normalizeVirtualPath', () => {
  it('strips trailing slashes', () => {
    expect(normalizeVirtualPath('/My files/reports/')).toBe(
      '/My files/reports',
    );
  });

  it('returns "/" when the trimmed value is empty', () => {
    expect(normalizeVirtualPath('/')).toBe('/');
    expect(normalizeVirtualPath('')).toBe('/');
  });
});

describe('formatOperationFolderName', () => {
  it('returns the root label for an empty destination folder', () => {
    expect(formatOperationFolderName('', 'My files')).toBe('My files');
  });

  it('strips the leading slash from a nested destination folder', () => {
    expect(formatOperationFolderName('/My files/reports', 'My files')).toBe(
      'My files/reports',
    );
  });
});

describe('findFolderByVirtualPath', () => {
  const tree: DialFile[] = [
    makeFile({
      name: 'reports',
      path: '/My files/reports/',
      nodeType: DialFileNodeType.FOLDER,
      items: [
        makeFile({
          name: 'q1',
          path: '/My files/reports/q1/',
          nodeType: DialFileNodeType.FOLDER,
        }),
      ],
    }),
  ];

  it('finds a top-level folder by virtual path', () => {
    expect(findFolderByVirtualPath(tree, '/My files/reports/')?.name).toBe(
      'reports',
    );
  });

  it('finds a nested folder by virtual path', () => {
    expect(findFolderByVirtualPath(tree, '/My files/reports/q1/')?.name).toBe(
      'q1',
    );
  });

  it('returns undefined for a path with no matching folder', () => {
    expect(findFolderByVirtualPath(tree, '/My files/missing/')).toBeUndefined();
  });
});

describe('hasDialFileWritePermission', () => {
  it('returns true when WRITE is present', () => {
    expect(
      hasDialFileWritePermission(
        makeFile({ permissions: [DialFilePermission.WRITE] }),
      ),
    ).toBe(true);
  });

  it('returns false when WRITE is absent', () => {
    expect(
      hasDialFileWritePermission(
        makeFile({ permissions: [DialFilePermission.READ] }),
      ),
    ).toBe(false);
  });

  it('returns false for undefined folder', () => {
    expect(hasDialFileWritePermission(undefined)).toBe(false);
  });
});

describe('findDialFileByPath', () => {
  const tree: DialFile[] = [
    makeFile({ id: 'a', path: '/My files/a' }),
    makeFile({
      id: 'b',
      path: '/My files/b/',
      nodeType: DialFileNodeType.FOLDER,
      items: [makeFile({ id: 'c', path: '/My files/b/c' })],
    }),
  ];

  it('finds a node by its path', () => {
    expect(findDialFileByPath(tree, '/My files/a')?.id).toBe('a');
  });

  it('finds a node by its id when path differs', () => {
    expect(findDialFileByPath(tree, 'c')?.path).toBe('/My files/b/c');
  });

  it('returns undefined when nothing matches', () => {
    expect(findDialFileByPath(tree, '/My files/missing')).toBeUndefined();
  });
});

describe('isCopyMoveDuplicateAllowed', () => {
  it('disallows for the Attach profile', () => {
    expect(
      isCopyMoveDuplicateAllowed(DialFileManagerActionProfile.Attach),
    ).toBe(false);
  });

  it('allows for the Browse profile', () => {
    expect(
      isCopyMoveDuplicateAllowed(DialFileManagerActionProfile.Browse),
    ).toBe(true);
  });

  it('allows for the Full profile', () => {
    expect(isCopyMoveDuplicateAllowed(DialFileManagerActionProfile.Full)).toBe(
      true,
    );
  });
});

describe('isShareActionsAllowed', () => {
  it('allows only the Full profile', () => {
    expect(isShareActionsAllowed(DialFileManagerActionProfile.Full)).toBe(true);
    expect(isShareActionsAllowed(DialFileManagerActionProfile.Browse)).toBe(
      false,
    );
    expect(isShareActionsAllowed(DialFileManagerActionProfile.Attach)).toBe(
      false,
    );
  });
});

describe('parseNewFolderVirtualPath', () => {
  it('parses a top-level new-folder path', () => {
    expect(parseNewFolderVirtualPath('/newFolder', 'My files')).toEqual({
      parentVirtualPath: '/My files',
      name: 'newFolder',
    });
  });

  it('parses a nested new-folder path', () => {
    expect(
      parseNewFolderVirtualPath('/My files/reports/newFolder', 'My files'),
    ).toEqual({
      parentVirtualPath: '/My files/reports',
      name: 'newFolder',
    });
  });
});

describe('dialCorePathToRelative', () => {
  it('strips the files/{bucket}/ prefix', () => {
    expect(
      dialCorePathToRelative('files/user-bucket/reports/q1.pdf', 'user-bucket'),
    ).toBe('reports/q1.pdf');
  });

  it('returns the input unchanged when the prefix does not match', () => {
    expect(
      dialCorePathToRelative(
        'files/other-bucket/reports/q1.pdf',
        'user-bucket',
      ),
    ).toBe('files/other-bucket/reports/q1.pdf');
  });
});

describe('buildSharedItemVirtualPath', () => {
  it('builds a file virtual path with decoded segments', () => {
    expect(
      buildSharedItemVirtualPath('reports/q1%20final.pdf', 'My files', false),
    ).toBe('/My files/reports/q1 final.pdf');
  });

  it('builds a trailing-slashed folder virtual path', () => {
    expect(buildSharedItemVirtualPath('reports', 'My files', true)).toBe(
      '/My files/reports/',
    );
  });

  it('returns the bare root when the relative path is empty', () => {
    expect(buildSharedItemVirtualPath('', 'My files', false)).toBe('/My files');
  });
});

describe('resolveOwnerCoords', () => {
  const sharedRootMeta = new Map<string, SharedRootMeta>([
    [
      'sharedFolder',
      { bucket: 'owner-bucket', dialCorePath: 'files/owner-bucket/reports/' },
    ],
  ]);

  it('returns the fallback bucket for an empty path', () => {
    expect(resolveOwnerCoords('', sharedRootMeta, 'my-bucket')).toEqual({
      bucket: 'my-bucket',
      path: '',
    });
  });

  it('returns the fallback bucket when no shared root matches', () => {
    expect(
      resolveOwnerCoords('unknown/sub', sharedRootMeta, 'my-bucket'),
    ).toEqual({ bucket: 'my-bucket', path: 'unknown/sub' });
  });

  it('resolves the owner bucket and path for a matching shared root', () => {
    expect(
      resolveOwnerCoords('sharedFolder/sub', sharedRootMeta, 'my-bucket'),
    ).toEqual({ bucket: 'owner-bucket', path: 'reports/sub' });
  });
});
