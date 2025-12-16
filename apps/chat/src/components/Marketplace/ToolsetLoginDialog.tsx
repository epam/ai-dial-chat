import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ModalState } from '@/src/types/modal';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { AuthSelectors, MarketplaceSelectors } from '@/src/store/selectors';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { ToolsetLoginForm } from '@/src/components/ToolsetEditor/ToolsetLoginForm';
import {
  ToolsetLoginFormSchema,
  ToolsetLoginFormType,
  WithLogin,
  getDefaultLoginFormData,
} from '@/src/components/ToolsetEditor/form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { zodResolver } from '@hookform/resolvers/zod';

const credsTabs = [
  { key: ToolsetCredentialsLevel.USER, label: 'Personal' },
  { key: ToolsetCredentialsLevel.GLOBAL, label: 'Organizational' },
];

const getAuthLevelDescriptions = (
  level: ToolsetCredentialsLevel,
  isSignedIn: boolean,
) => {
  switch (level) {
    case ToolsetCredentialsLevel.USER:
      return isSignedIn
        ? 'Log out of the toolset using personal credentials.'
        : 'Log in with personal credentials.';
    case ToolsetCredentialsLevel.GLOBAL:
      return isSignedIn
        ? 'Log out the toolset for all users in the organization using these credentials.'
        : 'Log in with credentials that will be available to other users in the organization.';
    default:
      return '';
  }
};

export const ToolsetLoginDialogView = () => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();

  const entity = useAppSelector(
    MarketplaceSelectors.selectLoginEntity,
  ) as ToolsetModel;
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const authType = entity.authSettings.authenticationType;
  const isPublic = isEntityIdPublic(entity);

  const [authLevel, setAuthLevel] = useState(
    !isPublic ? ToolsetCredentialsLevel.GLOBAL : ToolsetCredentialsLevel.USER,
  );

  const formMethods = useForm<ToolsetLoginFormType>({
    defaultValues: getDefaultLoginFormData(
      authType,
      entity,
      {
        withLogin: WithLogin.WithLogin,
      },
      authLevel,
    ),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(ToolsetLoginFormSchema),
  });

  const isOrganizationView = isAdmin && isPublic;
  const isSignedIn = isToolsetSignedIn(entity, authLevel);

  const fieldsInfo = useMemo(
    () => ({
      apiKey: t('Enter your API key value for "{{header}}" header', {
        header: entity.authSettings.apiKeyHeader,
      }),
    }),
    [entity.authSettings.apiKeyHeader, t],
  );

  const handleClose = useCallback(() => {
    dispatch(MarketplaceActions.setLoginEntity());
  }, [dispatch]);

  const handleLogin = useCallback(
    (data: ToolsetLoginFormType) => {
      dispatch(
        ToolsetActions.startSignInProcess({
          authLevel,
          apiKey: data.apiKey,
          toolset: entity,
        }),
      );
      handleClose();
    },
    [dispatch, entity, handleClose, authLevel],
  );

  const handleLogout = useCallback(() => {
    dispatch(
      ToolsetActions.logOutToolset({
        authLevel,
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
    authLevel,
  ]);

  const handleCredsTabClick = useCallback(
    (value: ToolsetCredentialsLevel) => {
      setAuthLevel(value);
      formMethods.reset(
        getDefaultLoginFormData(
          authType,
          entity,
          {
            withLogin: WithLogin.WithLogin,
          },
          value,
        ),
      );
    },
    [authType, entity, formMethods],
  );

  const handleCloseLogoutModal = useCallback(
    (result: boolean) => {
      if (result) handleLogout();
      else handleClose();
    },
    [handleClose, handleLogout],
  );

  useEffect(() => {
    if (authType === ToolsetAuthTypes.OAUTH) {
      void formMethods.trigger();
    }
  }, [authType, formMethods]);

  if (!isOrganizationView && isSignedIn)
    return (
      <ConfirmDialog
        isOpen
        heading={t('Logging out')}
        description={t('Are you sure you want to log out?') as string}
        confirmLabel={t('Log out')}
        cancelLabel={t('Cancel')}
        onClose={handleCloseLogoutModal}
      />
    );

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-toolset-signin"
      containerClassName="flex flex-col w-full md:max-w-[600px] divide-tertiary divide-y"
      overlayClassName="!z-[100]"
      onClose={handleClose}
    >
      <div className="px-6 py-4">
        <p className="text-base font-semibold text-primary">
          {t(isOrganizationView ? 'Manage credentials' : 'Login')}
        </p>
      </div>

      <div className="flex gap-2 px-6 py-4">
        <ModelIcon size={40} entityId={entity.id} entity={entity} />
        <div className="flex flex-col justify-between">
          <h3 className="text-base font-semibold leading-6 text-primary">
            {entity.name}
          </h3>
          <h4 className="text-sm font-normal leading-5 text-primary">
            {t('Version')}: {entity.version}
          </h4>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-6">
        {isOrganizationView && (
          <div className="flex gap-3">
            {credsTabs.map(({ label, key }) => (
              <TabButton
                key={key}
                tabKey={key}
                selected={authLevel === key}
                dataQA={key.concat('-tab')}
                onClick={handleCredsTabClick}
              >
                {t(label)}
              </TabButton>
            ))}
          </div>
        )}

        <div
          className={classNames('rounded', {
            'bg-layer-2 p-4': isOrganizationView,
          })}
        >
          {isOrganizationView && (
            <p className="mb-3 text-sm text-primary">
              {t(getAuthLevelDescriptions(authLevel, isSignedIn))}
            </p>
          )}

          <FormProvider {...formMethods}>
            <ToolsetLoginForm
              credentialsLevel={authLevel}
              type={entity.authSettings.authenticationType}
              toolset={entity}
              buttonClassName="ml-auto"
              onLogin={handleLogin}
              onLogout={handleLogout}
              hideConfigFields
              fieldsInfo={fieldsInfo}
            />
          </FormProvider>
        </div>
      </div>
    </Modal>
  );
};

export const ToolsetLoginDialog = withRenderWhen(
  MarketplaceSelectors.selectLoginEntity,
)(ToolsetLoginDialogView);
