import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { PromptsActions, ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/selectors';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { PromptInfo } from '@epam/ai-dial-shared';

const PromptDeleteDialogComponent = () => {
  const { t } = useTranslation(Translation.PromptBar);
  const dispatch = useAppDispatch();

  const deletingPromptId = useAppSelector(
    PromptsSelectors.selectDeletingPromptId,
  ) as string;
  const deletingPrompt = useAppSelector((state) =>
    PromptsSelectors.selectPrompt(state, deletingPromptId),
  ) as PromptInfo;
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);

  const dialogProps = useMemo(() => {
    if (!deletingPrompt) {
      return null;
    }

    if (deletingPrompt.sharedWithMe) {
      return {
        heading: t('Confirm unshare prompt'),
        description: t('Are you sure that you want to unshare a prompt?'),
        confirmLabel: t('Unshare'),
      };
    }

    return {
      heading: t('Confirm deleting prompt'),
      description: `${t('Are you sure that you want to delete a prompt?')}${t(
        deletingPrompt.isShared
          ? '\nDeleting will stop sharing and other users will no longer see this prompt.'
          : '',
      )}`,
      confirmLabel: t('Delete'),
    };
  }, [deletingPrompt, t]);

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

      dispatch(PromptsActions.setDeletingPromptId());
    },
    [deletingPrompt, dispatch],
  );

  useEffect(() => {
    if (isSelectMode) {
      dispatch(PromptsActions.setDeletingPromptId());
    }
  }, [dispatch, isSelectMode]);

  if (!dialogProps) {
    return null;
  }

  return (
    <ConfirmDialog
      isOpen
      heading={dialogProps.heading}
      description={dialogProps.description}
      confirmLabel={dialogProps.confirmLabel}
      cancelLabel={t('Cancel')}
      onClose={handleConfirmDelete}
    />
  );
};

export const PromptDeleteDialog = withRenderWhen(
  PromptsSelectors.selectDeletingPromptId,
)(PromptDeleteDialogComponent);
