import {
  constructPath,
  getDialFilesFromAttachments,
  notAllowedSymbols,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';

import { Conversation, PrepareNameOptions } from '@/src/types/chat';
import { PartialBy } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { EntityFilters } from '@/src/types/search';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import { doesHaveDotsInTheEnd, prepareEntityName } from './common';
import { isRootId } from './id';

import {
  Attachment,
  ConversationInfo,
  Entity,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import escapeRegExp from 'lodash-es/escapeRegExp';
import sortBy from 'lodash-es/sortBy';
import uniq from 'lodash-es/uniq';

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

// TODO: refactor this and use parametrized object as single arg
export const getNextDefaultName = (
  defaultName: string,
  entities: ShareEntity[],
  index = 0,
  startWithEmptyPostfix = false,
  includingPublishedWithMe = false,
  parentFolderId?: string,
): string => {
  const prefix = `${defaultName} `;
  const regex = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);

  if (!entities.length) {
    return !startWithEmptyPostfix ? `${prefix}${1 + index}` : defaultName;
  }

  const maxNumber =
    Math.max(
      ...entities
        .filter(
          (entity) =>
            !entity.sharedWithMe &&
            (!entity.publishedWithMe || includingPublishedWithMe) &&
            (entity.name === defaultName ||
              (entity.name.match(regex) &&
                (parentFolderId ? entity.folderId === parentFolderId : true))),
        )
        .map((entity) =>
          entity.name === defaultName
            ? 0
            : parseInt(entity.name.replace(prefix, ''), 10) ||
              (startWithEmptyPostfix ? 0 : 1),
        ),
      startWithEmptyPostfix ? -1 : 0,
    ) + index; // max number

  if (maxNumber >= 9999999) {
    return getNextDefaultName(
      `${prefix}${maxNumber}`,
      entities,
      index,
      startWithEmptyPostfix,
      includingPublishedWithMe,
    );
  }

  if (startWithEmptyPostfix && maxNumber === -1) {
    return defaultName;
  }

  return `${prefix}${maxNumber + 1}`;
};

export const generateNextName = (
  defaultName: string,
  currentName: string,
  entities: ShareEntity[],
  index = 0,
) => {
  const regex = new RegExp(`^${defaultName} (\\d+)$`);
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
  options?: Partial<PrepareNameOptions & { prepareNames: boolean }>,
) => {
  const path: string[] = [];
  const createPath = (folderId: string) => {
    const folder = folders.find((folder) => folder.id === folderId);
    if (!folder) return;

    path.unshift(
      options?.prepareNames
        ? prepareEntityName(folder.name, options) || DEFAULT_FOLDER_NAME
        : folder.name,
    );

    if (folder.folderId) {
      createPath(folder.folderId);
    }
  };

  if (starterId) {
    createPath(starterId);
  }

  return { path: constructPath(...path), pathDepth: path.length - 1 };
};

interface GetFilteredFoldersProps {
  allFolders: FolderInterface[];
  emptyFolderIds: string[];
  filters: EntityFilters;
  entities: Conversation[] | Prompt[];
  searchTerm?: string;
  includeEmptyFolders?: boolean;
}

export const getFilteredFolders = ({
  allFolders,
  emptyFolderIds,
  filters,
  entities,
  searchTerm,
  includeEmptyFolders,
}: GetFilteredFoldersProps) => {
  // Get roots of section filtered items
  const sectionFilteredFolders = allFolders.filter(
    (folder) => filters.sectionFilter?.(folder) ?? true,
  );

  // Get full child tree
  const childAndCurrentSectionFilteredIds = new Set(
    sectionFilteredFolders.flatMap((folder) =>
      getChildAndCurrentFoldersIdsById(folder.id, allFolders),
    ),
  );
  // Map back to folders objects
  const childAndCurrentSectionFilteredFolders = allFolders.filter((folder) =>
    childAndCurrentSectionFilteredIds.has(folder.id),
  );

  // Apply search filters to section folders
  const searchedFolderIds = childAndCurrentSectionFilteredFolders
    .filter((folder) => filters.searchFilter?.(folder) ?? true)
    .map((f) => f.id);

  // Section filtered entities folder ids
  const entitiesFolderIds = entities
    .map((c) => c.folderId)
    .filter((fid) => childAndCurrentSectionFilteredIds.has(fid));

  // Merged final searched and filtered folders ids
  const searchedFoldersByEntitiesAndFolders = [
    ...(searchTerm?.trim().length ? [] : searchedFolderIds), // Ignore filtered folders from section if search term
    ...entitiesFolderIds,
  ];

  if (includeEmptyFolders && !searchTerm?.length) {
    searchedFoldersByEntitiesAndFolders.push(...emptyFolderIds);
  }

  // Get roots again for merged array
  const filteredFolderIds = new Set(
    searchedFoldersByEntitiesAndFolders
      .flatMap((fid) =>
        getParentAndCurrentFolderIdsById(
          childAndCurrentSectionFilteredFolders,
          fid,
        ),
      )
      .filter(
        (fid) =>
          fid && sectionFilteredFolders.map(({ id }) => id).includes(fid),
      ),
  );

  return sortByName(
    childAndCurrentSectionFilteredFolders.filter(
      (folder) =>
        childAndCurrentSectionFilteredIds.has(folder.id) &&
        filteredFolderIds.has(folder.id),
    ),
  );
};

export const getParentAndChildFolders = (
  allFolders: FolderInterface[],
  folders: FolderInterface[],
) => {
  const folderIds = folders.map(({ id }) => id);

  return uniq(
    folderIds.flatMap((folderId) => [
      ...getParentAndCurrentFoldersById(allFolders, folderId),
      ...getChildAndCurrentFoldersById(folderId, allFolders),
    ]),
  );
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
    if (isRootId(item.folderId)) return true;
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
    return `The symbols ${notAllowedSymbols} are not allowed in folder name`;
  }

  if (doesHaveDotsInTheEnd(newName)) {
    return 'Using a dot at the end of a name is not permitted.';
  }
};

