import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getChildAndCurrentFoldersIdsById,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
} from '@/src/utils/app/folders';
import { isRootId } from '@/src/utils/app/id';
import { getFolderTypeByFeatureType } from '@/src/utils/app/mappers';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderType } from '@/src/types/folder';
import {
  MappedReplaceActions,
  ReplaceOptions,
} from '@/src/types/import-export';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ImportExportActions,
  ImportExportSelectors,
} from '@/src/store/import-export/importExport.reducers';

import Modal from '../Modal';
import { ReplaceSelector } from './Components';
import { ConversationsList } from './ConversationsList';
import { FilesList } from './FilesList';
import { PromptsList } from './PromptsList';

import { uniq } from 'lodash-es';

const getMappedActions = (
  items: Conversation[] | Prompt[] | DialFile[],
  action?: ReplaceOptions,
) => {
  const replaceActions: MappedReplaceActions = {};
  items.forEach((item) => {
    replaceActions[item.id] = action ?? ReplaceOptions.Postfix;
  });
  return { ...replaceActions };
};

interface Props {
  isOpen: boolean;
}

export type OnItemEvent = (actionOption: string, entityId: unknown) => void;

export const ReplaceConfirmationModal = ({ isOpen }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const featureType = useAppSelector(ImportExportSelectors.selectFeatureType);

  const conversations = useAppSelector(
    ImportExportSelectors.selectConversationToReplace,
  );
  const prompts = useAppSelector(ImportExportSelectors.selectPromptsToReplace);

  const duplicatedFiles = useAppSelector(
    ImportExportSelectors.selectDuplicatedFiles,
  );

  const importedHistory = useAppSelector(
    ImportExportSelectors.selectImportedHistory,
  );

  const featuresToReplace = useMemo(() => {
    switch (featureType) {
      case FeatureType.Chat:
        return conversations;
      case FeatureType.Prompt:
        return prompts;
      case FeatureType.File:
        return duplicatedFiles;

      default:
        return [];
    }
  }, [featureType, conversations, prompts, duplicatedFiles]);

  const folderType: FolderType = useMemo(
    () => getFolderTypeByFeatureType(featureType),
    [featureType],
  );

  const folders = useMemo(() => {
    const foldersIds = uniq(featuresToReplace.map((info) => info.folderId));
    //calculate all folders;
    const featuresFolders = getFoldersFromIds(
      uniq(foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id))),
      folderType,
    );

    return featuresFolders;
  }, [featuresToReplace, folderType]);

  const [mappedActions, setMappedActions] = useState<MappedReplaceActions>(() =>
    getMappedActions(featuresToReplace),
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
        const childFoldersIds = getChildAndCurrentFoldersIdsById(
          folderId,
          folders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFoldersIds.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
      }
    },
    [folders, openedFoldersIds],
  );

  const handleOnChangeAllAction = useCallback(
    (actionOption: string) => {
      setActionForAllItems(actionOption as ReplaceOptions);
      setMappedActions(() =>
        getMappedActions(featuresToReplace, actionOption as ReplaceOptions),
      );
    },
    [featuresToReplace],
  );

  const handleContinueImport = useCallback(() => {
    const itemsToPostfix = [];
    const itemsToReplace = [];
    for (const featureId in mappedActions) {
      const item = featuresToReplace.find(
        (feature) => feature.id === featureId,
      );
      if (!item) {
        return;
      }

      if (mappedActions[featureId] === ReplaceOptions.Postfix) {
        itemsToPostfix.push(item);
      }

      if (mappedActions[featureId] === ReplaceOptions.Replace) {
        itemsToReplace.push(item);
      }
    }

    if (!itemsToReplace.length && !itemsToPostfix.length) {
      if (featureType !== FeatureType.File) {
        dispatch(ImportExportActions.importStop());
      }
      if (featureType === FeatureType.File) {
        dispatch(
          ImportExportActions.importConversations({ data: importedHistory }),
        );
      }
    }

    if (featureType === FeatureType.File) {
      dispatch(
        ImportExportActions.uploadConversationAttachments({
          attachmentsToPostfix: itemsToPostfix as DialFile[],
          attachmentsToReplace: itemsToReplace as DialFile[],
          completeHistory: importedHistory,
        }),
      );
    }

    if (itemsToReplace.length && featureType !== FeatureType.File) {
      dispatch(
        ImportExportActions.replaceFeatures({ itemsToReplace, featureType }),
      );
    }

    if (itemsToPostfix.length) {
      if (featureType === FeatureType.Chat) {
        dispatch(
          ImportExportActions.uploadImportedConversations({
            itemsToUpload: itemsToPostfix as Conversation[],
          }),
        );
      }

      if (featureType === FeatureType.Prompt) {
        dispatch(
          ImportExportActions.uploadImportedPrompts({
            itemsToUpload: itemsToPostfix as Prompt[],
          }),
        );
      }
    }

    dispatch(ImportExportActions.closeReplaceDialog());
  }, [
    dispatch,
    featureType,
    featuresToReplace,
    mappedActions,
    importedHistory,
  ]);

  useEffect(() => {
    setMappedActions(() => getMappedActions(featuresToReplace));
  }, [featuresToReplace]);

  useEffect(() => {
    setOpenedFoldersIds(() => folders.map((folder) => folder.id));
  }, [folders]);

  const featureList = useMemo(() => {
    const featureGeneralProps = {
      folders,
      mappedActions,
      openedFoldersIds,
      handleToggleFolder,
      onItemEvent,
    };
    switch (featureType) {
      case FeatureType.Chat:
        return (
          <ConversationsList
            conversationsToReplace={conversations}
            {...featureGeneralProps}
          />
        );
      case FeatureType.Prompt:
        return (
          <PromptsList promptsToReplace={prompts} {...featureGeneralProps} />
        );
      case FeatureType.File:
        return (
          <FilesList
            duplicatedFiles={duplicatedFiles}
            {...featureGeneralProps}
          />
        );
      default:
        return null;
    }
  }, [
    featureType,
    folders,
    mappedActions,
    openedFoldersIds,
    conversations,
    prompts,
    duplicatedFiles,
    handleToggleFolder,
    onItemEvent,
  ]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleCancel}
      dataQa="replace-confirmation-modal"
      containerClassName="flex flex-col sm:w-[525px] size-full"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex h-[90%] flex-col gap-4 p-6 pb-0">
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">
              {t('Some items failed to import due to duplicate names')}
            </h2>
            <p className="text-secondary">
              {t(
                'Add a postfix, ignore or replace existing items with importing ones.',
              )}
            </p>
          </div>

          <div className="flex h-full min-h-[350px] flex-col">
            <div className="flex flex-row items-center justify-between overflow-y-scroll border-b-[1px] border-tertiary pb-3 pl-3">
              <span>{t('All items')}</span>
              <ReplaceSelector
                selectedOption={actionForAllItems}
                onOptionChangeHandler={handleOnChangeAllAction}
              />
            </div>
            <div className="flex min-h-[250px] flex-col gap-0.5">
              <div className="flex flex-col gap-1 overflow-y-scroll">
                {featuresToReplace && featureList}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-row justify-end gap-3 border-t-[1px] border-tertiary px-6 py-4">
          <button
            onClick={handleCancel}
            className="h-[38px] rounded border border-primary px-3"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleContinueImport}
            className="h-[38px] rounded bg-accent-primary px-3 "
          >
            {t('Continue')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
