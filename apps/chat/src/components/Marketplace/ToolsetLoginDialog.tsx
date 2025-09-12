import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ModalState } from '@/src/types/modal';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/selectors';

import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { ToolsetLoginForm } from '@/src/components/ToolsetEditor/ToolsetLoginForm';
import { ToolsetLoginFormType } from '@/src/components/ToolsetEditor/form';

export const ToolsetLoginDialogView = () => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const entity = useAppSelector(
    MarketplaceSelectors.selectLoginEntity,
  ) as ToolsetModel;

  const isSignedIn = isToolsetSignedIn(entity);

  const handleClose = useCallback(() => {
    dispatch(MarketplaceActions.setLoginEntity());
  }, [dispatch]);

  const handleLogin = useCallback(
    (data: ToolsetLoginFormType) => {
      dispatch(
        ToolsetActions.startSignInProcess({
          authLevel: ToolsetCredentialsLevel.GLOBAL,
          apiKey: data.apiKey,
          toolset: entity,
        }),
      );
      handleClose();
    },
    [dispatch, entity, handleClose],
  );

  const handleLogout = useCallback(() => {
    dispatch(
      ToolsetActions.logOutToolset({
        authLevel: ToolsetCredentialsLevel.GLOBAL,
        authType: entity.authSettings.authenticationType,
        toolsetId: entity.id,
      }),
    );
    handleClose();
  }, [
    dispatch,
    entity.authSettings.authenticationType,
    entity.id,
    handleClose,
  ]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-toolset-signin"
      containerClassName="flex flex-col gap-4 w-full md:max-w-[450px] p-6"
      onClose={handleClose}
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold leading-6 text-primary">
          {t(isSignedIn ? 'Logout' : 'Login')}: {entity.name}
        </h3>
        <h4 className="text-sm font-normal leading-5 text-primary">
          {t('Version')}: {entity.version}
        </h4>
      </div>

      <ToolsetLoginForm
        type={entity.authSettings.authenticationType}
        toolset={entity}
        buttonClassName="ml-auto"
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </Modal>
  );
};

export const ToolsetLoginDialog = withRenderWhen(
  MarketplaceSelectors.selectLoginEntity,
)(ToolsetLoginDialogView);
