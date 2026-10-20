import type {
  CreateFolderResponseDto,
  FileMetadataResponseDto,
  ListFilesItemDto,
} from '@epam/ai-dial-chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import { FileUploadFailureReason } from '@epam/ai-dial-chat-shared';
import type {
  FileUploadBatchState,
  FileUploadEntry,
  FileUploadStatus,
} from '@epam/ai-dial-chat-shared';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-react-file-manager';
import { getApiErrorDetails } from '../api-error/api-error';
import { safeDecodeURI } from '../shared/string-utils';
import { UploadNetworkError } from './create-upload-file-with-progress';
import {
  buildSharedItemVirtualPath,
  dialCorePathToRelative,
} from './dial-file-manager-path.util';
import {
  CORE_PERMISSION_MAP,
  type PreparedCopyMoveItem,
  type SharedRootMeta,
} from './dial-file-manager.model';
import type { DialFilesApi } from './dial-files-api';

export const mapCorePermissions = (
  permissions?: string[],
): DialFile['permissions'] | undefined => {
  if (!permissions?.length) return undefined;
  const mapped = permissions
    .map((permission) => CORE_PERMISSION_MAP[permission.toUpperCase()])
    .filter(
      (permission): permission is (typeof CORE_PERMISSION_MAP)[string] =>
        permission != null,
    );
  return mapped.length > 0 ? mapped : undefined;
};

export const findFirstSuccessfulCopyMoveItem = <
  TDto extends {
    success?: boolean;
    sourcePath?: string;
    destinationPath?: string;
  },
>(
  items: PreparedCopyMoveItem<TDto>[],
  results: {
    success?: boolean;
    sourcePath?: string;
    destinationPath?: string;
  }[],
): PreparedCopyMoveItem<TDto> | undefined => {
  const firstSuccessfulResult = results.find((result) => result.success);
  if (firstSuccessfulResult == null) return undefined;

  return (
    items.find(
      ({ dto }) =>
        dto.sourcePath === firstSuccessfulResult.sourcePath &&
        dto.destinationPath === firstSuccessfulResult.destinationPath,
    ) ??
    items.find(
      ({ dto }) =>
        dto.destinationPath === firstSuccessfulResult.destinationPath,
    ) ??
    items[0]
  );
};

export const buildFromCache = (
  cache: Map<string, ListFilesItemDto[]>,
  listingPermissionsCache: Map<string, string[] | undefined>,
  apiPath: string,
  virtualBasePath: string,
  folderId: string,
): DialFile[] => {
  const flat = cache.get(apiPath);
  if (flat == null) return [];

  const parentPathBase = virtualBasePath.replace(/\/$/, '');

  return flat.map((item): DialFile => {
    const isFolder = item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder;
    /*
     * DIAL Core returns `name` already decoded (only `url` is percent-encoded).
     * Decoding it again corrupts names that legitimately contain percent
     * escapes — `a%2Fb.txt` would split into a phantom folder and the row would
     * vanish, `a%20b.pdf` would resolve to a path DIAL Core does not have.
     */
    const name = item.name;
    const virtualPath = isFolder
      ? `${parentPathBase}/${name}/`
      : `${parentPathBase}/${name}`;

    const base: DialFile = {
      id: item.path,
      name,
      path: virtualPath,
      url: item.url,
      parentPath: virtualBasePath,
      nodeType: isFolder ? DialFileNodeType.FOLDER : DialFileNodeType.ITEM,
      folderId,
      bucket: item.bucket,
      author: item.author,
      resourceType: item.resourceType as DialFile['resourceType'],
      contentLength: item.contentLength,
      contentType: item.contentType,
      updatedAt: item.updatedAt
        ? new Date(item.updatedAt).toISOString()
        : undefined,
    };

    if (isFolder) {
      const folderApiPath = `${apiPath}${name}/`;
      base.permissions =
        mapCorePermissions(item.permissions) ??
        mapCorePermissions(listingPermissionsCache.get(folderApiPath));
      base.items = buildFromCache(
        cache,
        listingPermissionsCache,
        folderApiPath,
        virtualPath,
        item.path,
      );
    }

    return base;
  });
};

export const mergeCreatedFolderIntoCache = (
  cache: Map<string, ListFilesItemDto[]>,
  parentApiPath: string,
  created: CreateFolderResponseDto,
  inheritedPermissions?: string[],
): Map<string, ListFilesItemDto[]> => {
  const next = new Map(cache);
  const parentItems = [...(next.get(parentApiPath) ?? [])];
  const folderItem: ListFilesItemDto = {
    name: created.name,
    path: created.path,
    folderId: created.folderId,
    nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
    bucket: created.bucket,
    parentPath: created.parentPath || undefined,
    url: created.path,
    permissions: inheritedPermissions,
  };

  if (
    !parentItems.some(
      (item) => item.name.toLowerCase() === created.name.toLowerCase(),
    )
  ) {
    parentItems.push(folderItem);
  }

  next.set(parentApiPath, parentItems);
  return next;
};

