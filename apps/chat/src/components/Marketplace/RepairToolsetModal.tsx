import { FC, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isMyToolset } from '@/src/utils/app/id';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

interface RepairToolsetModalProps {
  entity: ToolsetModel;
}

const RepairToolsetModalView: FC<RepairToolsetModalProps> = ({ entity }) => {
  const { t } = useTranslation(Translation.Common);

  const dispatch = useAppDispatch();

  const confirmDescription = isMyToolset(entity)
    ? t(CommonI18nKeys.RepairMyDescription)
    : t(CommonI18nKeys.RepairDescription);

  const handleClose = useCallback(
    (result: boolean) => {
      if (result) {
        dispatch(ToolsetActions.repairToolset({ id: entity.id }));
      }
      dispatch(MarketplaceActions.setRepairEntity());
    },
    [entity, dispatch],
  );

  return (
    <ConfirmDialog
      isOpen
      overlayClassName="!z-[101]"
      heading={t(CommonI18nKeys.Repair)}
      description={confirmDescription}
      confirmLabel={t(CommonI18nKeys.Continue)}
      cancelLabel={t(CommonI18nKeys.Cancel)}
      onClose={handleClose}
    />
  );
};

export const RepairToolsetModal =
  withRenderWhenEntities<RepairToolsetModalProps>({
    entity: MarketplaceSelectors.selectRepairEntity,
  })(RepairToolsetModalView);
