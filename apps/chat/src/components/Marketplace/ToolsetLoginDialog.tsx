import { IconLayoutGrid, IconUser } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ModalState } from '@/src/types/modal';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  MarketplaceSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';
import { AuthAccordion } from '@/src/components/ToolsetEditor/AuthAccordion';
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
  {
    key: ToolsetCredentialsLevel.USER,
    label: 'My credentials',
    Icon: IconUser,
  },
  {
    key: ToolsetCredentialsLevel.GLOBAL,
    label: 'Entire organization credentials',
    Icon: IconLayoutGrid,
  },
];

interface ToolsetLoginDialogProps {
  entity: ToolsetModel;
}

export const ToolsetLoginDialogView: FC<ToolsetLoginDialogProps> = ({
  entity,
}) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();
  const { route } = useRouter();

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const authType = entity.authSettings.authenticationType;
  const isPublic = isEntityIdPublic(entity);

  const [authLevel, setAuthLevel] = useState<
    ToolsetCredentialsLevel | undefined
  >(undefined);

  const isAppsEditor = route === Routes.AppsEditor;

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
  const isSignedIn = isToolsetSignedIn(entity, ToolsetCredentialsLevel.GLOBAL);

  const fieldsInfo = useMemo(
    () => ({
      apiKey: t('Enter your API key value for "{{header}}" header', {
        header: entity.authSettings.apiKeyHeader,
      }),
    }),
    [entity.authSettings.apiKeyHeader, t],
  );

  const organizationFormTitle = useMemo(() => {
    switch (authLevel) {
      case ToolsetCredentialsLevel.USER:
        return isToolsetSignedIn(entity, authLevel)
          ? t('Log out of the toolset using personal credentials.')
          : t('Log in with personal credentials.');
      case ToolsetCredentialsLevel.GLOBAL:
        return isToolsetSignedIn(entity, authLevel) ? (
          <>
            {t('Log out of the toolset ')}
            <strong>{t('for all users in the organization ')}</strong>
            {t('using these credentials.')}
          </>
        ) : (
          <>
            {t(
              'Log in with credentials that will be available to other users in the ',
            )}
            <strong>{t('organization.')}</strong>
          </>
        );
      default:
        return '';
    }
  }, [authLevel, entity, t]);

  const allVersions = useMemo(
    () =>
      allToolsets.filter(
        (t) =>
          getGroupMarketplaceEntityKey(t) ===
          getGroupMarketplaceEntityKey(entity),
      ),
    [allToolsets, entity],
  );

  const handleClose = useCallback(() => {
    dispatch(MarketplaceActions.setLoginEntity());
  }, [dispatch]);

  const handleLogin = useCallback(
    (data: ToolsetLoginFormType) => {
      dispatch(
        ToolsetActions.startSignInProcess({
          authLevel: authLevel ?? ToolsetCredentialsLevel.GLOBAL,
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
        authLevel: authLevel ?? ToolsetCredentialsLevel.GLOBAL,
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

  const handleVersionChange = useCallback(
    (toolset: ToolsetModel) => {
      dispatch(MarketplaceActions.setLoginEntity(toolset));
    },
    [dispatch],
  );

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
          <h3 className="text-sm font-semibold text-primary">{entity.name}</h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-primary">{t('Version: ')}</span>

            <ModelVersionSelect
              entities={isAppsEditor ? [entity] : allVersions}
              currentEntity={entity}
              onSelect={handleVersionChange}
              className="truncate"
              triggerClassName="!text-xs bg-layer-4 rounded p-1"
            />
          </div>
        </div>
      </div>

      <FormProvider {...formMethods}>
        <div className="flex flex-col gap-2 p-6">
          {isOrganizationView ? (
            credsTabs.map(({ label, key, Icon }) => (
              <AuthAccordion
                className="!bg-layer-2"
                key={key}
                Icon={Icon}
                title={t(label)}
                isOpen={key === authLevel}
                onClick={() => handleCredsTabClick(key)}
                statusBadge={{
                  label: t(
                    isToolsetSignedIn(entity, key) ? 'LOGGED IN' : 'LOGGED OUT',
                  ),
                  type: isToolsetSignedIn(entity, key) ? 'success' : 'error',
                }}
              >
                <p className="text-sm text-primary">{organizationFormTitle}</p>

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
              </AuthAccordion>
            ))
          ) : (
            <ToolsetLoginForm
              credentialsLevel={ToolsetCredentialsLevel.GLOBAL}
              type={entity.authSettings.authenticationType}
              toolset={entity}
              buttonClassName="ml-auto"
              onLogin={handleLogin}
              onLogout={handleLogout}
              hideConfigFields
              fieldsInfo={fieldsInfo}
            />
          )}
        </div>
      </FormProvider>
    </Modal>
  );
};

export const ToolsetLoginDialog =
  withRenderWhenEntities<ToolsetLoginDialogProps>({
    entity: MarketplaceSelectors.selectLoginEntity,
  })(ToolsetLoginDialogView);
