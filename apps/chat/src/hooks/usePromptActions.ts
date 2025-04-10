import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { constructPath } from '@/src/utils/app/shared-utils';

import { FeatureType } from '@/src/types/common';
import { MoveToFolderProps } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import { PINNED_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

export const usePromptActions = (prompt: Prompt) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const filteredFoldersSelector = useMemo(
    () =>
      PromptsSelectors.selectFilteredFolders(defaultMyItemsFilters, '', true),
    [],
  );
  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Prompt),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);
  const folders = useAppSelector(filteredFoldersSelector);
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const isPromptModalOpen = useAppSelector(
    PromptsSelectors.selectIsPromptModalOpen,
  );

  const handleExport = useCallback(() => {
    dispatch(
      ImportExportActions.exportPrompt({
        id: prompt.id,
      }),
    );
  }, [dispatch, prompt.id]);

  const handleDuplicate = useCallback(() => {
    dispatch(PromptsActions.duplicatePrompt(prompt));
  }, [dispatch, prompt]);

  const handleMoveToFolder = useCallback(
    ({ folderId, isNewFolder }: MoveToFolderProps) => {
      const promptRootId = getPromptRootId();
      const folderPath = (
        isNewFolder
          ? getNextDefaultName(
              t(DEFAULT_FOLDER_NAME),
              folders.filter((f) => f.folderId === promptRootId),
            )
          : folderId
      ) as string;

      if (
        !isEntityNameOnSameLevelUnique(
          prompt.name,
          { ...prompt, folderId: folderPath },
          allPrompts,
        )
      ) {
        dispatch(
          UIActions.showErrorToast(
            t('Prompt with name "{{name}}" already exists in this folder.', {
              ns: Translation.PromptBar,
              name: prompt.name,
            }),
          ),
        );

        return;
      }

      if (isNewFolder) {
        dispatch(
          PromptsActions.createFolder({
            name: folderPath,
            parentId: getPromptRootId(),
          }),
        );
      }

      dispatch(
        UIActions.setCollapsedSections({
          featureType: FeatureType.Prompt,
          collapsedSections: collapsedSections.filter(
            (section) => section !== PINNED_PROMPTS_SECTION_NAME,
          ),
        }),
      );
      const newFolderId = isNewFolder
        ? constructPath(getPromptRootId(), folderPath)
        : folderPath;

      dispatch(
        PromptsActions.updatePrompt({
          id: prompt.id,
          values: {
            folderId: newFolderId,
          },
        }),
      );
      if (isPromptModalOpen) {
        dispatch(
          PromptsActions.setSelectedPrompt({
            promptId: regeneratePromptId({ ...prompt, folderId: newFolderId })
              .id,
          }),
        );
        dispatch(PromptsActions.uploadPromptSuccess({ prompt: null }));
      }
    },
    [
      allPrompts,
      collapsedSections,
      dispatch,
      folders,
      isPromptModalOpen,
      prompt,
      t,
    ],
  );

  const handleShare = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Prompt,
        entity: prompt,
      }),
    );
  }, [dispatch, prompt]);

  const handleDelete = useCallback(() => {
    if (prompt.sharedWithMe) {
      dispatch(
        ShareActions.discardSharedWithMe({
          resourceIds: [prompt.id],
          featureType: FeatureType.Prompt,
        }),
      );
    } else {
      dispatch(PromptsActions.deletePrompt({ prompt }));
    }

    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
    dispatch(PromptsActions.setIsPromptModalOpen({ isOpen: false }));
  }, [dispatch, prompt]);

  const handleInfo = useCallback(() => {
    dispatch(ChatActions.getEntityInfo({ entityInfo: prompt }));
  }, [dispatch, prompt]);

  const handleUse = useCallback(() => {
    dispatch(PromptsActions.applyPrompt(prompt));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
    dispatch(PromptsActions.setIsPromptModalOpen({ isOpen: false }));
  }, [dispatch, prompt]);

  return {
    handleExport,
    handleDuplicate,
    handleMoveToFolder,
    handleShare,
    handleDelete,
    handleInfo,
    handleUse,
  };
};
