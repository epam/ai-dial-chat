import {
  ListFilesItemDtoNodeTypeEnum,
  type ListFilesItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  DialFileManagerTabs,
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { describe, expect, it, vi } from 'vitest';
import {
  buildFromCache,
  fetchByTab,
  fetchForSearch,
  findFirstSuccessfulCopyMoveItem,
  mapCorePermissions,
  mapFileMetadataToDialFile,
  mapSearchItem,
  mergeCreatedFolderIntoCache,
  updateEntry,
} from '../dial-file-manager-mapping.util';
import type {
  PreparedCopyMoveItem,
  SharedRootMeta,
} from '../dial-file-manager.model';
import type { DialFilesApi } from '../dial-files-api';
import { FileUploadStatus } from '../upload-batch.types';
import type { FileUploadBatchState } from '../upload-batch.types';

const makeFilesApi = (overrides: Partial<DialFilesApi> = {}): DialFilesApi =>
  ({
    listFiles: vi.fn(),
    listPublicFiles: vi.fn(),
    listSharedFiles: vi.fn(),
    listSharedByMe: vi.fn(),
    getFileMetadata: vi.fn(),
    uploadFile: vi.fn(),
    uploadArchive: vi.fn(),
    createFolder: vi.fn(),
    deleteFiles: vi.fn(),
    renameFiles: vi.fn(),
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    downloadFile: vi.fn(),
    downloadArchive: vi.fn(),
    revokeAccess: vi.fn(),
    discardShared: vi.fn(),
    ...overrides,
  }) as DialFilesApi;

describe('mapCorePermissions', () => {
  it('maps known core permission strings, case-insensitively', () => {
    expect(mapCorePermissions(['read', 'WRITE'])).toEqual(['READ', 'WRITE']);
  });

  it('drops unrecognized permission strings', () => {
    expect(mapCorePermissions(['read', 'unknown'])).toEqual(['READ']);
  });

  it('returns undefined for an empty or missing list', () => {
    expect(mapCorePermissions(undefined)).toBeUndefined();
    expect(mapCorePermissions([])).toBeUndefined();
  });

  it('returns undefined when every entry is unrecognized', () => {
    expect(mapCorePermissions(['unknown'])).toBeUndefined();
  });
});

describe('findFirstSuccessfulCopyMoveItem', () => {
  const items: PreparedCopyMoveItem<{
    sourcePath: string;
    destinationPath: string;
  }>[] = [
    {
      dto: { sourcePath: 'a.pdf', destinationPath: 'b/a.pdf' },
      destinationName: 'a.pdf',
    },
    {
      dto: { sourcePath: 'c.pdf', destinationPath: 'b/c.pdf' },
      destinationName: 'c.pdf',
    },
  ];

  it('matches the item whose source and destination both match the successful result', () => {
    const result = findFirstSuccessfulCopyMoveItem(items, [
      { success: true, sourcePath: 'c.pdf', destinationPath: 'b/c.pdf' },
    ]);
    expect(result?.destinationName).toBe('c.pdf');
  });

  it('falls back to a destination-only match when source paths were rewritten', () => {
    const result = findFirstSuccessfulCopyMoveItem(items, [
      { success: true, sourcePath: 'renamed.pdf', destinationPath: 'b/a.pdf' },
    ]);
    expect(result?.destinationName).toBe('a.pdf');
  });

  it('returns undefined when no result succeeded', () => {
    expect(
      findFirstSuccessfulCopyMoveItem(items, [{ success: false }]),
    ).toBeUndefined();
  });
});

describe('buildFromCache', () => {
  it('builds a flat file entry from the cache', () => {
    const cache = new Map<string, ListFilesItemDto[]>([
      [
        '',
        [
          {
            name: 'report.pdf',
            path: 'user-bucket/report.pdf',
            folderId: 'user-bucket',
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: 'user-bucket',
          },
        ],
      ],
    ]);

    const result = buildFromCache(cache, new Map(), '', '/My files', 'root');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'report.pdf',
      path: '/My files/report.pdf',
    });
  });

  it('recurses into nested folders and attaches inherited permissions', () => {
    const cache = new Map<string, ListFilesItemDto[]>([
      [
        '',
        [
          {
            name: 'reports',
            path: 'user-bucket/reports',
            folderId: 'user-bucket',
            nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
            bucket: 'user-bucket',
          },
        ],
      ],
      [
        'reports/',
        [
          {
            name: 'q1.pdf',
            path: 'user-bucket/reports/q1.pdf',
            folderId: 'user-bucket',
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: 'user-bucket',
          },
        ],
      ],
    ]);
    const permissionsCache = new Map<string, string[] | undefined>([
      ['reports/', ['read', 'write']],
    ]);

    const [folder] = buildFromCache(
      cache,
      permissionsCache,
      '',
      '/My files',
      'root',
    );
    expect(folder.permissions).toEqual(['READ', 'WRITE']);
    expect(folder.items).toHaveLength(1);
    expect(folder.items?.[0].path).toBe('/My files/reports/q1.pdf');
  });

  it('returns an empty array when the path is not in the cache', () => {
    expect(
      buildFromCache(new Map(), new Map(), 'missing/', '/My files', 'root'),
    ).toEqual([]);
  });
});

