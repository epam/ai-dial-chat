import { IconLayoutGrid, IconUser } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { isPredefinedEntity } from '@/src/utils/app/id';
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

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';
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
    label: MarketplaceI18nKeys.MyCredentials,
    Icon: IconUser,
    triggerQa: 'my-creds-accordion',
    contentQa: 'my-creds-content',
  },
  {
    key: ToolsetCredentialsLevel.GLOBAL,
    label: MarketplaceI18nKeys.EntireOrganizationCredentials,
    Icon: IconLayoutGrid,
    triggerQa: 'org-creds-accordion',
    contentQa: 'org-creds-content',
  },
];

interface ToolsetLoginDialogProps {
  toolset: ToolsetModel;
}

const view = withRenderWhenEntities<ToolsetLoginDialogProps>({
  toolset: (state) => MarketplaceSelectors.selectLoginEntity(state)?.toolset,
})(({ toolset }: ToolsetLoginDialogProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const dispatch = useAppDispatch();
  const { route } = useRouter();

  const loginEntity = useAppSelector(MarketplaceSelectors.selectLoginEntity);
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  // Select all toolsets including with `hiddenEntityTag` ones to show all versions in the dropdown
  const allToolsets = useAppSelector((state) =>
    ToolsetSelectors.selectToolsets(state, true),
  );
  const isToolsetLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );
  const authType = toolset.authSettings.authenticationType;
  const isPublic = isEntityIdPublic(toolset) || isPredefinedEntity(toolset);

  const [authLevel, setAuthLevel] = useState<
    ToolsetCredentialsLevel | undefined
  >(undefined);
  const [versionChanged, setVersionChanged] = useState(false);

  const isAppsEditor = route === Routes.AppsEditor;

  const formMethods = useForm<ToolsetLoginFormType>({
    defaultValues: getDefaultLoginFormData({
      authenticationType: authType,
      toolset,
      prevData: { withLogin: WithLogin.WithLogin },
      authLevel,
    }),
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(ToolsetLoginFormSchema),
  });

  const isOrganizationView =
    isAdmin && isPublic && !loginEntity?.disableAdminView;
  const isSignedIn = isToolsetSignedIn(
    toolset,
    isPublic ? ToolsetCredentialsLevel.USER : ToolsetCredentialsLevel.GLOBAL,
  );

  const fieldsInfo = useMemo(
    () => ({
      apiKey: t(MarketplaceI18nKeys.EnterApiKeyForHeader, {
        header: toolset.authSettings.apiKeyHeader,
      }),
    }),
    [toolset.authSettings.apiKeyHeader, t],
  );

  const organizationFormTitle = useMemo(() => {
    const isSignedIn = isToolsetSignedIn(toolset, authLevel);
    switch (authLevel) {
      case ToolsetCredentialsLevel.USER:
        return isSignedIn
          ? t(MarketplaceI18nKeys.LogOutToolsetPersonal)
          : t(MarketplaceI18nKeys.LogInWithPersonalCreds);
      case ToolsetCredentialsLevel.GLOBAL:
        return isSignedIn ? (
          <>
            {t(MarketplaceI18nKeys.LogOutToolsetAll)}
            <strong>{t(MarketplaceI18nKeys.ForAllUsersInOrg)}</strong>
            {t(MarketplaceI18nKeys.UsingTheseCreds)}
          </>
        ) : (
          <>
            {t(MarketplaceI18nKeys.LogInWithCredsForOrg)}
            <strong>{t(MarketplaceI18nKeys.OrganizationMarketplace)}</strong>
          </>
        );
      default:
        return '';
    }
  }, [authLevel, toolset, t]);

  const allVersions = useMemo(
    () =>
      allToolsets.filter(
        (t) =>
          getGroupMarketplaceEntityKey(t) ===
          getGroupMarketplaceEntityKey(toolset),
      ),
    [allToolsets, toolset],
  );

  const handleClose = useCallback(() => {
    dispatch(MarketplaceActions.setLoginEntity());
  }, [dispatch]);

  const handleLogin = useCallback(
    (data: ToolsetLoginFormType) => {
      dispatch(
        ToolsetActions.startSignInProcess({
          authLevel:
            authLevel ??
            (isPublic
              ? ToolsetCredentialsLevel.USER
              : ToolsetCredentialsLevel.GLOBAL),
          apiKey: data.apiKey,
          toolset,
        }),
      );
      handleClose();
    },
    [dispatch, authLevel, isPublic, toolset, handleClose],
  );

  const handleLogout = useCallback(() => {
    dispatch(
      ToolsetActions.logOutToolset({
        authLevel:
          authLevel ??
          (isPublic
            ? ToolsetCredentialsLevel.USER
            : ToolsetCredentialsLevel.GLOBAL),
        authType: toolset.authSettings.authenticationType,
        toolsetId: toolset.id,
      }),
    );
    handleClose();
  }, [
    isPublic,
    dispatch,
    toolset.authSettings.authenticationType,
    toolset.id,
    handleClose,
    authLevel,
  ]);

  const handleVersionChange = useCallback(
    (toolset: ToolsetModel) => {
      dispatch(MarketplaceActions.setLoginEntity({ toolset }));
      setVersionChanged(true);
    },
    [dispatch],
  );

  const handleCredsTabClick = useCallback(
    (value: ToolsetCredentialsLevel) => {
      setAuthLevel(value);
      formMethods.reset(
        getDefaultLoginFormData({
          authenticationType: authType,
          toolset,
          prevData: { withLogin: WithLogin.WithLogin },
          authLevel: value,
        }),
      );
    },
    [authType, toolset, formMethods],
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

  if (!isOrganizationView && isSignedIn && !versionChanged)
    return (
      <ConfirmDialog
        isOpen
        heading={t(MarketplaceI18nKeys.LoggingOut)}
        description={t(MarketplaceI18nKeys.AreYouSureLogOut) as string}
        confirmLabel={t(MarketplaceI18nKeys.LogOutMarketplace)}
        cancelLabel={t(MarketplaceI18nKeys.CancelMarketplace)}
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
        <p
          className="text-base font-semibold text-primary"
          data-qa={isOrganizationView ? 'manage-creds-header' : 'login-header'}
        >
          {t(
            isOrganizationView
              ? MarketplaceI18nKeys.ManageCredentials
              : MarketplaceI18nKeys.LoginMarketplace,
          )}
        </p>
      </div>

      <div className="flex gap-2 px-6 py-4">
        <ModelIcon size={40} entityId={toolset.id} entity={toolset} />
        <div className="flex flex-col justify-between">
          <h3
            className="text-sm font-semibold text-primary"
            data-qa="toolset-name"
          >
            {toolset.name}
          </h3>
          <div className="flex items-center gap-1" data-qa="toolset-version">
            <span className="text-xs text-primary">
              {t(MarketplaceI18nKeys.VersionPrefixMarketplace)}
            </span>

            {toolset.version ? (
              <ModelVersionSelect
                entities={isAppsEditor ? [toolset] : allVersions}
                currentEntity={toolset}
                onSelect={handleVersionChange}
                className="truncate"
                triggerClassName="!text-xs bg-layer-4 rounded p-1"
              />
            ) : (
              <span className="text-xs text-secondary">{t(NA_VERSION)}</span>
            )}
          </div>
        </div>
      </div>

      <FormProvider {...formMethods}>
        <div className="flex flex-col gap-2 p-6">
          {isOrganizationView ? (
            credsTabs.map(({ label, key, Icon, triggerQa, contentQa }) => (
              <AuthAccordion
                className="!bg-layer-2"
                key={key}
                Icon={Icon}
                title={t(label)}
                isOpen={key === authLevel}
                onClick={() => handleCredsTabClick(key)}
                statusBadge={{
                  label: t(
                    isToolsetSignedIn(toolset, key)
                      ? MarketplaceI18nKeys.LoggedIn
                      : MarketplaceI18nKeys.LoggedOut,
                  ),
                  type: isToolsetSignedIn(toolset, key) ? 'success' : 'error',
                }}
                triggerQa={triggerQa}
                contentQa={contentQa}
              >
                <p className="text-sm text-primary">{organizationFormTitle}</p>

                <ToolsetLoginForm
                  credentialsLevel={authLevel}
                  type={toolset.authSettings.authenticationType}
                  toolset={toolset}
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
              credentialsLevel={
                isPublic
                  ? ToolsetCredentialsLevel.USER
                  : ToolsetCredentialsLevel.GLOBAL
              }
              type={toolset.authSettings.authenticationType}
              toolset={toolset}
              buttonClassName="ml-auto"
              onLogin={handleLogin}
              onLogout={handleLogout}
              hideConfigFields
              fieldsInfo={fieldsInfo}
              disabled={isToolsetLoading}
            />
          )}
        </div>
      </FormProvider>
    </Modal>
  );
});

export const ToolsetLoginDialog = view;
