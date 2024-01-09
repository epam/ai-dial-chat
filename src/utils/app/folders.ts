import { ShareEntity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';

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
    ? childFolders
        .map((childFolder) =>
          getChildAndCurrentFoldersIdsById(childFolder.id, allFolders),
        )
        .flat()
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
