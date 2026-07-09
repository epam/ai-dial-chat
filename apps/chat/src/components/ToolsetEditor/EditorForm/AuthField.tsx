import { ChangeEvent, useCallback, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getToolsetPayload, isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { AUTH_TYPE_OPTIONS } from '@/src/constants/toolsets';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { RadioButton } from '@/src/components/Common/Forms/RadioButton';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { AuthAccordion } from '@/src/components/ToolsetEditor/AuthAccordion';
import { ToolsetLoginForm } from '@/src/components/ToolsetEditor/ToolsetLoginForm';
import {
  ToolsetEditorForm,
  ToolsetLoginFormType,
  WithLogin,
} from '@/src/components/ToolsetEditor/form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

interface AuthTypeSectionProps {
  type: ToolsetAuthTypes;
  isSelected: boolean;
  isDisabled?: boolean;
  tooltip?: string;
  withLogin?: WithLogin;
  onClick: (type: ToolsetAuthTypes) => void;
  onWithLoginChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onLogout?: () => void;
  onLogin?: (data: ToolsetLoginFormType) => void;
}

const AuthTypeSection = ({
  type,
  isSelected,
  isDisabled,
  tooltip,
  withLogin = WithLogin.WithoutLogin,
  onClick,
  onWithLoginChange,
  onLogout,
  onLogin,
}: AuthTypeSectionProps) => {
  const { t } = useTranslation(Translation.Common);

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const isSignedIn = toolsetDetails && isToolsetSignedIn(toolsetDetails);

  const { Icon, name } = AUTH_TYPE_OPTIONS[type];

  const handleOnClick = useCallback(() => {
    if (!isSignedIn) onClick(type);
  }, [isSignedIn, onClick, type]);

  const isSectionDisabled = isSelected || isDisabled || isSignedIn;

  return (
    <Tooltip
      hideTooltip={(!isSignedIn && !isDisabled) || isSelected}
      tooltip={tooltip ?? t(CommonI18nKeys.LogOutBeforeChangingAuthType)}
      triggerClassName="w-full"
    >
      <AuthAccordion
        Icon={Icon}
        title={name}
        isOpen={isSelected}
        onClick={handleOnClick}
        disabled={isSectionDisabled}
        triggerQa={type.toString().toLowerCase()}
        titleQa={type.toString().toLowerCase().concat('-label')}
        contentQa="auth-details-container"
      >
        {type !== ToolsetAuthTypes.NONE && (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <RadioButton
                id={WithLogin.WithLogin}
                name="with-auth"
                caption={t(CommonI18nKeys.WithLoginLabel)}
                onChange={onWithLoginChange}
                value={WithLogin.WithLogin}
                checked={withLogin === WithLogin.WithLogin}
                disabled={isDisabled}
                tooltip={tooltip}
              />

              {type === ToolsetAuthTypes.OAUTH && (
                <RadioButton
                  id={WithLogin.WithConfig}
                  name="with-auth"
                  caption={t(CommonI18nKeys.WithLoginAndConfig)}
                  onChange={onWithLoginChange}
                  value={WithLogin.WithConfig}
                  checked={withLogin === WithLogin.WithConfig}
                  disabled={isSignedIn || isDisabled}
                  tooltip={tooltip}
                />
              )}

              {type !== ToolsetAuthTypes.OAUTH && (
                <RadioButton
                  id={WithLogin.WithoutLogin}
                  name="with-auth"
                  caption={t(CommonI18nKeys.WithoutLoginLabel)}
                  onChange={onWithLoginChange}
                  value={WithLogin.WithoutLogin}
                  checked={withLogin === WithLogin.WithoutLogin}
                  disabled={isSignedIn || isDisabled}
                  tooltip={tooltip}
                />
              )}
            </div>

            {(withLogin !== WithLogin.WithoutLogin ||
              type === ToolsetAuthTypes.API_KEY) && (
              <ToolsetLoginForm
                onLogin={onLogin}
                type={type}
                toolset={toolsetDetails}
                onLogout={onLogout}
                disabled={isDisabled}
                fieldsTooltip={tooltip}
                withRepair
              />
            )}
          </>
        )}
      </AuthAccordion>
    </Tooltip>
  );
};

interface AuthFieldProps {
  isDisabled?: boolean;
  tooltip?: string;
}

export const AuthField = ({ isDisabled, tooltip }: AuthFieldProps) => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const { control, trigger, clearErrors, setValue } =
    useFormContext<ToolsetEditorForm>();
  const [endpoint, transport, allowedTools, withLogin] = useWatch({
    name: ['endpoint', 'protocol', 'allowedTools', 'withLogin'],
    control,
  });

  const [logoutModal, setLogoutModal] = useState(false);

  const updateWithLogin = useCallback(
    (value: WithLogin) => {
      if (value !== WithLogin.WithConfig) {
        clearErrors(['clientId', 'clientSecret']);
      }
      setValue('withLogin', value, {
        shouldDirty: false,
        shouldValidate: true,
      });
    },
    [clearErrors, setValue],
  );

  const handleWithLoginChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      updateWithLogin(e.currentTarget.value as WithLogin);
    },
    [updateWithLogin],
  );

  const handleSelectAuthType = useCallback(
    (type: ToolsetAuthTypes) => {
      setValue('authenticationType', type, { shouldDirty: true });
      updateWithLogin(WithLogin.WithLogin);
    },
    [setValue, updateWithLogin],
  );

  const handleLogoutClick = useCallback(() => {
    setLogoutModal(true);
  }, []);

  const handleLogoutClose = useCallback(
    (result: boolean) => {
      if (result && toolsetDetails) {
        dispatch(
          ToolsetActions.logOutToolset({
            authLevel: ToolsetCredentialsLevel.GLOBAL,
            authType: toolsetDetails.authSettings.authenticationType,
            toolsetId: toolsetDetails.id,
          }),
        );
      }
      setLogoutModal(false);
    },
    [dispatch, toolsetDetails],
  );

  const handleLogIn = useCallback(
    (data: ToolsetLoginFormType) => {
      trigger(['endpoint']).then((isValid) => {
        if (toolsetDetails && isValid) {
          const newToolset = getToolsetPayload(
            {
              ...toolsetDetails,
              endpoint: endpoint.trim(),
              transport,
              allowedTools,
              authSettings: {
                authenticationType: data.authenticationType,
                apiKeyHeader: data.keyHeader,
                ...(data.withLogin === WithLogin.WithConfig && {
                  clientId: data.clientId,
                  clientSecret: data.clientSecret,
                  authorizationEndpoint: data.authorizationEndpoint,
                  tokenEndpoint: data.tokenEndpoint,
                  scopesSupported: data.scopes,
                }),
              },
            },
            toolsetDetails,
          );

          dispatch(
            ToolsetActions.updateToolset({
              oldToolset: toolsetDetails,
              newToolset,
              auth: {
                apiKey: data.apiKey,
              },
            }),
          );
        }
      });
    },
    [allowedTools, dispatch, endpoint, toolsetDetails, transport, trigger],
  );

  return (
    <div className="flex flex-col gap-2" data-qa="auth-container">
      <Controller
        name="authenticationType"
        control={control}
        render={({ field }) => (
          <>
            <AuthTypeSection
              isDisabled={isDisabled}
              type={ToolsetAuthTypes.OAUTH}
              isSelected={field.value === ToolsetAuthTypes.OAUTH}
              onClick={handleSelectAuthType}
              onWithLoginChange={handleWithLoginChange}
              onLogout={handleLogoutClick}
              onLogin={handleLogIn}
              withLogin={withLogin}
              tooltip={tooltip}
            />
            <AuthTypeSection
              isDisabled={isDisabled}
              type={ToolsetAuthTypes.API_KEY}
              isSelected={field.value === ToolsetAuthTypes.API_KEY}
              onClick={handleSelectAuthType}
              onWithLoginChange={handleWithLoginChange}
              onLogout={handleLogoutClick}
              onLogin={handleLogIn}
              withLogin={withLogin}
              tooltip={tooltip}
            />
            <AuthTypeSection
              isDisabled={isDisabled}
              type={ToolsetAuthTypes.NONE}
              isSelected={field.value === ToolsetAuthTypes.NONE}
              onClick={handleSelectAuthType}
              onWithLoginChange={handleWithLoginChange}
              tooltip={tooltip}
            />
          </>
        )}
      />

      <ConfirmDialog
        isOpen={logoutModal}
        heading={t(CommonI18nKeys.LoggingOutCommon)}
        description={t(CommonI18nKeys.AreYouSureLogOutCommon)}
        confirmLabel={t(CommonI18nKeys.LogOutCommon)}
        cancelLabel={t(CommonI18nKeys.Cancel)}
        onClose={handleLogoutClose}
      />
    </div>
  );
};
