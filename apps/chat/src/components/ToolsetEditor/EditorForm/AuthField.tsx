import {
  Icon,
  IconBrandOauth,
  IconKey,
  IconLockOff,
  IconProps,
} from '@tabler/icons-react';
import {
  ChangeEvent,
  ForwardRefExoticComponent,
  RefAttributes,
  useCallback,
  useState,
} from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getToolsetPayload, isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { RadioButton } from '@/src/components/Common/Forms/RadioButton';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ToolsetLoginForm } from '@/src/components/ToolsetEditor/ToolsetLoginForm';
import {
  ToolsetEditorForm,
  ToolsetLoginFormType,
} from '@/src/components/ToolsetEditor/form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

const authTypeOptions: Record<
  string,
  {
    name: string;
    Icon: ForwardRefExoticComponent<IconProps & RefAttributes<Icon>>;
  }
> = {
  [ToolsetAuthTypes.OAUTH]: {
    name: 'OAuth',
    Icon: IconBrandOauth,
  },
  [ToolsetAuthTypes.API_KEY]: {
    name: 'API Key',
    Icon: IconKey,
  },
  [ToolsetAuthTypes.NONE]: {
    name: 'Without authentication',
    Icon: IconLockOff,
  },
};

enum WithLogin {
  WithLogin = 'With login',
  WithoutLogin = 'Without login',
  WithConfig = 'With login & config',
}

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

  const { Icon, name } = authTypeOptions[type];

  const handleOnClick = useCallback(() => {
    if (!isSignedIn) onClick(type);
  }, [isSignedIn, onClick, type]);

  const isSectionDisabled = isSelected || isDisabled || isSignedIn;

  return (
    <Tooltip
      hideTooltip={(!isSignedIn && !isDisabled) || isSelected}
      tooltip={tooltip ?? t('Log out before changing authentication type')}
      triggerClassName="w-full"
    >
      <div className="overflow-hidden rounded bg-layer-3">
        <button
          onClick={handleOnClick}
          className={classNames(
            'flex w-full gap-3 border-l p-4',
            isSelected ? 'border-accent-primary' : 'border-transparent',
            isSectionDisabled && 'cursor-not-allowed',
          )}
          disabled={isSectionDisabled}
        >
          <Icon
            size={18}
            className={classNames(
              isSelected ? 'text-accent-primary' : 'text-secondary',
            )}
          />

          <span
            className={classNames(
              'text-sm font-semibold',
              isSelected ? 'text-accent-primary' : 'text-primary',
            )}
          >
            {name}
          </span>
        </button>

        {isSelected && type !== ToolsetAuthTypes.NONE && (
          <div className="flex flex-col gap-4 border-t border-tertiary p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <RadioButton
                id={WithLogin.WithLogin}
                name="with-auth"
                caption={t(WithLogin.WithLogin)}
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
                  caption={t(WithLogin.WithConfig)}
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
                  caption={t(WithLogin.WithoutLogin)}
                  onChange={onWithLoginChange}
                  value={WithLogin.WithoutLogin}
                  checked={withLogin === WithLogin.WithoutLogin}
                  disabled={isSignedIn || isDisabled}
                  tooltip={tooltip}
                />
              )}
            </div>

            {withLogin !== WithLogin.WithoutLogin && (
              <ToolsetLoginForm
                onLogin={onLogin}
                type={type}
                toolset={toolsetDetails}
                onLogout={onLogout}
                disabled={isDisabled}
                fieldsTooltip={tooltip}
              />
            )}
          </div>
        )}
      </div>
    </Tooltip>
  );
};

const getWithLoginInitialValue = (formData: ToolsetEditorForm) => {
  if (
    formData.authenticationType === ToolsetAuthTypes.OAUTH &&
    formData.includeOAuthFields
  ) {
    return WithLogin.WithConfig;
  }
  return WithLogin.WithLogin;
};

interface AuthFieldProps {
  isDisabled?: boolean;
  tooltip?: string;
}

export const AuthField = ({ isDisabled, tooltip }: AuthFieldProps) => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const { control, trigger, clearErrors, setValue, getValues } =
    useFormContext<ToolsetEditorForm>();
  const [endpoint, transport, allowedTools] = useWatch({
    name: ['endpoint', 'protocol', 'allowedTools'],
    control,
  });

  const [logoutModal, setLogoutModal] = useState(false);
  const [withLogin, setWithLogin] = useState(
    getWithLoginInitialValue(getValues()),
  );

  const updateWithLogin = useCallback(
    (value: WithLogin) => {
      setWithLogin(value);
      if (value !== WithLogin.WithConfig) {
        clearErrors(['clientId', 'clientSecret']);
      }
      setValue('includeOAuthFields', value === WithLogin.WithConfig, {
        shouldDirty: false,
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
              endpoint,
              transport,
              allowedTools,
              authSettings: {
                authenticationType: data.authenticationType,
                apiKeyHeader: data.keyHeader,
                ...(data.includeOAuthFields && {
                  clientId: data.clientId,
                  clientSecret: data.clientSecret,
                  authorizationEndpoint: data.authorizationEndpoint,
                  tokenEndpoint: data.tokenEndpoint,
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
    <div className="flex flex-col gap-2">
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
        heading={t('Logging out')}
        description={t('Are you sure you want to log out?')}
        confirmLabel={t('Log out')}
        cancelLabel={t('Cancel')}
        onClose={handleLogoutClose}
      />
    </div>
  );
};