export const getConversationAttachmentWithPath = <
  T extends Conversation | ConversationInfo,
>(
  conversation: T,
  folders: FolderInterface[],
): DialFile[] => {
  const { path } = getPathToFolderById(folders, conversation.folderId);
  const isReplay =
    'replay' in conversation ? conversation?.replay?.isReplay : false;
  const attachments =
    'messages' in conversation
      ? (
          conversation.playback?.messagesStack ||
          (isReplay && conversation.replay?.replayUserMessagesStack
            ? [
                ...conversation.replay.replayUserMessagesStack,
                ...conversation.messages,
              ]
            : conversation.messages)
        ).flatMap((message) => {
          const messageAttachments: Attachment[] =
            message.custom_content?.attachments || [];
          const stagesAttachments: Attachment[] =
            message.custom_content?.stages?.flatMap(
              ({ attachments }) => attachments ?? [],
            ) || [];

          return [...messageAttachments, ...stagesAttachments];
        })
      : [];

  return getDialFilesFromAttachments(attachments || []).map((file) => ({
    ...file,
    relativePath: path,
    contentLength: 0,
  }));
};

const getGeneratedFolderId = (folder: PartialBy<FolderInterface, 'id'>) =>
  constructPath(folder.folderId, folder.name);

export const addGeneratedFolderId = (
  folder: PartialBy<FolderInterface, 'id'>,
): FolderInterface => {
  const newId = getGeneratedFolderId(folder);
  if (!folder.id || newId !== folder.id) {
    return {
      ...folder,
      id: constructPath(folder.folderId, folder.name),
    };
  }
  return folder as FolderInterface;
};

// {apikey}/{bucket}/path.../name
export const splitEntityId = (
  id: string,
): {
  bucket: string;
  name: string;
  parentPath: string | undefined;
  apiKey: string;
} => {
  const parts = id.split('/');
  const parentPath =
    parts.length > 3
      ? constructPath(...parts.slice(2, parts.length - 1))
      : undefined;

  return {
    apiKey: parts[0],
    bucket: parts[1],
    parentPath,
    name: parts[parts.length - 1],
  };
};

export const getParentFolderIdsFromFolderId = (path?: string): string[] => {
  if (!path) {
    return [];
  }
  const parts = path.split('/');
  const paths = [];
  for (let i = 3; i <= parts.length; i++) {
    const path = constructPath(...parts.slice(0, i));
    paths.push(path);
  }
  return paths;
};

export const getParentFolderIdsFromEntityId = (id: string): string[] => {
  return getParentFolderIdsFromFolderId(id);
};

export const getFolderFromId = (
  id: string,
  type: FolderType,
  status?: UploadStatus,
): FolderInterface => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);
  return {
    id,
    name,
    type,
    folderId: constructPath(apiKey, bucket, parentPath),
    status,
  };
};

export const getFoldersFromIds = (
  ids: (string | undefined)[],
  type: FolderType,
  status?: UploadStatus,
): FolderInterface[] => {
  return (ids.filter(Boolean) as string[]).map((path) =>
    getFolderFromId(path, type, status),
  );
};

export const getEntitiesFoldersFromEntities = (
  entities: Conversation[] | Prompt[] | DialFile[],
  folderType: FolderType,
): FolderInterface[] => {
  const foldersIds = uniq(entities.map((info) => info.folderId));
  //calculate all folders;
  const featuresFolders = getFoldersFromIds(
    uniq(foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id))),
    folderType,
  );

  return featuresFolders;
};

export const sortByName = <T extends Entity>(entities: T[]): T[] =>
  sortBy(entities, (entity) => entity.name.toLowerCase());

export const updateMovedFolderId = (
  oldParentFolderId: string,
  newParentFolderId: string,
  folderId: string,
): string => {
  const curr = folderId;
  const old = oldParentFolderId;
  if (curr === old) {
    return newParentFolderId;
  }
  const prefix = `${old}/`;
  if (curr.startsWith(prefix)) {
    return curr.replace(old, newParentFolderId);
  }
  return folderId;
};

export const updateMovedEntityId = (
  oldParentFolderId: string,
  newParentFolderId: string,
  entityId: string,
): string => {
  const old = oldParentFolderId;
  const prefix = `${old}/`;
  if (entityId.startsWith(prefix)) {
    return entityId.replace(old, newParentFolderId);
  }
  return entityId;
};

export const getFolderIdFromEntityId = (id: string) =>
  id.split('/').slice(0, -1).join('/');

export const getRootFolderIdFromEntityId = (id: string) => {
  const splittedId = id.split('/');
  const isRootEntity = splittedId.length === 3;

  return splittedId.slice(0, isRootEntity ? 2 : 3).join('/');
};

export const isFolderEmpty = ({
  id,
  folders,
  entities,
}: {
  id: string;
  folders: FolderInterface[];
  entities: ShareEntity[];
}) => {
  return (
    !folders.some((folder) => folder.folderId === id) &&
    !entities.some((entity) => entity.folderId === id)
  );
};
