import { HighlightColor } from '@/src/types/common';
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

export function getByHighlightColor(
  highlightColor: HighlightColor,
  greenColor: string,
  violetColor: string,
  defaultColor?: string,
) {
  switch (highlightColor) {
    case HighlightColor.Green:
      return greenColor;
    case HighlightColor.Violet:
      return violetColor;
    default:
      return defaultColor || '';
  }
}

export const getNextDefaultName = (
  defaultName: string,
  entities: Entity[],
  index = 0,
) => {
  const prefix = `${defaultName} `;
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  if (!entities.length) {
    return `${prefix}${1 + index}`;
  }

  const numeredEntities = entities
    .filter((entity) => entity.name.match(regex))
    .map((entity) => entity.name.replace(prefix, '').trim())
    .sort()
    .reverse(); // max number

  return `${prefix}${
    (numeredEntities.length ? parseInt(numeredEntities[0]) + 1 : 1) + index
  }`;
};
