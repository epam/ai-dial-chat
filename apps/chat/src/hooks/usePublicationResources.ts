import { useMemo } from 'react';

import { isRootId } from '../utils/app/id';

import { ConversationInfo } from '../types/chat';
import { ShareEntity } from '../types/common';
import { DialFile } from '../types/files';
import { FolderInterface } from '../types/folder';
import { PromptInfo } from '../types/prompt';
import { PublicationResource } from '../types/publication';

import uniqBy from 'lodash-es/uniqBy';

export const usePublicationResources = <
  T extends PromptInfo | ConversationInfo | DialFile,
>(
  allFolders: FolderInterface[],
  resources: PublicationResource[],
  items: T[],
  rootFolder?: ShareEntity,
) => {
  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );
  const itemsToDisplay = useMemo(() => {
    return items.filter(
      (item) =>
        item.folderId.split('/').length === 2 && resourceUrls.includes(item.id),
    );
  }, [items, resourceUrls]);
  const folderItemsToDisplay = useMemo(() => {
    return items.filter(
      (item) =>
        item.folderId.split('/').length !== 2 && resourceUrls.includes(item.id),
    );
  }, [items, resourceUrls]);
  const rootFolders = useMemo(() => {
    if (rootFolder) return allFolders.filter((f) => f.id === rootFolder.id);

    const folders = resources.map((resource) => {
      const relevantFolders = allFolders.filter((folder) =>
        resource.reviewUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [allFolders, resources, rootFolder]);

  return {
    itemsToDisplay,
    folderItemsToDisplay,
    rootFolders,
  };
};
