import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MappedReplaceActions } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ImportExportActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { ReplaceConfirmationModal } from './ReplaceConfirmationModal';

function ImportReplaceConfirmationModalView() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const conversations = useAppSelector(
    ImportExportSelectors.selectDuplicatedConversations,
  );
  const prompts = useAppSelector(ImportExportSelectors.selectDuplicatedPrompts);
  const duplicatedFiles = useAppSelector(
    ImportExportSelectors.selectDuplicatedFiles,
  );

  const handleCancel = useCallback(() => {
    dispatch(ImportExportActions.importStop());
  }, [dispatch]);

  const handleConfirm = useCallback(
    (mappedActions: MappedReplaceActions) => {
      dispatch(
        ImportExportActions.continueDuplicatedImport({
          mappedActions,
        }),
      );
    },
    [dispatch],
  );

  return (
    <ReplaceConfirmationModal
      title={t(ChatI18nKeys.SomeItemsFailedToImportDuplicateNames)}
      description={t(ChatI18nKeys.AddPostfixIgnoreOrReplace)}
      cancelLabel={t(ChatI18nKeys.Cancel)}
      confirmLabel={t(ChatI18nKeys.ContinueImport)}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      conversations={conversations}
      prompts={prompts}
      duplicatedFiles={duplicatedFiles}
    />
  );
}

export const ImportReplaceConfirmationModal = withRenderWhen(
  ImportExportSelectors.selectIsShowReplaceDialog,
)(ImportReplaceConfirmationModalView);