export const updateEntry = (
  prev: FileUploadBatchState | null,
  id: string,
  patch:
    | FileUploadStatus
    | Partial<Pick<FileUploadEntry, 'status' | 'percent' | 'failureReason'>>,
): FileUploadBatchState | null => {
  if (!prev) return prev;
  const changes = typeof patch === 'string' ? { status: patch } : patch;
  const files = prev.files.map((f) => (f.id === id ? { ...f, ...changes } : f));
  return { ...prev, files };
};

const FAILURE_REASON_BY_STATUS: Record<number, FileUploadFailureReason> = {
  403: FileUploadFailureReason.Forbidden,
  409: FileUploadFailureReason.Conflict,
  413: FileUploadFailureReason.TooLarge,
  502: FileUploadFailureReason.Unavailable,
  503: FileUploadFailureReason.Unavailable,
};

/*
 * A request that never got a response: the XHR upload's own error, the
 * generated client's `FetchError` (it wraps a rejected `fetch`), or a bare
 * `fetch` `TypeError`. `FetchError` is matched by name so this file does not
 * import the generated runtime.
 */
const isNoResponseError = (error: unknown): boolean =>
  error instanceof UploadNetworkError ||
  error instanceof TypeError ||
  (error instanceof Error && error.name === 'FetchError');

/** Resolves why an upload or download request failed from its rejection: the HTTP status when there is a response, `Network` when there was none. */
export const resolveTransferFailureReason = async (
  error: unknown,
): Promise<FileUploadFailureReason> => {
  if (isNoResponseError(error)) return FileUploadFailureReason.Network;
  const { status } = await getApiErrorDetails(error);
  return (
    (status != null ? FAILURE_REASON_BY_STATUS[status] : undefined) ??
    FileUploadFailureReason.Unknown
  );
};

/** Upload-named alias of {@link resolveTransferFailureReason}, kept for existing callers. */
export const resolveUploadFailureReason = resolveTransferFailureReason;

export const fetchByTab = (
  filesApi: DialFilesApi,
  tab: DialFileManagerTabs,
  bucket: string,
  folderPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
): Promise<{ items: ListFilesItemDto[]; permissions?: string[] }> => {
  // All is a composed view with no listing source of its own.
  if (tab === DialFileManagerTabs.All) {
    return Promise.reject(
      new Error(
        'fetchByTab cannot list the All tab; list each section instead',
      ),
    );
  }
  if (tab === DialFileManagerTabs.Shared) {
    if (folderPath === '') {
      return filesApi
        .listSharedFiles({ path: undefined })
        .then((res) => ({ items: res.items }));
    }
    /*
     * Navigating inside a shared folder — find the owner bucket from the root meta
     * and call listFiles against their bucket with the correct relative path.
     */
    const firstSlash = folderPath.indexOf('/');
    const sharedRootName =
      firstSlash === -1 ? folderPath : folderPath.slice(0, firstSlash);
    const meta = sharedRootMeta.get(sharedRootName);
    if (meta) {
      const rootPathInBucket = dialCorePathToRelative(
        meta.dialCorePath,
        meta.bucket,
      );
      const subPath = firstSlash === -1 ? '' : folderPath.slice(firstSlash + 1);
      const actualPath = rootPathInBucket + subPath;
      return filesApi
        .listFiles({
          bucket: meta.bucket,
          path: actualPath,
          permissions: true,
        })
        .then((res) => ({ items: res.items, permissions: res.permissions }));
    }
    return Promise.resolve({ items: [] });
  }
  if (tab === DialFileManagerTabs.Organization) {
    return filesApi
      .listPublicFiles({ path: folderPath || undefined })
      .then((res) => ({ items: res.items }));
  }
  return filesApi
    .listFiles({
      bucket,
      path: folderPath,
      permissions: true,
    })
    .then((res) => ({ items: res.items, permissions: res.permissions }));
};

export const fetchForSearch = async (
  filesApi: DialFilesApi,
  tab: DialFileManagerTabs,
  bucket: string,
  folderPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
): Promise<{ items: ListFilesItemDto[] }> => {
  if (tab === DialFileManagerTabs.Shared) {
    /*
     * Shared root is handled via client-side cache filter in onSearchFiles.
     * This branch only runs for nested shared folders.
     */
    const firstSlash = folderPath.indexOf('/');
    const sharedRootName =
      firstSlash === -1 ? folderPath : folderPath.slice(0, firstSlash);
    const meta = sharedRootMeta.get(sharedRootName);
    if (!meta) return { items: [] };
    const rootPathInBucket = dialCorePathToRelative(
      meta.dialCorePath,
      meta.bucket,
    );
    const subPath = firstSlash === -1 ? '' : folderPath.slice(firstSlash + 1);
    const actualPath = rootPathInBucket + subPath;
    const { items } = await filesApi.listFiles({
      bucket: meta.bucket,
      path: actualPath,
      permissions: true,
      recursive: true,
    });
    return { items };
  }
  if (tab === DialFileManagerTabs.Organization) {
    const { items } = await filesApi.listPublicFiles({
      path: folderPath || undefined,
      recursive: true,
    });
    return { items };
  }
  const { items } = await filesApi.listFiles({
    bucket,
    path: folderPath,
    permissions: true,
    recursive: true,
  });
  return { items };
};

