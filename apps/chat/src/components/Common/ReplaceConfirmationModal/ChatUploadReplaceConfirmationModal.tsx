import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MappedReplaceActions } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { ReplaceConfirmationModal } from './ReplaceConfirmationModal';

function ChatUploadReplaceConfirmationModalView() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const duplicatedFiles = useAppSelector(
    FilesSelectors.selectDuplicatedUploadFiles,
  );

  const handleCancel = useCallback(() => {
    dispatch(FilesActions.cancelUploadReplaceDialog());
  }, [dispatch]);

  const handleConfirm = useCallback(
    (mappedActions: MappedReplaceActions) => {
      dispatch(
        FilesActions.continueUploadReplaceDialog({
          mappedActions,
        }),
      );
    },
    [dispatch],
  );

  return (
    <ReplaceConfirmationModal
      title={t(ChatI18nKeys.SomeFilesFailedToUploadDuplicateNames)}
      description={t(ChatI18nKeys.AddPostfixIgnoreOrReplaceUpload)}
      cancelLabel={t(ChatI18nKeys.Cancel)}
      confirmLabel={t(ChatI18nKeys.ContinueUpload)}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      duplicatedFiles={duplicatedFiles}
      cancelDataQa="cancel-upload"
      confirmDataQa="continue-upload"
    />
  );
}

export const ChatUploadReplaceConfirmationModal = withRenderWhen(
  FilesSelectors.selectIsShowUploadReplaceDialog,
)(ChatUploadReplaceConfirmationModalView);