describe('mergeCreatedFolderIntoCache', () => {
  it('adds the created folder to its parent entry', () => {
    const cache = new Map<string, ListFilesItemDto[]>([['', []]]);
    const next = mergeCreatedFolderIntoCache(cache, '', {
      name: 'newFolder',
      path: 'user-bucket/newFolder',
      parentPath: '',
      bucket: 'user-bucket',
      nodeType: 'folder',
      folderId: 'user-bucket',
    });
    expect(next.get('')).toHaveLength(1);
    expect(next.get('')?.[0].name).toBe('newFolder');
  });

  it('does not add a duplicate when a same-name-case-insensitive entry exists', () => {
    const cache = new Map<string, ListFilesItemDto[]>([
      [
        '',
        [
          {
            name: 'NewFolder',
            path: 'user-bucket/NewFolder',
            folderId: 'user-bucket',
            nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
            bucket: 'user-bucket',
          },
        ],
      ],
    ]);
    const next = mergeCreatedFolderIntoCache(cache, '', {
      name: 'newfolder',
      path: 'user-bucket/newfolder',
      parentPath: '',
      bucket: 'user-bucket',
      nodeType: 'folder',
      folderId: 'user-bucket',
    });
    expect(next.get('')).toHaveLength(1);
  });

  it('does not mutate the original cache map', () => {
    const cache = new Map<string, ListFilesItemDto[]>([['', []]]);
    mergeCreatedFolderIntoCache(cache, '', {
      name: 'newFolder',
      path: 'user-bucket/newFolder',
      parentPath: '',
      bucket: 'user-bucket',
      nodeType: 'folder',
      folderId: 'user-bucket',
    });
    expect(cache.get('')).toHaveLength(0);
  });
});

describe('updateEntry', () => {
  const batch: FileUploadBatchState = {
    isOpen: true,
    files: [
      { id: '1', name: 'a.pdf', status: FileUploadStatus.Queued },
      { id: '2', name: 'b.pdf', status: FileUploadStatus.Queued },
    ],
  };

  it('returns null unchanged when prev is null', () => {
    expect(updateEntry(null, 0, FileUploadStatus.Uploading)).toBeNull();
  });

  it('patches only the entry at the given index with a status shorthand', () => {
    const result = updateEntry(batch, 0, FileUploadStatus.Uploading);
    expect(result?.files[0].status).toBe(FileUploadStatus.Uploading);
    expect(result?.files[1].status).toBe(FileUploadStatus.Queued);
  });

  it('patches with a partial object', () => {
    const result = updateEntry(batch, 1, { percent: 42 });
    expect(result?.files[1].percent).toBe(42);
    expect(result?.files[1].status).toBe(FileUploadStatus.Queued);
  });
});

describe('mapSearchItem', () => {
  it('maps a search result item to a virtual-path DialFile', () => {
    const item: ListFilesItemDto = {
      name: 'q1.pdf',
      path: 'user-bucket/reports/q1.pdf',
      folderId: 'user-bucket',
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: 'user-bucket',
      url: 'files/user-bucket/reports/q1.pdf',
    };
    const result = mapSearchItem(item, 'user-bucket', 'My files');
    expect(result.path).toBe('/My files/reports/q1.pdf');
    expect(result.parentPath).toBe('/My files/reports');
  });

  it('falls back to the root virtual path for a top-level item', () => {
    const item: ListFilesItemDto = {
      name: 'report.pdf',
      path: 'user-bucket/report.pdf',
      folderId: 'user-bucket',
      nodeType: ListFilesItemDtoNodeTypeEnum.Item,
      bucket: 'user-bucket',
      url: 'files/user-bucket/report.pdf',
    };
    const result = mapSearchItem(item, 'user-bucket', 'My files');
    expect(result.parentPath).toBe('/My files');
    expect(result.path).toBe('/My files/report.pdf');
  });
});

