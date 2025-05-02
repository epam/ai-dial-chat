import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { translate } from '@/src/utils/app/translation';

import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { DeleteType } from '@/src/constants/marketplace';

import { PublishModal } from '../Chat/Publish/PublishWizard';
import { ApplicationLogs } from '../Marketplace/ApplicationLogs';
import { ConfirmDialog } from './ConfirmDialog';

const getDeleteConfirmationText = (
  action: DeleteType,
  entity: DialAIEntityModel,
) => {
  const translationVariables = {
    modelName: entity.name,
    modelVersion: entity.version
      ? translate(' (version {{version}})', { version: entity.version })
      : '',
  };

  const deleteConfirmationText = {
    [DeleteType.DELETE]: {
      heading: translate('Confirm deleting application'),
      description: translate(
        'Are you sure you want to delete the {{modelName}}{{modelVersion}}?',
        translationVariables,
      ),
      confirmLabel: translate('Delete'),
    },
    [DeleteType.REMOVE]: {
      heading: translate('Confirm removing agent'),
      description: translate(
        'Are you sure you want to remove {{modelName}} from My workspace?',
        translationVariables,
      ),
      confirmLabel: translate('Remove'),
    },
  };

  return deleteConfirmationText[action];
};

export const AgentDialogs = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const deleteModel = useAppSelector(MarketplaceSelectors.selectDeleteModel);
  const publishModel = useAppSelector(PublicationSelectors.selectPublishModel);

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteModel) {
        if (deleteModel.action === DeleteType.REMOVE) {
          dispatch(
            ModelsActions.removeInstalledModels({
              references: [deleteModel.entity.reference],
              action: DeleteType.REMOVE,
            }),
          );
        } else if (deleteModel.action === DeleteType.DELETE) {
          dispatch(ApplicationActions.delete(deleteModel.entity));
        }

        dispatch(MarketplaceActions.setDetailsModel());
      }

      dispatch(MarketplaceActions.setDeleteModel());
    },
    [deleteModel, dispatch],
  );
  const handlePublishClose = useCallback(() => {
    dispatch(PublicationActions.setPublishModel());
  }, [dispatch]);

  return (
    <>
      {!!deleteModel && (
        <ConfirmDialog
          isOpen
          {...getDeleteConfirmationText(deleteModel.action, deleteModel.entity)}
          onClose={handleDeleteClose}
          cancelLabel={t('Cancel')}
        />
      )}
      {!!publishModel && (
        <PublishModal
          entity={publishModel.entity}
          type={SharingType.Application}
          isOpen
          onClose={handlePublishClose}
          publishAction={publishModel.action}
        />
      )}
      <ApplicationLogs />
    </>
  );
};
