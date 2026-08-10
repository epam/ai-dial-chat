import { compareEntitiesByName } from '@/src/utils/app/folders';
import { getEntityBucket, getFileRootId, isRootId } from '@/src/utils/app/id';

import { ApiKeys } from '@/src/types/common';
import { DialFile, FileFolderInterface } from '@/src/types/files';
import { EntityFilters } from '@/src/types/search';

import { BucketService } from './data/bucket-service';

import { SharePermission, UploadStatus } from '@epam/ai-dial-shared';
import {
  DialFileNodeType,
  DialFilePermission,
  DialFileResourceType,
  DialFile as UIKitDialFile,
} from '@epam/ai-dial-ui-kit';

export interface DialRootFolder extends UIKitDialFile {
  label: string;
}

const isChildOfFolders = (
  folderId: string,
  parentFolderIds: Set<string>,
): boolean => {
  return Array.from(parentFolderIds).some((parentId) =>
    folderId.startsWith(parentId),
  );
};

export const filterFilesByFilters = (
  files: DialFile[],
  filters: EntityFilters,
  fileRootId?: string,
): DialFile[] => {
  const directMatches = files.filter(
    (file) => filters.sectionFilter?.(file) ?? true,
  );

  const matchedFolderIds =
    directMatches.length > 0 || !fileRootId
      ? new Set(directMatches.map((file) => file.folderId).filter(Boolean))
      : new Set([fileRootId]);

  return files.filter((file) => {
    if (filters.sectionFilter?.(file)) return true;

    if (file.folderId && isChildOfFolders(file.folderId, matchedFolderIds))
      return true;

    return false;
  });
};

export const filterFoldersByFilters = (
  folders: FileFolderInterface[],
  filters: EntityFilters,
): FileFolderInterface[] => {
  const rootMatches = folders.filter(
    (folder) => filters.sectionFilter?.(folder) ?? true,
  );

  if (rootMatches.length === 0) return [];

  const rootFolderIds = new Set(rootMatches.map((f) => f.id));

  const result = folders.filter((folder) => {
    if (filters.sectionFilter?.(folder)) return true;

    if (isChildOfFolders(folder.folderId, rootFolderIds)) return true;

    return false;
  });

  return result;
};

const PermissionMap: Record<SharePermission, DialFilePermission> = {
  [SharePermission.READ]: DialFilePermission.READ,
  [SharePermission.WRITE]: DialFilePermission.WRITE,
};

const uiKitFileCache = new Map<
  string,
  { source: DialFile; result: UIKitDialFile }
>();

const isSameForUIKitFile = (a: DialFile, b: DialFile): boolean =>
  a.id === b.id &&
  a.name === b.name &&
  a.folderId === b.folderId &&
  a.isRootSharedItem === b.isRootSharedItem &&
  a.contentLength === b.contentLength &&
  a.contentType === b.contentType &&
  a.updatedAt === b.updatedAt &&
  a.author === b.author &&
  a.permissions === b.permissions;

export const convertToUIKitFile = (file: DialFile): UIKitDialFile => {
  const cached = uiKitFileCache.get(file.id);
  if (cached && isSameForUIKitFile(cached.source, file)) {
    return cached.result;
  }

  const fullPath = file.id;
  const folderId = file.isRootSharedItem ? '' : file.folderId;

  const parentPath = file.folderId || null;

  const result: UIKitDialFile = {
    id: file.id,
    name: file.name,
    path: fullPath,
    folderId,
    nodeType: DialFileNodeType.ITEM,
    resourceType: DialFileResourceType.FILE,
    contentLength: file.contentLength,
    contentType: file.contentType,
    updatedAt: file.updatedAt ? String(file.updatedAt) : undefined,
    author: file.author,
    parentPath,
    extension: file.name.includes('.') ? file.name.split('.').pop() : undefined,
    permissions: file.permissions?.map((p) => PermissionMap[p]),
  };

  uiKitFileCache.set(file.id, { source: file, result });
  return result;
};

export const convertToUIKitFolder = (
  folder: FileFolderInterface,
  childItems: UIKitDialFile[] = [],
): UIKitDialFile => {
  const fullPath = folder.id;

  const folderId = folder.isRootSharedItem ? '' : folder.folderId;

  const parentPath = folder.folderId || null;

  const permissions = folder.isRootSharedItem
    ? folder.permissions
        ?.filter((p) => p !== SharePermission.WRITE)
        .map((p) => PermissionMap[p])
    : folder.permissions?.map((p) => PermissionMap[p]);

  return {
    id: folder.id,
    name: folder.name,
    author: folder.author,
    path: fullPath,
    folderId,
    nodeType: DialFileNodeType.FOLDER,
    items: childItems,
    parentPath,
    updatedAt: folder.updatedAt ? String(folder.updatedAt) : undefined,
    permissions,
  };
};

const sortItemsByName = (items: UIKitDialFile[]): UIKitDialFile[] =>
  [...items]
    .sort(compareEntitiesByName)
    .map((item) =>
      item.items ? { ...item, items: sortItemsByName(item.items) } : item,
    );

