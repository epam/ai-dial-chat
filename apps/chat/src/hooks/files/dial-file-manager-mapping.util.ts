import type {
  CreateFolderResponseDto,
  FileMetadataResponseDto,
  ListFilesItemDto,
} from '@epam/ai-dial-chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerTabs,
  DialFileNodeType,
} from '@epam/ai-dial-react-file-manager';
import type {
  FileUploadBatchState,
  FileUploadEntry,
  FileUploadStatus,
} from '../../components/DialFileManagerModal/types/upload';
import {
  listFiles,
  listPublicFiles,
  listSharedFiles,
} from '../../server-api/files.api';
import { safeDecodeURI } from '../../utils/string-utils';
import { dialCorePathToRelative } from './dial-file-manager-path.util';
import {
  CORE_PERMISSION_MAP,
  type PreparedCopyMoveItem,
  type SharedRootMeta,
} from './dial-file-manager.model';

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
    const name = safeDecodeURI(item.name);
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
  index: number,
  patch:
    | FileUploadStatus
    | Partial<Pick<FileUploadEntry, 'status' | 'percent'>>,
): FileUploadBatchState | null => {
  if (!prev) return prev;
  const changes = typeof patch === 'string' ? { status: patch } : patch;
  const files = prev.files.map((f, i) =>
    i === index ? { ...f, ...changes } : f,
  );
  return { ...prev, files };
};

export const fetchByTab = (
  tab: DialFileManagerTabs,
  bucket: string,
  folderPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
): Promise<{ items: ListFilesItemDto[]; permissions?: string[] }> => {
  if (tab === DialFileManagerTabs.Shared) {
    if (folderPath === '') {
      return listSharedFiles({ path: undefined }).then((res) => ({
        items: res.items,
      }));
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
      return listFiles({
        bucket: meta.bucket,
        path: actualPath,
        permissions: true,
      }).then((res) => ({ items: res.items, permissions: res.permissions }));
    }
    return Promise.resolve({ items: [] });
  }
  if (tab === DialFileManagerTabs.Organization) {
    return listPublicFiles({ path: folderPath || undefined }).then((res) => ({
      items: res.items,
    }));
  }
  return listFiles({
    bucket,
    path: folderPath,
    permissions: true,
  }).then((res) => ({ items: res.items, permissions: res.permissions }));
};

export const fetchForSearch = async (
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
    const { items } = await listFiles({
      bucket: meta.bucket,
      path: actualPath,
      permissions: true,
      recursive: true,
    });
    return { items };
  }
  if (tab === DialFileManagerTabs.Organization) {
    const { items } = await listPublicFiles({
      path: folderPath || undefined,
      recursive: true,
    });
    return { items };
  }
  const { items } = await listFiles({
    bucket,
    path: folderPath,
    permissions: true,
    recursive: true,
  });
  return { items };
};

export const mapSearchItem = (
  item: ListFilesItemDto,
  fallbackBucket: string,
  rootLabel: string,
): DialFile => {
  const isFolder = item.nodeType === ListFilesItemDtoNodeTypeEnum.Folder;
  const name = safeDecodeURI(item.name);
  const itemBucket = item.bucket ?? fallbackBucket;
  const dialCorePath = item.url ?? item.path ?? '';
  const relativePath = dialCorePathToRelative(dialCorePath, itemBucket);
  const relativeStripped = relativePath.replace(/\/$/, '');
  const lastSlash = relativeStripped.lastIndexOf('/');
  const parentRelative =
    lastSlash > 0 ? relativeStripped.slice(0, lastSlash) : '';
  const virtualParentPath = parentRelative
    ? `/${rootLabel}/${parentRelative}`
    : `/${rootLabel}`;
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
