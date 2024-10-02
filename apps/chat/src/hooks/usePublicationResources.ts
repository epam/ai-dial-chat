import { useMemo } from 'react';

import { isRootId } from '../utils/app/id';

import { DialFile } from '../types/files';
import { FolderInterface } from '../types/folder';
import { PromptInfo } from '../types/prompt';
import { PublicationResource } from '../types/publication';

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
  const itemsToDisplay = useMemo(
    () =>
      items.filter(
        (item) => isRootId(item.folderId) && resourceUrls.includes(item.id),
      ),
    [items, resourceUrls],
  );
  const folderItemsToDisplay = useMemo(
    () =>
      items.filter(
        (item) => !isRootId(item.folderId) && resourceUrls.includes(item.id),
      ),
    [items, resourceUrls],
  );
  const rootFolders = useMemo(() => {
    return uniqBy(
      resourceUrls.map((url) =>
        minBy(
          allFolders.filter((f) => url.startsWith(`${f.id}/`)),
          (item) => item.id.split('/').length,
        ),
      ),
      'id',
    ).filter(Boolean) as FolderInterface[];
  }, [allFolders, resourceUrls]);

  return {
    itemsToDisplay,
    folderItemsToDisplay,
    rootFolders,
  };
};