const ensureFolderChain = (
  folderMap: Map<string, UIKitDialFile>,
  folderId?: string,
) => {
  let currentId = folderId;
  while (currentId && !isRootId(currentId) && !folderMap.has(currentId)) {
    const slashIndex = currentId.lastIndexOf('/');
    if (slashIndex === -1) break;
    const parentId = currentId.slice(0, slashIndex);
    const name = currentId.slice(slashIndex + 1);
    folderMap.set(currentId, {
      id: currentId,
      name,
      path: currentId,
      folderId: parentId,
      nodeType: DialFileNodeType.FOLDER,
      items: [],
      parentPath: parentId || null,
      permissions: [],
    });
    currentId = parentId;
  }
};

export const buildFileTree = (
  files: DialFile[],
  folders: FileFolderInterface[],
  pathRootAlias?: string,
  rootId?: string,
): {
  rootFolder: DialRootFolder;
  items: UIKitDialFile[];
  loadedFoldersPaths: Set<string>;
  sharedByMePaths: Set<string>;
} => {
  const fileDataMap = new Map<string, DialFile>();
  files.forEach((file) => {
    fileDataMap.set(file.id, file);
  });

  const folderDataMap = new Map<string, FileFolderInterface>();
  folders.forEach((folder) => {
    folderDataMap.set(folder.id, folder);
  });

  const uikitFiles = files.map(convertToUIKitFile);

  const folderMap = new Map<string, UIKitDialFile>();
  const rootItems: UIKitDialFile[] = [];

  const loadedFoldersPaths = new Set(
    folders.filter((f) => f.status === UploadStatus.LOADED).map((f) => f.id),
  );

  const sharedByMePaths = new Set(
    files.filter((f) => f.isShared && !f.sharedWithMe).map((f) => f.id),
  );

  const sortedFolders = [...folders].sort((a, b) => {
    const depthA = a.id.split('/').length;
    const depthB = b.id.split('/').length;
    return depthA - depthB;
  });

  sortedFolders.forEach((folder) => {
    const uikitFolder = convertToUIKitFolder(folder, []);
    folderMap.set(folder.id, uikitFolder);

    if (folder.isShared && !folder.sharedWithMe) {
      sharedByMePaths.add(folder.id);
    }
  });

  files.forEach((file) => {
    if (file.isRootSharedItem) return;
    ensureFolderChain(folderMap, file.folderId);
  });
  folders.forEach((folder) => {
    if (folder.isRootSharedItem) return;
    ensureFolderChain(folderMap, folder.folderId);
  });

  const placedFolderIds = new Set<string>();
  const placedFileIds = new Set<string>();

  folderMap.forEach((folder) => {
    const parentFolderId = folder.folderId;
    const parentFolder = folderMap.get(parentFolderId);

    if (parentFolder && parentFolder.items && folder.id) {
      const parentOriginalFolder = folderDataMap.get(parentFolderId);

      if (!folder.permissions || folder.permissions.length === 0) {
        folder.permissions =
          parentOriginalFolder?.permissions?.map((p) => PermissionMap[p]) || [];
      }

      parentFolder.items.push(folder);
      placedFolderIds.add(folder.id);
    }
  });

  folderMap.forEach((folder) => {
    if (folder.id && !placedFolderIds.has(folder.id)) {
      const originalFolder = folderDataMap.get(folder.id);
      if (!folder.permissions || folder.permissions.length === 0) {
        folder.permissions =
          originalFolder?.permissions?.map((p) => PermissionMap[p]) || [];
      }
      rootItems.push(folder);
    }
  });

  const effectiveRootId =
    rootId ||
    getFileRootId(getEntityBucket({ id: rootItems?.[0]?.id || '' })) ||
    getFileRootId();

  const allRootBucketIds = new Set<string>();
  allRootBucketIds.add(effectiveRootId);

  files.forEach((file) => {
    const bucket = getEntityBucket({ id: file.id });
    if (bucket) {
      allRootBucketIds.add(getFileRootId(bucket));
    }
  });
  folders.forEach((folder) => {
    const bucket = getEntityBucket({ id: folder.id });
    if (bucket) {
      allRootBucketIds.add(getFileRootId(bucket));
    }
  });

  uikitFiles.forEach((file) => {
    const parentFolderId = file.folderId;
    const parentFolder = folderMap.get(parentFolderId);

    if (parentFolder && parentFolder.items && file.id) {
      if (allRootBucketIds.has(parentFolderId)) {
        rootItems.push(file);
        placedFileIds.add(file.id);
      } else {
        parentFolder.items.push(file);
        placedFileIds.add(file.id);
      }
    }
  });

  uikitFiles.forEach((file) => {
    if (file.id && !placedFileIds.has(file.id)) {
      if (
        allRootBucketIds.has(file.folderId) ||
        file.folderId === effectiveRootId ||
        !file.folderId
      ) {
        rootItems.push(file);
      }
    }
  });

  loadedFoldersPaths.add(effectiveRootId);

  const rootFolder: DialRootFolder = {
    id: effectiveRootId,
    name: 'Files',
    path: effectiveRootId,
    folderId: '',
    nodeType: DialFileNodeType.FOLDER,
    items: sortItemsByName(rootItems),
    parentPath: null,
    label: pathRootAlias || 'Files',
    permissions:
      effectiveRootId === `${ApiKeys.Files}/${BucketService.getBucket()}`
        ? [DialFilePermission.READ, DialFilePermission.WRITE]
        : [],
  };

  return {
    rootFolder,
    items: [rootFolder],
    loadedFoldersPaths,
    sharedByMePaths,
  };
};
