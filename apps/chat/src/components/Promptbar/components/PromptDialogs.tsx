import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { usePromptActions } from '@/src/hooks/usePromptActions';

import { getIdWithoutRootPathSegments, isRootId } from '@/src/utils/app/id';
import { defaultMyItemsFilters } from '@/src/utils/app/search';

import { Prompt } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { MoveToFolderModal } from '@/src/components/Common/MoveToFolderModal';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  prompt: Prompt;
  isDeleteDialog?: boolean;
  publishPromptAction?: PublishActions;
  moveTo?: { isOpen: boolean; isMobileOnly: boolean };
  onCloseModals: () => void;
}

export const PromptDialogs: React.FC<Props> = ({
  prompt,
  isDeleteDialog,
  publishPromptAction,
  moveTo,
  onCloseModals,
}) => {
  const { t } = useTranslation(Translation.PromptBar);

  const filteredFoldersSelector = useMemo(
    () =>
      PromptsSelectors.selectFilteredFolders(defaultMyItemsFilters, '', true),
    [],
  );

  const folders = useAppSelector(filteredFoldersSelector);

  const { handleMoveToFolder, handleDelete } = usePromptActions(prompt);

  const handleConfirmDelete = useCallback(
    (isConfirmed: boolean) => {
      if (isConfirmed) {
        handleDelete();
      }

      onCloseModals();
    },
    [handleDelete, onCloseModals],
  );

  return (
    <>
      {moveTo && moveTo.isOpen && (
        <div className={moveTo.isMobileOnly ? 'md:hidden' : ''}>
          <MoveToFolderModal
            folders={folders}
            onMoveToFolder={handleMoveToFolder}
            onClose={onCloseModals}
          />
        </div>
      )}
      {publishPromptAction && (
        <PublishModal
          entity={prompt}
          type={SharingType.Prompt}
          isOpen
          onClose={onCloseModals}
          publishAction={publishPromptAction}
          defaultPath={
            publishPromptAction === PublishActions.DELETE &&
            !isRootId(prompt.folderId)
              ? getIdWithoutRootPathSegments(prompt.folderId)
              : undefined
          }
        />
      )}
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
          onClose={handleConfirmDelete}
        />
      )}
    </>
  );
};
