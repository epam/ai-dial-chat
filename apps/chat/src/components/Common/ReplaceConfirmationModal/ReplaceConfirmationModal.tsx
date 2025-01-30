import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getChildAndCurrentFoldersIdsById,
  getEntitiesFoldersFromEntities,
} from '@/src/utils/app/folders';
import { isRootId } from '@/src/utils/app/id';
import { getMappedActions } from '@/src/utils/app/import-export';

import { FolderType } from '@/src/types/folder';
import {
  MappedReplaceActions,
  ReplaceOptions,
} from '@/src/types/import-export';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ImportExportActions,
  ImportExportSelectors,
} from '@/src/store/import-export/importExport.reducers';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import Modal from '../Modal';
import { ReplaceSelector } from './Components';
import { ConversationsList } from './ConversationsList';
import { FilesList } from './FilesList';
import { PromptsList } from './PromptsList';

export type OnItemEvent = (actionOption: string, entityId: unknown) => void;

export const ReplaceConfirmationModal = () => {
  const isReplaceModalOpened = useAppSelector(
    ImportExportSelectors.selectIsShowReplaceDialog,
  );
  if (isReplaceModalOpened) {
    return <ReplaceConfirmationModalView />;
  }
};

export const ReplaceConfirmationModalView = () => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const conversations = useAppSelector(
    ImportExportSelectors.selectDuplicatedConversations,
  );
  const prompts = useAppSelector(ImportExportSelectors.selectDuplicatedPrompts);

  const duplicatedFiles = useAppSelector(
    ImportExportSelectors.selectDuplicatedFiles,
  );

  const allFeaturesToReplace = useMemo(
    () => [...(conversations ?? []), ...duplicatedFiles, ...prompts],
    [conversations, prompts, duplicatedFiles],
  );

  const [mappedActions, setMappedActions] = useState<MappedReplaceActions>(() =>
    getMappedActions(allFeaturesToReplace),
  );

  const conversationsFolders = useMemo(
    () =>
      conversations
        ? getEntitiesFoldersFromEntities(conversations, FolderType.Chat)
        : [],
    [conversations],
  );

  const promptsFolders = useMemo(
    () => getEntitiesFoldersFromEntities(prompts, FolderType.Prompt),
    [prompts],
  );

  const filesFolders = useMemo(
    () => getEntitiesFoldersFromEntities(duplicatedFiles, FolderType.Chat),
    [duplicatedFiles],
  );

  const [actionForAllItems, setActionForAllItems] = useState<ReplaceOptions>(
    ReplaceOptions.Postfix,
  );

  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);

  const onItemEvent = useCallback(
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

  const handleCancel = useCallback(() => {
    dispatch(ImportExportActions.importStop());
  }, [dispatch]);

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

  const handleContinueImport = useCallback(() => {
    dispatch(
      ImportExportActions.continueDuplicatedImport({
        mappedActions,
      }),
    );
  }, [dispatch, mappedActions]);

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

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      onClose={() => {
        return;
      }}
      hideClose
      dataQa="replace-confirmation-modal"
      containerClassName="flex w-full min-h-[595px] flex-col gap-4 pt-4 sm:w-[525px] md:pt-6"
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="flex h-fit flex-col gap-2 px-3 md:px-6">
        <h2 className="text-base font-semibold">
          {t('Some items failed to import due to duplicate names')}
        </h2>
        <p className="text-secondary">
          {t(
            'Add a postfix, ignore or replace existing items with importing ones.',
          )}
        </p>
        <div className="flex h-fit flex-row items-center justify-between overflow-y-scroll border-b border-tertiary pl-3">
          <span>{t('All items')}</span>
          <ReplaceSelector
            selectedOption={actionForAllItems}
            onOptionChangeHandler={handleOnChangeAllAction}
          />
        </div>
      </div>
      <div className="flex shrink flex-col overflow-y-scroll px-3 md:px-6">
        {conversations && (
          <ConversationsList
            conversationsToReplace={conversations}
            folders={conversationsFolders}
            {...featureGeneralProps}
          />
        )}
        {duplicatedFiles && (
          <FilesList
            duplicatedFiles={duplicatedFiles}
            folders={filesFolders}
            {...featureGeneralProps}
          />
        )}
        {prompts && (
          <PromptsList
            promptsToReplace={prompts}
            folders={promptsFolders}
            {...featureGeneralProps}
          />
        )}
      </div>

      <div className="mt-auto flex h-fit flex-row justify-end gap-3 border-t border-tertiary px-3 py-4 md:px-6 md:pb-4">
        <button
          onClick={handleCancel}
          className="button button-secondary h-[38px] rounded px-3 py-0"
        >
          {t('Cancel')}
        </button>
        <button
          onClick={handleContinueImport}
          className="button button-primary h-[38px] rounded px-3 py-0"
        >
          {t('Continue')}
        </button>
      </div>
    </Modal>
  );
};
