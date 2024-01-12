import { Conversation } from '@/src/types/chat';
import { ShareEntity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { EntityFilters } from '@/src/types/search';

import { selectFilteredConversations } from '@/src/store/conversations/conversations.selectors';

import { RootState } from '@/src/store';

export const getFoldersDepth = (
  childFolder: FolderInterface,
  allFolders: FolderInterface[],
): number => {
  const childFolders = allFolders.filter(
    (folder) => folder.folderId === childFolder.id,
  );

  const childDepths = childFolders.length
    ? childFolders.map((childFolder) =>
        getFoldersDepth(childFolder, allFolders),
      )
    : [0];
  const maxDepth = Math.max(...childDepths);

  return 1 + maxDepth;
};

export const getParentAndCurrentFoldersById = (
  folders: FolderInterface[],
  folderId: string | undefined,
) => {
  if (!folderId) {
    return [];
  }

  const parentFolders: FolderInterface[] = [];
  let folder = folders.find((folder) => folder.id === folderId);
  while (folder) {
    parentFolders.push(folder);

    folder = folders.find((item) => item.id === folder!.folderId);

    if (folder && parentFolders.map(({ id }) => id).includes(folder.id)) {
      break;
    }
  }

  return parentFolders;
};

export const getParentAndCurrentFolderIdsById = (
  folders: FolderInterface[],
  folderId: string | undefined,
) =>
  getParentAndCurrentFoldersById(folders, folderId).map((folder) => folder.id);

export const getChildAndCurrentFoldersIdsById = (
  folderId: string | undefined,
  allFolders: FolderInterface[],
) => {
  if (!folderId) {
    return [];
  }

  const childFolders = allFolders.filter(
    (folder) => folder.folderId === folderId,
  );

  const childFoldersIds: string[] = childFolders.length
    ? childFolders.flatMap((childFolder) =>
        getChildAndCurrentFoldersIdsById(childFolder.id, allFolders),
      )
    : [];

  return [folderId].concat(childFoldersIds);
};

export const getAvailableNameOnSameFolderLevel = (
  items: { name: string; folderId?: string }[],
  itemPrefix: string,
  parentFolderId?: string,
) => {
  const names = items
    .filter((item) => item.folderId === parentFolderId)
    .map((item) => item.name);
  let itemNumber = 0;
  let itemName;
  do {
    itemNumber++;
    itemName = [itemPrefix, itemNumber].join(' ');
  } while (names.includes(itemName));

  return itemName;
};

export const getNextDefaultName = (
  defaultName: string,
  entities: ShareEntity[],
  index = 0,
  startWithEmptyPostfix = false,
) => {
  const prefix = `${defaultName} `;
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  if (!entities.length) {
    return `${prefix}${1 + index}`;
  }

  const maxNumber = Math.max(
    ...entities
      .filter(
        (entity) =>
          !entity.sharedWithMe &&
          !entity.publishedWithMe &&
          (entity.name === defaultName || entity.name.match(regex)),
      )
      .map((entity) => parseInt(entity.name.replace(prefix, ''), 10) || 1),
    0,
  ); // max number

  if (startWithEmptyPostfix && maxNumber === 0) {
    return defaultName;
  }

  return `${prefix}${maxNumber + 1 + index}`;
};

export const generateNextName = (
  defaultName: string,
  currentName: string,
  entities: ShareEntity[],
  index = 0,
) => {
  const prefix = `${defaultName} `;
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  return currentName.match(regex)
    ? getNextDefaultName(defaultName, entities, index)
    : getNextDefaultName(currentName, entities, index, true);
};

export const getFolderIdByPath = (path: string, folders: FolderInterface[]) => {
  if (!path.trim()) return undefined;

  const parts = path.split('/');

  if (!parts.length) return undefined;

  const childFolderName = parts[parts.length - 1];

  const childFolderId = folders.find((f) => f.name === childFolderName)?.id;

  if (!childFolderId) return undefined;

  const parentFolders = getParentAndCurrentFoldersById(folders, childFolderId);
  const pathPartSet = new Set(parts);

  if (
    parentFolders.length === parts.length &&
    parentFolders.every((f) => pathPartSet.has(f.name))
  ) {
    return childFolderId;
  }

  return undefined;
};
export const getPathToFolderById = (
  folders: FolderInterface[],
  starterId: string | undefined,
) => {
  let path = '';
  const createPath = (folderId: string) => {
    const folder = folders.find((folder) => folder.id === folderId);

    const newFolderId = folder?.folderId;
    path = `${folder?.name}/${path}`;
    if (newFolderId) {
      createPath(newFolderId);
    }
  };

  if (starterId) {
    createPath(starterId);
    path = path.slice(0, -1);
  }

  return path;
};

export const getFilteredFolders = (
  state: RootState,
  folders: FolderInterface[],
  emptyFolderIds: string[],
  filters: EntityFilters,
  searchTerm?: string,
  includeEmptyFolders?: boolean,
) => {
  const filteredConversations = selectFilteredConversations(
    state,
    filters,
    searchTerm,
  );
  const folderIds = filteredConversations
    .map((c) => c.folderId)
    .filter((fid) => fid);

  if (!searchTerm?.trim().length) {
    const markedFolderIds = folders
      .filter((folder) => filters?.searchFilter(folder))
      .map((f) => f.id);
    folderIds.push(...markedFolderIds);

    if (includeEmptyFolders && !searchTerm?.length) {
      folderIds.push(...emptyFolderIds);
    }
  }

  const filteredFolderIds = new Set(
    folderIds.flatMap((fid) => getParentAndCurrentFolderIdsById(folders, fid)),
  );

  return folders.filter(
    (folder) =>
      (folder.folderId || filters.sectionFilter(folder)) &&
      filteredFolderIds.has(folder.id),
  );
};

export const filterFoldersWithSearchTerm = (
  folders: FolderInterface[],
  searchQuery: string,
) => {
  if (!searchQuery) {
    return folders;
  }

  const filtered = folders.filter(({ name }) =>
    name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const folderIds = filtered.map(({ id }) => id);

  const setFolders = new Set(
    folderIds.flatMap((folderId) =>
      getParentAndCurrentFoldersById(folders, folderId),
    ),
  );

  return Array.from(setFolders);
};

export const getTemporaryFoldersToPublish = (
  folders: FolderInterface[],
  folderId: string | undefined,
  publishVersion: string,
) => {
  if (!folderId) {
    return [];
  }

  const parentFolders = getParentAndCurrentFoldersById(folders, folderId);

  return parentFolders
    .filter((folder) => folder.temporary)
    .map(({ temporary: _, ...folder }) => {
      return {
        ...folder,
        isPublished: false,
        isShared: false,
        publishVersion,
        publishedWithMe: true,
      };
    });
};

export const findRootFromItems = (
  items: (FolderInterface | Conversation | Prompt)[],
) => {
  const parentIds = new Set(items.map((item) => item.id));

  return items.find((item) => {
    if (!item.folderId) return true;
    return !parentIds.has(item.folderId);
  });
};
