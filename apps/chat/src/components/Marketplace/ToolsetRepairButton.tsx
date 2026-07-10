import { FC, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { canRepairToolset } from '@/src/utils/app/toolsets';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions } from '@/src/store/actions';
import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { DialNeutralButton } from '@epam/ai-dial-ui-kit';

interface ToolsetRepairButtonProps {
  toolset?: ToolsetModel;
  authType?: ToolsetAuthTypes;
}

export const ToolsetRepairButton: FC<ToolsetRepairButtonProps> = ({
  toolset,
  authType: authTypeProp,
}) => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const authType = authTypeProp ?? toolset?.authSettings?.authenticationType;

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const isLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );

  const showRepair = canRepairToolset(toolset, isAdmin, authType);

  const handleRepair = useCallback(() => {
    dispatch(MarketplaceActions.setRepairEntity(toolset as ToolsetModel));
  }, [dispatch, toolset]);

  if (!showRepair) return null;

  return (
    <DialNeutralButton
      disabled={isLoading}
      label={t(CommonI18nKeys.Repair)}
      onClick={handleRepair}
    />
  );
};
