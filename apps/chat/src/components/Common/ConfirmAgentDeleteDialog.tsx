import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { translate } from '@/src/utils/app/translation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  MarketplaceActions,
  ModelsActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

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

  const deleteState = useAppSelector(MarketplaceSelectors.selectDeleteEntity);
  const model = deleteState?.entity as DialAIEntityModel;
  const action = deleteState?.action as DeleteType;

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && model) {
        if (action === DeleteType.REMOVE) {
          dispatch(
            ModelsActions.removeInstalledModels({
              references: [model.reference],
              action: DeleteType.REMOVE,
            }),
          );
        } else if (action === DeleteType.DELETE) {
          dispatch(ApplicationActions.delete(model));
        }

        dispatch(MarketplaceActions.setDetailsModel());
      }

      dispatch(MarketplaceActions.setDeleteEntity());
    },
    [model, action, dispatch],
  );

  return (
    <ConfirmDialog
      isOpen
      {...getDeleteConfirmationText(action, model)}
      onClose={handleDeleteClose}
      cancelLabel={t('Cancel')}
    />
  );
};

export const ConfirmAgentDeleteDialog = withRenderWhen((state) => {
  const deleteState = MarketplaceSelectors.selectDeleteEntity(state);
  return deleteState && isDialAiEntityModel(deleteState.entity);
})(ConfirmAgentDeleteDialogView);
