import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getChildAndCurrentFoldersIdsById,
  getEntitiesFoldersFromEntities,
} from '@/src/utils/app/folders';
import { isRootId } from '@/src/utils/app/id';
import { getMappedActions } from '@/src/utils/app/import-export';

import { Conversation } from '@/src/types/chat';
import {
  FeatureType,
  MappedReplaceActions,
  ReplaceOptions,
} from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { OnItemEvent } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';

interface UseReplaceConfirmationStateParams {
  conversations?: Conversation[];
  prompts?: Prompt[];
  duplicatedFiles?: DialFile[];
}

export const useReplaceConfirmationState = ({
  conversations,
  prompts,
  duplicatedFiles = [],
}: UseReplaceConfirmationStateParams) => {
  const allFeaturesToReplace = useMemo(
    () => [...(conversations ?? []), ...duplicatedFiles, ...(prompts ?? [])],
    [conversations, prompts, duplicatedFiles],
  );

  const [mappedActions, setMappedActions] = useState<MappedReplaceActions>(() =>
    getMappedActions(allFeaturesToReplace),
  );

  const conversationsFolders = useMemo(
    () =>
      conversations
        ? getEntitiesFoldersFromEntities(conversations, FeatureType.Chat)
        : [],
    [conversations],
  );

  const promptsFolders = useMemo(
    () =>
      prompts
        ? getEntitiesFoldersFromEntities(prompts, FeatureType.Prompt)
        : [],
    [prompts],
  );

  const filesFolders = useMemo(
    () => getEntitiesFoldersFromEntities(duplicatedFiles, FeatureType.Chat),
    [duplicatedFiles],
  );

  const [actionForAllItems, setActionForAllItems] = useState<ReplaceOptions>(
    ReplaceOptions.Postfix,
  );

  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);

  const onItemEvent: OnItemEvent = useCallback(
    (actionOption: string, entityId: unknown) => {
      if (
        Object.entries(mappedActions).some(
          ([id, option]) => id !== entityId && option !== actionOption,
        )
      ) {
        setActionForAllItems(ReplaceOptions.Mixed);
      } else {
        setActionForAllItems(actionOption as ReplaceOptions);
      }

      setMappedActions((prev) => {
        prev[entityId as string] = actionOption as ReplaceOptions;
        return { ...prev };
      });
    },
    [mappedActions],
  );

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      if (isRootId(folderId)) {
        return;
      }

      if (openedFoldersIds.includes(folderId)) {
        const childFoldersIds = getChildAndCurrentFoldersIdsById(folderId, [
          ...conversationsFolders,
          ...promptsFolders,
          ...filesFolders,
        ]);
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFoldersIds.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
      }
    },
    [conversationsFolders, promptsFolders, filesFolders, openedFoldersIds],
  );

  const handleOnChangeAllAction = useCallback(
    (actionOption: string) => {
      setActionForAllItems(actionOption as ReplaceOptions);
      setMappedActions(() =>
        getMappedActions(allFeaturesToReplace, actionOption as ReplaceOptions),
      );
    },
    [allFeaturesToReplace],
  );

  useEffect(() => {
    setMappedActions(() => getMappedActions(allFeaturesToReplace));
  }, [allFeaturesToReplace]);

  useEffect(() => {
    const folders = [
      ...conversationsFolders,
      ...filesFolders,
      ...promptsFolders,
    ];
    setOpenedFoldersIds(() => folders.map((folder) => folder.id));
  }, [conversationsFolders, filesFolders, promptsFolders]);

  const featureGeneralProps = useMemo(
    () => ({
      mappedActions,
      openedFoldersIds,
      handleToggleFolder,
      onItemEvent,
    }),
    [mappedActions, openedFoldersIds, handleToggleFolder, onItemEvent],
  );

  return {
    mappedActions,
    actionForAllItems,
    conversationsFolders,
    promptsFolders,
    filesFolders,
    featureGeneralProps,
    handleOnChangeAllAction,
  };
};
