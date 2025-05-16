import { useCallback } from 'react';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';

import {
  ImportExportActions,
  PromptsActions,
  PublicationActions,
  ShareActions,
} from '@/src/store/actions';
import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch } from '@/src/store/hooks';

import { PublishActions } from '@epam/ai-dial-shared';

export const usePromptActions = (prompt: Prompt) => {
  const dispatch = useAppDispatch();

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

  const handleMoveToFolder = useCallback(() => {
    dispatch(PromptsActions.setMoveToPrompt(prompt));
  }, [dispatch, prompt]);

  const handleShare = useCallback(() => {
    dispatch(
      ShareActions.share({
        featureType: FeatureType.Prompt,
        entity: prompt,
      }),
    );
  }, [dispatch, prompt]);

  const handleDelete = useCallback(() => {
    dispatch(PromptsActions.setDeletingPrompt(prompt));
  }, [dispatch, prompt]);

  const handleInfo = useCallback(() => {
    dispatch(ChatActions.getEntityInfo({ entityInfo: prompt }));
  }, [dispatch, prompt]);

  const handleUse = useCallback(() => {
    dispatch(PromptsActions.applyPrompt(prompt));
    dispatch(PromptsActions.selectPrompt({ promptId: undefined }));
  }, [dispatch, prompt]);

  const handlePublish = useCallback(() => {
    dispatch(
      PublicationActions.setPublishModel({
        entity: prompt,
        action: PublishActions.ADD,
      }),
    );
  }, [dispatch, prompt]);

  const handleUnpublish = useCallback(() => {
    dispatch(
      PublicationActions.setPublishModel({
        entity: prompt,
        action: PublishActions.DELETE,
      }),
    );
  }, [dispatch, prompt]);

  return {
    handleExport,
    handleDuplicate,
    handleMoveToFolder,
    handleShare,
    handleDelete,
    handleInfo,
    handleUse,
    handlePublish,
    handleUnpublish,
  };
};
