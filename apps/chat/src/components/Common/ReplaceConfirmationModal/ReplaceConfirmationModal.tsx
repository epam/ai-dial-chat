import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getChildAndCurrentFoldersIdsById,
  getEntitiesFoldersFromEntities,
} from '@/src/utils/app/folders';
import { isRootId } from '@/src/utils/app/id';
import { getMappedActions } from '@/src/utils/app/import-export';

import {
  FeatureType,
  MappedReplaceActions,
  ReplaceOptions,
} from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ImportExportActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { ConversationsList } from './ConversationsList';
import { FilesList } from './FilesList';
import { PromptsList } from './PromptsList';
import { ReplaceSelector } from './ReplaceSelector';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

function ReplaceConfirmationModalView() {
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
        ? getEntitiesFoldersFromEntities(conversations, FeatureType.Chat)
        : [],
    [conversations],
  );

  const promptsFolders = useMemo(
    () => getEntitiesFoldersFromEntities(prompts, FeatureType.Prompt),
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
          {t(ChatI18nKeys.SomeItemsFailedToImportDuplicateNames)}
        </h2>
        <p className="text-secondary">
          {t(ChatI18nKeys.AddPostfixIgnoreOrReplace)}
        </p>
        <div
          className="flex h-fit flex-row items-center justify-between overflow-y-scroll border-b border-tertiary pl-3"
          data-qa="all-items-selector"
        >
          <span>{t(ChatI18nKeys.AllItems)}</span>
          <ReplaceSelector
            selectedOption={actionForAllItems}
            onOptionChangeHandler={handleOnChangeAllAction}
          />
        </div>
      </div>
      <div
        className="flex shrink flex-col overflow-y-scroll px-3 md:px-6"
        data-qa="main-folder-tree"
      >
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
        <DialNeutralButton
          onClick={handleCancel}
          label={t(ChatI18nKeys.Cancel)}
          data-qa="cancel-import"
        />
        <DialPrimaryButton
          onClick={handleContinueImport}
          label={t(ChatI18nKeys.ContinueImport)}
          data-qa="continue-import"
        />
      </div>
    </Modal>
  );
}

const view = withRenderWhen(
  ImportExportSelectors.selectIsShowReplaceDialog,
)(ReplaceConfirmationModalView);

export const ReplaceConfirmationModal = view;
