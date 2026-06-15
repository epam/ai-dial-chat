import { useCallback } from 'react';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { translate } from '@/src/utils/app/translation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  MarketplaceActions,
  ModelsActions,
  ToolsetActions,
} from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
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
      ? translate(MarketplaceI18nKeys.VersionInBrackets, {
          ns: Translation.Marketplace,
          version: entity.version,
        })
      : '',
  };
  const isAgent = isDialAiEntityModel(entity);

  const deleteConfirmationText = {
    [DeleteType.DELETE]: {
      heading: translate(
        isAgent
          ? MarketplaceI18nKeys.ConfirmDeletingAgent
          : MarketplaceI18nKeys.ConfirmDeletingToolset,
        {
          ns: Translation.Marketplace,
        },
      ),
      description: translate(
        MarketplaceI18nKeys.AreYouSureDeleteTheNameVersion,
        {
          ...translationVariables,
          ns: Translation.Marketplace,
        },
      ),
      confirmLabel: translate(MarketplaceI18nKeys.DeleteMarketplace, {
        ns: Translation.Marketplace,
      }),
      cancelLabel: translate(MarketplaceI18nKeys.CancelMarketplace, {
        ns: Translation.Marketplace,
      }),
    },
    [DeleteType.REMOVE]: {
      heading: translate(
        isAgent
          ? MarketplaceI18nKeys.ConfirmRemovingAgent
          : MarketplaceI18nKeys.ConfirmRemovingToolset,
        {
          ns: Translation.Marketplace,
        },
      ),
      description: translate(
        MarketplaceI18nKeys.AreYouSureRemoveNameFromMyWorkspace,
        {
          ...translationVariables,
          ns: Translation.Marketplace,
        },
      ),
      confirmLabel: translate(MarketplaceI18nKeys.Remove, {
        ns: Translation.Marketplace,
      }),
      cancelLabel: translate(MarketplaceI18nKeys.CancelMarketplace, {
        ns: Translation.Marketplace,
      }),
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

const view = withRenderWhenEntities<DeleteMarketplaceEntityDialogProps>({
  deleteState: MarketplaceSelectors.selectDeleteEntity,
})(({ deleteState }: DeleteMarketplaceEntityDialogProps) => {
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
});

export const DeleteMarketplaceEntityDialog = view;
