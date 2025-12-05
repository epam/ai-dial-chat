import { getEntityBucket, getFileRootId } from '@/src/utils/app/id';

import { DialFile, FileFolderInterface } from '@/src/types/files';
import { EntityFilters } from '@/src/types/search';

import { UploadStatus } from '@epam/ai-dial-shared';
import {
  DialFileNodeType,
  DialFileResourceType,
  DialFile as UIKitDialFile,
} from '@epam/ai-dial-ui-kit';

export interface DialRootFolder extends UIKitDialFile {
  breadcrumbLabel: string;
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
): DialFile[] => {
  const directMatches = files.filter(
    (file) => filters.sectionFilter?.(file) ?? true,
  );

  const matchedFolderIds = new Set(
    directMatches.map((file) => file.folderId).filter(Boolean),
  );

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

export const convertToUIKitFile = (file: DialFile): UIKitDialFile => {
  const fullPath = file.id;

  const parentPath = file.folderId || null;

  return {
    id: file.id,
    name: file.name,
    path: fullPath,
    folderId: file.folderId || '',
    nodeType: DialFileNodeType.ITEM,
    resourceType: DialFileResourceType.FILE,
    contentLength: file.contentLength,
    contentType: file.contentType,
    updatedAt: file.updatedAt ? String(file.updatedAt) : undefined,
    author: undefined, // TODO: Map from file metadata when available
    parentPath,
    extension: file.name.includes('.') ? file.name.split('.').pop() : undefined,
  };
};

export const convertToUIKitFolder = (
  folder: FileFolderInterface,
  childItems: UIKitDialFile[] = [],
): UIKitDialFile => {
  const fullPath = folder.id;

  const parentPath = folder.folderId || null;

  return {
    id: folder.id,
    name: folder.name,
    path: fullPath,
    folderId: folder.folderId,
    nodeType: DialFileNodeType.FOLDER,
    items: childItems,
    parentPath,
    updatedAt: folder.updatedAt ? String(folder.updatedAt) : undefined,
  };
};

export const buildFileTree = (
  files: DialFile[],
  folders: FileFolderInterface[],
  breadcrumbLabel?: string,
): {
  rootFolder: DialRootFolder;
  items: UIKitDialFile[];
  loadedFoldersPaths: Set<string>;
} => {
  const uikitFiles = files.map(convertToUIKitFile);

  const folderMap = new Map<string, UIKitDialFile>();
  const rootItems: UIKitDialFile[] = [];

  const loadedFoldersPaths = new Set(
    folders.filter((f) => f.status === UploadStatus.LOADED).map((f) => f.id),
  );

  const sortedFolders = [...folders].sort((a, b) => {
    const depthA = a.id.split('/').length;
    const depthB = b.id.split('/').length;
    return depthA - depthB;
  });

  sortedFolders.forEach((folder) => {
    const uikitFolder = convertToUIKitFolder(folder, []);
    folderMap.set(folder.id, uikitFolder);
  });

  const placedFolderIds = new Set<string>();
  const placedFileIds = new Set<string>();

  folderMap.forEach((folder) => {
    const parentFolderId = folder.folderId;
    const parentFolder = folderMap.get(parentFolderId);

    if (parentFolder && parentFolder.items && folder.id) {
      parentFolder.items.push(folder);
      placedFolderIds.add(folder.id);
    }
  });

  folderMap.forEach((folder) => {
    if (folder.id && !placedFolderIds.has(folder.id)) {
      rootItems.push(folder);
    }
  });

  uikitFiles.forEach((file) => {
    const parentFolderId = file.folderId;
    const parentFolder = folderMap.get(parentFolderId);

    if (parentFolder && parentFolder.items && file.id) {
      parentFolder.items.push(file);
      placedFileIds.add(file.id);
    }
  });

  uikitFiles.forEach((file) => {
    if (file.id && !placedFileIds.has(file.id)) {
      rootItems.push(file);
    }
  });

  const rootId = getFileRootId(
    getEntityBucket({ id: rootItems?.[0]?.id || '' }),
  );

  const rootFolder: DialRootFolder = {
    id: rootId,
    name: 'Files',
    path: rootId,
    folderId: '',
    nodeType: DialFileNodeType.FOLDER,
    items: rootItems,
    parentPath: null,
    breadcrumbLabel: breadcrumbLabel || 'Files',
  };

  return { rootFolder, items: [rootFolder], loadedFoldersPaths };
};
