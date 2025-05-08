import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { translate } from '@/src/utils/app/translation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';

import { DeleteType } from '@/src/constants/marketplace';

import { ConfirmDialog } from './ConfirmDialog';
import { withRenderWhen } from './RenderWhen';

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

const ConfirmAgentDeleteDialogView = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const deleteModel = useAppSelector(MarketplaceSelectors.selectDeleteModel)!;

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

  return (
    <ConfirmDialog
      isOpen
      {...getDeleteConfirmationText(deleteModel.action, deleteModel.entity)}
      onClose={handleDeleteClose}
      cancelLabel={t('Cancel')}
    />
  );
};

export const ConfirmAgentDeleteDialog = withRenderWhen(
  MarketplaceSelectors.selectDeleteModel,
)(ConfirmAgentDeleteDialogView);
