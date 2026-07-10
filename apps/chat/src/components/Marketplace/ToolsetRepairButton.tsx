import { FC, useCallback, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import { isEntityIdExternal, isMyToolset } from '@/src/utils/app/id';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { SharePermission, ToolsetAuthTypes } from '@epam/ai-dial-shared';
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

  const [isRepairing, setIsRepairing] = useState(false);

  const isPublicAndAdmin =
    !!toolset && isAdmin && isMarketplaceEntityPublic(toolset);
  const isPrivateAndSignedOut =
    !!toolset && isMyToolset(toolset) && !isToolsetSignedIn(toolset);

  const canRepair =
    toolset &&
    (isPublicAndAdmin ||
      isPrivateAndSignedOut ||
      (isEntityIdExternal(toolset) &&
        toolset.sharedWithMe &&
        toolset.permissions?.includes(SharePermission.WRITE)));

  const showRepair =
    canRepair &&
    toolset?.authSettings?.dynamicallyRegistered &&
    authType === ToolsetAuthTypes.OAUTH;

  const confirmDescription =
    toolset && isMyToolset(toolset)
      ? t(CommonI18nKeys.RepairMyDescription)
      : t(CommonI18nKeys.RepairDescription);

  const handleRepair = useCallback(() => {
    dispatch(ToolsetActions.repairToolset({ id: toolset?.id as string }));
    setIsRepairing(false);
  }, [dispatch, toolset]);

  if (!showRepair) return null;

  return (
    <>
      <DialNeutralButton
        disabled={isLoading}
        label={t(CommonI18nKeys.Repair)}
        onClick={() => setIsRepairing(true)}
      />

      <ConfirmDialog
        isOpen={isRepairing}
        overlayClassName="!z-[101]"
        heading={t(CommonI18nKeys.Repair)}
        description={confirmDescription}
        confirmLabel={t(CommonI18nKeys.Continue)}
        cancelLabel={t(CommonI18nKeys.Cancel)}
        onClose={(isConfirmed) => {
          if (isConfirmed) handleRepair();
          else setIsRepairing(false);
        }}
      />
    </>
  );
};
