import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from '../../Common/ConfirmDialog';

interface Props {
  prompt: Prompt;
  isDeleteDialog?: boolean;
  isUnshareDialog?: boolean;
  onResolve: () => void;
}

export const PromptConfirmDialogs: React.FC<Props> = ({
  prompt,
  isDeleteDialog,
  isUnshareDialog,
  onResolve,
}) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const handleUnshare = useCallback(
    (isConfirmed: boolean) => {
      onResolve();
      if (!isConfirmed) return;

      dispatch(
        ShareActions.revokeAccess({
          resourceId: prompt.id,
          featureType: FeatureType.Prompt,
        }),
      );
    },
    [dispatch, onResolve, prompt.id],
  );

  const handleDelete = useCallback(
    (isConfirmed: boolean) => {
      onResolve();
      if (!isConfirmed) return;

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
    },
    [dispatch, onResolve, prompt],
  );

  return (
    <>
      {isDeleteDialog && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm deleting prompt')}
          description={`${t('Are you sure that you want to delete a prompt?')}${t(
            prompt.isShared
              ? '\nDeleting will stop sharing and other users will no longer see this prompt.'
              : '',
          )}`}
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
          onClose={handleDelete}
        />
      )}
      {isUnshareDialog && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm unsharing: {{promptName}}', {
            promptName: prompt.name,
          })}
          description={
            t('Are you sure that you want to unshare this prompt?') ?? ''
          }
          confirmLabel={t('Unshare')}
          cancelLabel={t('Cancel')}
          onClose={handleUnshare}
        />
      )}
    </>
  );
};
