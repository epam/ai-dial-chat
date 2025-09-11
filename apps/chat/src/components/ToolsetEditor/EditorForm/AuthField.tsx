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

import {
  getToolsetRedirectUri,
  isToolsetSignedIn,
} from '@/src/utils/app/toolsets';

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
}

interface AuthTypeSectionProps {
  type: ToolsetAuthTypes;
  isSelected: boolean;
  onClick: (type: ToolsetAuthTypes) => void;
  onLogout?: () => void;
  onLogin?: (data: ToolsetLoginFormType) => void;
}

const AuthTypeSection = ({
  type,
  isSelected,
  onClick,
  onLogout,
  onLogin,
}: AuthTypeSectionProps) => {
  const { t } = useTranslation(Translation.Common);

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const [withLogin, setWithLogin] = useState(WithLogin.WithLogin);
  const isWithLogin = withLogin === WithLogin.WithLogin;
  const isSignedIn = toolsetDetails && isToolsetSignedIn(toolsetDetails);

  const handleWithLoginChange = (e: ChangeEvent<HTMLInputElement>) => {
    setWithLogin(e.currentTarget.value as WithLogin);
  };

  const { Icon, name } = authTypeOptions[type];

  const handleOnClick = useCallback(() => {
    if (!isSignedIn) onClick(type);
  }, [isSignedIn, onClick, type]);

  return (
    <Tooltip
      hideTooltip={!isSignedIn || isSelected}
      tooltip={t('Log out before changing authentication type')}
      triggerClassName="w-full"
    >
      <div className="overflow-hidden rounded bg-layer-3">
        <div
          onClick={handleOnClick}
          className={classNames(
            'flex gap-3 border-l p-4',
            isSelected ? 'border-accent-primary' : 'border-transparent',
            !isSelected && !isSignedIn && 'cursor-pointer',
          )}
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
        </div>

        {isSelected && type !== ToolsetAuthTypes.NONE && (
          <div className="grid grid-cols-2 border-t border-tertiary">
            <div className="flex flex-col gap-4 p-4">
              <RadioButton
                id={WithLogin.WithLogin}
                name="with-auth"
                caption={t(WithLogin.WithLogin)}
                onChange={handleWithLoginChange}
                value={WithLogin.WithLogin}
                checked={isWithLogin}
              />

              <ToolsetLoginForm
                onLogin={onLogin}
                type={type}
                toolset={toolsetDetails}
                disabled={!isWithLogin}
                onLogout={onLogout}
                showOAuthClientForm
              />
            </div>
            <div className="p-4">
              <RadioButton
                id={WithLogin.WithoutLogin}
                name="with-auth"
                caption={t(WithLogin.WithoutLogin)}
                onChange={handleWithLoginChange}
                value={WithLogin.WithoutLogin}
                checked={!isWithLogin}
                disabled={isSignedIn}
              />
            </div>
          </div>
        )}
      </div>
    </Tooltip>
  );
};

export const AuthField = () => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const { control, trigger } = useFormContext<ToolsetEditorForm>();
  const [endpoint, transport, allowedTools] = useWatch({
    name: ['endpoint', 'protocol', 'allowedTools'],
    control,
  });

  const [logoutModal, setLogoutModal] = useState(false);

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
          dispatch(
            ToolsetActions.updateToolset({
              oldToolset: toolsetDetails,
              newToolset: {
                ...toolsetDetails,
                endpoint,
                transport,
                allowedTools,
                authSettings: {
                  ...toolsetDetails.authSettings,
                  authenticationType: data.type,
                  apiKeyHeader:
                    data.type === ToolsetAuthTypes.API_KEY
                      ? data.keyHeader
                      : undefined,
                  redirectUri:
                    data.type === ToolsetAuthTypes.OAUTH
                      ? getToolsetRedirectUri()
                      : undefined,
                  ...(data.clientId &&
                    data.clientSecret && {
                      clientId: data.clientId,
                      clientSecret: data.clientSecret,
                    }),
                  ...(data.authorizationEndpoint && {
                    authorizationEndpoint: data.authorizationEndpoint,
                  }),
                  ...(data.tokenEndpoint && {
                    tokenEndpoint: data.tokenEndpoint,
                  }),
                },
              },
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
              type={ToolsetAuthTypes.OAUTH}
              isSelected={field.value === ToolsetAuthTypes.OAUTH}
              onClick={field.onChange}
              onLogout={handleLogoutClick}
              onLogin={handleLogIn}
            />
            <AuthTypeSection
              type={ToolsetAuthTypes.API_KEY}
              isSelected={field.value === ToolsetAuthTypes.API_KEY}
              onClick={field.onChange}
              onLogout={handleLogoutClick}
              onLogin={handleLogIn}
            />
            <AuthTypeSection
              type={ToolsetAuthTypes.NONE}
              isSelected={field.value === ToolsetAuthTypes.NONE}
              onClick={field.onChange}
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
