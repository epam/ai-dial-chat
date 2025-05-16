import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { PromptsActions, ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

const PromptDeleteDialogComponent = () => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const deletingPrompt = useAppSelector(PromptsSelectors.selectDeletingPrompt);

  const handleConfirmDelete = useCallback(
    (isConfirmed: boolean) => {
      if (isConfirmed && deletingPrompt) {
        if (deletingPrompt.sharedWithMe) {
          dispatch(
            ShareActions.discardSharedWithMe({
              resourceIds: [deletingPrompt.id],
              featureType: FeatureType.Prompt,
            }),
          );
        } else {
          dispatch(PromptsActions.deletePrompt({ prompt: deletingPrompt }));
        }

        dispatch(PromptsActions.selectPrompt({ promptId: undefined }));
      }

      dispatch(PromptsActions.setDeletingPrompt());
    },
    [deletingPrompt, dispatch],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t('Confirm deleting prompt')}
      description={`${t('Are you sure that you want to delete a prompt?')}${t(
        deletingPrompt?.isShared
          ? '\nDeleting will stop sharing and other users will no longer see this prompt.'
          : '',
      )}`}
      confirmLabel={t('Delete')}
      cancelLabel={t('Cancel')}
      onClose={handleConfirmDelete}
    />
  );
};

export const PromptDeleteDialog = withRenderWhen(
  PromptsSelectors.selectDeletingPrompt,
)(PromptDeleteDialogComponent);
