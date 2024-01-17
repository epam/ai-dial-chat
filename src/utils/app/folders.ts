import {
  constructPath,
  notAllowedSymbols,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';

import { Conversation } from '@/src/types/chat';
import { ShareEntity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { EntityFilters } from '@/src/types/search';

import escapeStringRegexp from 'escape-string-regexp';

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

export const getChildAndCurrentFoldersById = (
  folderId: string | undefined,
  allFolders: FolderInterface[],
) => {
  if (!folderId) {
    return [];
  }

  const currentFolder = allFolders.find((folder) => folder.id === folderId);
  const childFolders = allFolders.filter(
    (folder) => folder.folderId === folderId,
  );

  const childFoldersArray: FolderInterface[] = childFolders.flatMap(
    (childFolder) => getChildAndCurrentFoldersById(childFolder.id, allFolders),
  );

  return currentFolder
    ? [currentFolder].concat(childFoldersArray)
    : childFoldersArray;
};

export const getChildAndCurrentFoldersIdsById = (
  folderId: string | undefined,
  allFolders: FolderInterface[],
) =>
  getChildAndCurrentFoldersById(folderId, allFolders).map(
    (folder) => folder.id,
  );

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
  includingPublishedWithMe = false,
) => {
  const prefix = `${defaultName} `;
  const regex = new RegExp(`^${escapeStringRegexp(prefix)}(\\d{1,3})$`);

  if (!entities.length) {
    return `${prefix}${1 + index}`;
  }

  const maxNumber = Math.max(
    ...entities
      .filter(
        (entity) =>
          !entity.sharedWithMe &&
          (!entity.publishedWithMe || includingPublishedWithMe) &&
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
  const path: string[] = [];
  const createPath = (folderId: string) => {
    const folder = folders.find((folder) => folder.id === folderId);
    if (!folder) return;

    path.unshift(folder.name);

    if (folder.folderId) {
      createPath(folder.folderId);
    }
  };

  if (starterId) {
    createPath(starterId);
  }

  return { path: constructPath(...path), pathDepth: path.length - 1 };
};

export const getFilteredFolders = (
  folders: FolderInterface[],
  emptyFolderIds: string[],
  filters: EntityFilters,
  entities: Conversation[] | Prompt[],
  searchTerm?: string,
  includeEmptyFolders?: boolean,
) => {
  const folderIds = entities.map((c) => c.folderId).filter((fid) => fid);

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

export const getParentAndChildFolders = (
  allFolders: FolderInterface[],
  folders: FolderInterface[],
) => {
  const folderIds = folders.map(({ id }) => id);

  const setFolders = new Set(
    folderIds.flatMap((folderId) => [
      ...getParentAndCurrentFoldersById(allFolders, folderId),
      ...getChildAndCurrentFoldersById(folderId, allFolders),
    ]),
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

export const validateFolderRenaming = (
  folders: FolderInterface[],
  newName: string,
  folderId: string,
  mustBeUnique = true,
) => {
  const renamingFolder = folders.find((folder) => folder.id === folderId);
  if (mustBeUnique) {
    const folderWithSameName = folders.find(
      (folder) =>
        folder.name === newName.trim() &&
        folderId !== folder.id &&
        folder.folderId === renamingFolder?.folderId,
    );

    if (folderWithSameName) {
      return 'Not allowed to have folders with same names';
    }
  }

  if (newName.match(notAllowedSymbolsRegex)) {
    return `The symbols ${notAllowedSymbols.join(
      '',
    )} are not allowed in folder name`;
  }
};
