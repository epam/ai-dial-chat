import { FC, useCallback } from 'react';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { translate } from '@/src/utils/app/translation';

import { MarketplaceEntity } from '@/src/types/marketplace';

import {
  ApplicationActions,
  MarketplaceActions,
  ModelsActions,
  ToolsetActions,
} from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { DeleteType } from '@/src/constants/marketplace';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

const getDeleteConfirmationText = (
  action: DeleteType,
  entity: MarketplaceEntity,
) => {
  const translationVariables = {
    name: entity.name,
    version: entity.version
      ? translate(' (version {{version}})', { version: entity.version })
      : '',
  };
  const type = isDialAiEntityModel(entity) ? 'agent' : 'toolset';

  const deleteConfirmationText = {
    [DeleteType.DELETE]: {
      heading: translate(`Confirm deleting ${type}`),
      description: translate(
        'Are you sure you want to delete the {{name}}{{version}}?',
        translationVariables,
      ),
      confirmLabel: translate('Delete'),
      cancelLabel: translate('Cancel'),
    },
    [DeleteType.REMOVE]: {
      heading: translate(`Confirm removing ${type}`),
      description: translate(
        'Are you sure you want to remove {{name}} from My workspace?',
        translationVariables,
      ),
      confirmLabel: translate('Remove'),
      cancelLabel: translate('Cancel'),
    },
  };

  return deleteConfirmationText[action];
};

interface DeleteMarketplaceEntityDialogProps {
  deleteState: {
    entity: MarketplaceEntity;
    action: DeleteType;
  };
}

const DeleteMarketplaceEntityDialogView: FC<
  DeleteMarketplaceEntityDialogProps
> = ({ deleteState }) => {
  const dispatch = useAppDispatch();

  const deleteAction = deleteState.action;
  const deleteEntity = deleteState.entity;

  const handleDelete = useCallback(
    (entity: MarketplaceEntity) => {
      if (isDialAiEntityModel(entity)) {
        dispatch(ApplicationActions.delete(entity));
      } else {
        dispatch(
          ToolsetActions.deleteToolset({
            reference: entity.reference,
          }),
        );
      }
    },
    [dispatch],
  );

  const handleRemove = useCallback(
    (entity: MarketplaceEntity) => {
      if (isDialAiEntityModel(entity)) {
        dispatch(
          ModelsActions.removeInstalledModels({
            references: [entity.reference],
            action: DeleteType.REMOVE,
          }),
        );
      } else {
        dispatch(
          ToolsetActions.removeInstalledToolsets({
            references: [entity.reference],
          }),
        );
      }
    },
    [dispatch],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm) {
        if (deleteAction === DeleteType.REMOVE) {
          handleRemove(deleteEntity);
        } else if (deleteAction === DeleteType.DELETE) {
          handleDelete(deleteEntity);
        }

        dispatch(MarketplaceActions.setDetailsEntity());
      }
      dispatch(MarketplaceActions.setDeleteEntity());
    },
    [deleteAction, deleteEntity, dispatch, handleDelete, handleRemove],
  );

  return (
    <ConfirmDialog
      isOpen
      {...getDeleteConfirmationText(deleteAction, deleteEntity)}
      onClose={handleDeleteClose}
    />
  );
};

export const DeleteMarketplaceEntityDialog =
  withRenderWhenEntities<DeleteMarketplaceEntityDialogProps>({
    deleteState: MarketplaceSelectors.selectDeleteEntity,
  })(DeleteMarketplaceEntityDialogView);
