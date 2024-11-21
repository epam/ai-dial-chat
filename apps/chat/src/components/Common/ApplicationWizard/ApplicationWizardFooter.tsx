import { IconTrashX, IconWorldShare } from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import Tooltip from '@/src/components/Common/Tooltip';

import { PublishActions } from '@epam/ai-dial-shared';

interface ApplicationWizardFooterProps {
  onClose: (v: boolean) => void;
  isEdit?: boolean;
  isValid?: boolean;
  selectedApplication?: CustomApplicationModel;
}

export const ApplicationWizardFooter: FC<ApplicationWizardFooterProps> = ({
  isEdit,
  isValid,
  selectedApplication,
  onClose,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const applicationToPublish = selectedApplication
    ? {
        name: selectedApplication.name,
        id: ApiUtils.decodeApiUrl(selectedApplication.id),
        folderId: getFolderIdFromEntityId(selectedApplication.name),
        iconUrl: selectedApplication.iconUrl,
      }
    : null;

  const handleDelete = useCallback(() => {
    if (selectedApplication) {
      dispatch(ApplicationActions.delete(selectedApplication));
    }

    onClose(false);
  }, [dispatch, onClose, selectedApplication]);

  const handlePublish = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
  }, []);

  const handlePublishClose = useCallback(() => {
    setIsPublishing(false);
  }, []);

  const handleConfirmDialogOpen = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDialogClose = useCallback(
    (result: boolean) => {
      setIsDeleteModalOpen(false);

      if (result) {
        handleDelete();
      }
    },
    [handleDelete],
  );

  return (
    <>
      <div
        className={classNames(
          'flex gap-2 border-t border-tertiary p-4 md:px-6',
          isEdit ? 'justify-between' : 'justify-end',
        )}
      >
        {isEdit && (
          <div className="flex items-center gap-2">
            <Tooltip tooltip={t('Delete')}>
              <button
                onClick={handleConfirmDialogOpen}
                className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                data-qa="application-delete"
              >
                <IconTrashX
                  size={24}
                  className="shrink-0 cursor-pointer text-secondary hover:text-accent-primary"
                />
              </button>
            </Tooltip>
            <Tooltip tooltip={t('Publish')}>
              <button
                onClick={handlePublish}
                className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                data-qa="application-share"
              >
                <IconWorldShare
                  size={24}
                  className="shrink-0 cursor-pointer text-secondary hover:text-accent-primary"
                />
              </button>
            </Tooltip>
          </div>
        )}
        <Tooltip
          hideTooltip={isValid}
          tooltip={t('Fill in all required fields or correct values')}
        >
          <button
            className="button button-primary"
            disabled={!isValid}
            data-qa="save-application-dialog"
            type="submit"
          >
            {isEdit ? t('Save') : t('Add')}
          </button>
        </Tooltip>
      </div>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        heading={t('Confirm deleting application')}
        description={
          t('Are you sure you want to delete the application?') || ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onClose={handleConfirmDialogClose}
      />
      {applicationToPublish && (
        <PublishModal
          entity={applicationToPublish}
          type={SharingType.Application}
          isOpen={isPublishing}
          onClose={handlePublishClose}
          publishAction={
            isPublishing ? PublishActions.ADD : PublishActions.DELETE
          }
        />
      )}
    </>
  );
};