describe('mapFileMetadataToDialFile', () => {
  const makeOriginal = (overrides: Partial<DialFile> = {}): DialFile => ({
    id: 'report.pdf',
    name: 'report.pdf',
    path: '/My files/report.pdf',
    parentPath: '/My files',
    nodeType: DialFileNodeType.ITEM,
    folderId: 'user-bucket',
    bucket: 'user-bucket',
    ...overrides,
  });

  it('overlays metadata fields onto the original row, preserving virtual identity', () => {
    const original = makeOriginal();

    const result = mapFileMetadataToDialFile(
      { bucket: 'user-bucket', contentLength: 100, author: 'me' },
      original,
    );

    expect(result.path).toBe('/My files/report.pdf');
    expect(result.contentLength).toBe(100);
    expect(result.author).toBe('me');
  });

  it('keeps the original bucket when metadata omits it', () => {
    const original = makeOriginal({ bucket: 'original-bucket' });

    const result = mapFileMetadataToDialFile({}, original);
    expect(result.bucket).toBe('original-bucket');
  });
});

describe('fetchByTab', () => {
  it('dispatches to listPublicFiles for the Organization tab', async () => {
    const filesApi = makeFilesApi({
      listPublicFiles: vi.fn().mockResolvedValue({ items: [] }),
    });
    await fetchByTab(
      filesApi,
      DialFileManagerTabs.Organization,
      'bucket',
      'reports/',
      new Map(),
    );
    expect(filesApi.listPublicFiles).toHaveBeenCalledWith({
      path: 'reports/',
    });
  });

  it('dispatches to listFiles for the MyFiles tab with permissions requested', async () => {
    const filesApi = makeFilesApi({
      listFiles: vi.fn().mockResolvedValue({ items: [], permissions: [] }),
    });
    await fetchByTab(
      filesApi,
      DialFileManagerTabs.MyFiles,
      'bucket',
      'reports/',
      new Map(),
    );
    expect(filesApi.listFiles).toHaveBeenCalledWith({
      bucket: 'bucket',
      path: 'reports/',
      permissions: true,
    });
  });

  it('dispatches to listSharedFiles for the Shared root', async () => {
    const filesApi = makeFilesApi({
      listSharedFiles: vi.fn().mockResolvedValue({ items: [] }),
    });
    await fetchByTab(
      filesApi,
      DialFileManagerTabs.Shared,
      'bucket',
      '',
      new Map(),
    );
    expect(filesApi.listSharedFiles).toHaveBeenCalledWith({
      path: undefined,
    });
  });

  it('resolves the owner bucket for a nested Shared folder', async () => {
    const filesApi = makeFilesApi({
      listFiles: vi.fn().mockResolvedValue({ items: [], permissions: [] }),
    });
    const sharedRootMeta = new Map<string, SharedRootMeta>([
      [
        'sharedFolder',
        { bucket: 'owner-bucket', dialCorePath: 'files/owner-bucket/reports/' },
      ],
    ]);
    await fetchByTab(
      filesApi,
      DialFileManagerTabs.Shared,
      'bucket',
      'sharedFolder/sub',
      sharedRootMeta,
    );
    expect(filesApi.listFiles).toHaveBeenCalledWith({
      bucket: 'owner-bucket',
      path: 'reports/sub',
      permissions: true,
    });
  });

  it('resolves to an empty list for an unknown Shared root', async () => {
    const filesApi = makeFilesApi();
    const result = await fetchByTab(
      filesApi,
      DialFileManagerTabs.Shared,
      'bucket',
      'unknown/sub',
      new Map(),
    );
    expect(result).toEqual({ items: [] });
  });
});

describe('fetchForSearch', () => {
  it('requests a recursive listing for the Organization tab', async () => {
    const filesApi = makeFilesApi({
      listPublicFiles: vi.fn().mockResolvedValue({ items: [] }),
    });
    await fetchForSearch(
      filesApi,
      DialFileManagerTabs.Organization,
      'bucket',
      'reports/',
      new Map(),
    );
    expect(filesApi.listPublicFiles).toHaveBeenCalledWith({
      path: 'reports/',
      recursive: true,
    });
  });

  it('requests a recursive listing for the MyFiles tab', async () => {
    const filesApi = makeFilesApi({
      listFiles: vi.fn().mockResolvedValue({ items: [] }),
    });
    await fetchForSearch(
      filesApi,
      DialFileManagerTabs.MyFiles,
      'bucket',
      'reports/',
      new Map(),
    );
    expect(filesApi.listFiles).toHaveBeenCalledWith({
      bucket: 'bucket',
      path: 'reports/',
      permissions: true,
      recursive: true,
    });
  });

  it('returns an empty list for an unresolved Shared root', async () => {
    const filesApi = makeFilesApi();
    const result = await fetchForSearch(
      filesApi,
      DialFileManagerTabs.Shared,
      'bucket',
      'unknown/sub',
      new Map(),
    );
    expect(result).toEqual({ items: [] });
  });
});
