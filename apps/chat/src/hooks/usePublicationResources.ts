import { useMemo } from 'react';

import { isRootId } from '@/src/utils/app/id';
import { getIdWithoutVersionFromApiKey } from '@/src/utils/server/api';

import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';
import { PublicationResource } from '@/src/types/publication';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { ConversationInfo } from '@epam/ai-dial-shared';
import minBy from 'lodash-es/minBy';
import uniqBy from 'lodash-es/uniqBy';

const deduplicateByVersion = <T extends { id: string }>(
  items: T[],
  selectedItem: T | undefined,
): T[] => {
  const seen: Record<string, T> = {};

  for (const item of items) {
    const baseId = getIdWithoutVersionFromApiKey(item.id);

    if (!seen[baseId] || item.id === selectedItem?.id) {
      seen[baseId] = item;
    }
  }

  return Object.values(seen);
};

export const usePublicationResources = <
  T extends PromptInfo | ConversationInfo | DialFile,
>(
  allFolders: FolderInterface[],
  resources: PublicationResource[],
  items: T[],
) => {
  // find selected items only which could be displayed in sidebars to avoid duplicates and highlight items properly
  const selectedPromptId = useAppSelector(
    (state) => PromptsSelectors.selectSelectedPromptId(state).selectedPromptId,
  );
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const allSelectedIds = useMemo(
    () =>
      selectedPromptId
        ? [selectedPromptId, ...selectedConversationIds]
        : selectedConversationIds,
    [selectedPromptId, selectedConversationIds],
  );

  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );

  const { rootItems, folderItems } = useMemo(() => {
    return items.reduce<{
      rootItems: T[];
      folderItems: T[];
    }>(
      (acc, item) => {
        if (!resourceUrls.includes(item.id)) return acc;

        if (isRootId(item.folderId)) {
          acc.rootItems.push(item);
        } else {
          acc.folderItems.push(item);
        }
        return acc;
      },
      { rootItems: [], folderItems: [] },
    );
  }, [resourceUrls, items]);

  const selectedItem = useMemo(
    () =>
      [...rootItems, ...folderItems].find((item) =>
        allSelectedIds.includes(item.id),
      ),
    [rootItems, folderItems, allSelectedIds],
  );
  const itemsToDisplay = useMemo(
    () => deduplicateByVersion(rootItems, selectedItem),
    [rootItems, selectedItem],
  );
  const folderItemsToDisplay = useMemo(
    () => deduplicateByVersion(folderItems, selectedItem),
    [folderItems, selectedItem],
  );

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
