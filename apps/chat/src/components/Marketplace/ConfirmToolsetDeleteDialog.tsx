import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isDialAiEntityModel } from '@/src/utils/app/application';
import { translate } from '@/src/utils/app/translation';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { DeleteType } from '@/src/constants/marketplace';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

const getDeleteDescription = (toolset: ToolsetModel) => {
  return translate('Are you sure you want to delete {{name}}{{version}}?', {
    name: toolset.name,
    version: toolset.version
      ? translate(' (version {{version}})', { version: toolset.version })
      : '',
  });
};

const ConfirmToolsetDeleteDialogView = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const deleteState = useAppSelector(MarketplaceSelectors.selectDeleteEntity);
  const toolset = deleteState?.entity as ToolsetModel;
  const action = deleteState?.action as DeleteType;

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && toolset && action === DeleteType.DELETE) {
        dispatch(
          ToolsetActions.deleteToolset({ reference: toolset.reference }),
        );
      }
      dispatch(MarketplaceActions.setDeleteEntity());
      dispatch(ToolsetActions.setToolsetDetails());
    },
    [action, dispatch, toolset],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t('Confirm deleting toolset')}
      description={getDeleteDescription(toolset)}
      confirmLabel={t('Delete')}
      cancelLabel={t('Cancel')}
      onClose={handleDeleteClose}
    />
  );
};

export const ConfirmToolsetDeleteDialog = withRenderWhen((state) => {
  const deleteState = MarketplaceSelectors.selectDeleteEntity(state);
  return deleteState && !isDialAiEntityModel(deleteState.entity);
})(ConfirmToolsetDeleteDialogView);
