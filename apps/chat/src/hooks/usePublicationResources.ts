import { useMemo } from 'react';

import { isRootId } from '@/src/utils/app/id';
import { getIdWithoutVersionFromApiKey } from '@/src/utils/server/api';

import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';
import { PublicationResource } from '@/src/types/publication';

import { ConversationInfo } from '@epam/ai-dial-shared';
import minBy from 'lodash-es/minBy';
import uniqBy from 'lodash-es/uniqBy';

export const usePublicationResources = <
  T extends PromptInfo | ConversationInfo | DialFile,
>(
  allFolders: FolderInterface[],
  resources: PublicationResource[],
  items: T[],
) => {
  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );

  const groupedItems = useMemo(() => {
    return uniqBy(items, (entity) => getIdWithoutVersionFromApiKey(entity.id));
  }, [items]);

  const { itemsToDisplay, folderItemsToDisplay } = useMemo(() => {
    return groupedItems.reduce<{
      itemsToDisplay: T[];
      folderItemsToDisplay: T[];
    }>(
      (acc, item) => {
        if (!resourceUrls.includes(item.id)) return acc;

        if (isRootId(item.folderId)) {
          acc.itemsToDisplay.push(item);
        } else {
          acc.folderItemsToDisplay.push(item);
        }
        return acc;
      },
      { itemsToDisplay: [], folderItemsToDisplay: [] },
    );
  }, [groupedItems, resourceUrls]);

  const rootPublicationFolders = useMemo(() => {
    return uniqBy(
      resourceUrls.map((url) =>
        minBy(
          allFolders.filter((folder) => url.startsWith(`${folder.id}/`)),
          (folder) => folder.id.split('/').length,
        ),
      ),
      'id',
    ).filter((folder) => !!folder);
  }, [allFolders, resourceUrls]);

  const allPublicationFolders = useMemo(
    () =>
      allFolders.filter((f) =>
        folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
      ),
    [allFolders, folderItemsToDisplay],
  );

  return {
    itemsToDisplay,
    folderItemsToDisplay,
    rootPublicationFolders,
    allPublicationFolders,
  };
};