/**
 * Where search results sit in the virtual tree. Shared items are listed flat
 * (a file nested in the owner's bucket is still a root row), so their virtual
 * path cannot be derived from the location inside the owner's bucket.
 */
export interface SearchPathScope {
  /** Virtual path of the folder the search runs in, e.g. `/Shared with me`. */
  virtualRoot: string;
  /** Bucket-relative path of that folder; omitted when results are flat children of `virtualRoot`. */
  apiRoot?: string;
}

/**
 * Builds the scope for a search on the Shared tab so result rows get the same
 * `path` as the rows `buildFromCache` produces for the same items.
 */
export const buildSharedSearchScope = (
  rootLabel: string,
  folderPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
): SearchPathScope | undefined => {
  if (folderPath === '') return { virtualRoot: `/${rootLabel}` };
  const firstSlash = folderPath.indexOf('/');
  const sharedRootName =
    firstSlash === -1 ? folderPath : folderPath.slice(0, firstSlash);
  const meta = sharedRootMeta.get(sharedRootName);
  if (!meta) return undefined;
  const subPath = firstSlash === -1 ? '' : folderPath.slice(firstSlash + 1);
  return {
    virtualRoot: `/${rootLabel}/${folderPath.replace(/\/$/, '')}`,
    apiRoot: dialCorePathToRelative(meta.dialCorePath, meta.bucket) + subPath,
  };
};

const toDecodedSegments = (path: string): string[] =>
  path.split('/').filter(Boolean).map(safeDecodeURI);

export const mapSearchItem = (
  item: ListFilesItemDto,
  fallbackBucket: string,
  rootLabel: string,
  scope?: SearchPathScope,
): DialFile => {
  const isFolder = item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder;
  // `name` arrives decoded from DIAL Core — see the note in `buildFromCache`.
  const name = item.name;
  const itemBucket = item.bucket ?? fallbackBucket;
  const dialCorePath = item.url ?? item.path ?? '';
  const relativePath = dialCorePathToRelative(dialCorePath, itemBucket);
  const relativeStripped = relativePath.replace(/\/$/, '');
  const lastSlash = relativeStripped.lastIndexOf('/');
  const parentRelative =
    lastSlash > 0 ? relativeStripped.slice(0, lastSlash) : '';
  /*
   * The parent path is derived from the percent-encoded DIAL Core url, so its
   * segments have to be decoded to land in the same virtual-path space as the
   * rows `buildFromCache` produces.
   */
  let virtualParentPath: string;
  if (scope) {
    const parentSegments = scope.apiRoot
      ? toDecodedSegments(parentRelative).slice(
          toDecodedSegments(scope.apiRoot).length,
        )
      : [];
    virtualParentPath = [scope.virtualRoot, ...parentSegments].join('/');
  } else {
    virtualParentPath = buildSharedItemVirtualPath(
      parentRelative,
      rootLabel,
      false,
    );
  }
  const virtualPath = isFolder
    ? `${virtualParentPath}/${name}/`
    : `${virtualParentPath}/${name}`;

  return {
    id: item.path,
    name,
    path: virtualPath,
    url: item.url,
    parentPath: virtualParentPath,
    nodeType: isFolder ? DialFileNodeType.FOLDER : DialFileNodeType.ITEM,
    folderId: item.folderId,
    bucket: itemBucket,
    author: item.author,
    contentLength: item.contentLength,
    contentType: item.contentType,
    updatedAt: item.updatedAt
      ? new Date(item.updatedAt).toISOString()
      : undefined,
  };
};

/**
 * Overlays a `FileMetadataResponseDto` response onto the clicked grid row so
 * `fileMetadataPopupOptions.fileMetadata` receives a value structurally
 * consistent with any other `DialFile` — the row already carries the correct
 * virtual `path`/`id`/`name`/`nodeType`/`folderId`, while size/date/author/
 * permissions are refreshed from the just-fetched server response.
 */
export const mapFileMetadataToDialFile = (
  metadata: FileMetadataResponseDto,
  original: DialFile,
): DialFile => ({
  ...original,
  bucket: metadata.bucket ?? original.bucket,
  author: metadata.author,
  contentLength: metadata.contentLength,
  contentType: metadata.contentType,
  resourceType:
    (metadata.resourceType as DialFile['resourceType']) ??
    original.resourceType,
  permissions: mapCorePermissions(metadata.permissions) ?? original.permissions,
  updatedAt: metadata.updatedAt
    ? new Date(metadata.updatedAt).toISOString()
    : original.updatedAt,
  createdAt: metadata.createdAt
    ? new Date(metadata.createdAt).toISOString()
    : original.createdAt,
});
