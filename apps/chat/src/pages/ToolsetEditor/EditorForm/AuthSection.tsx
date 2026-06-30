import {
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DialConfirmationPopup,
  DialInput,
  DialNotification,
  DialPrimaryButton,
  DialRadioButton,
  DialTagInput,
  ElementSize,
  NotificationVariant,
  mergeClasses,
} from '@epam/ai-dial-ui-kit';
import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_TYPE_OPTIONS,
  TOOLSET_REDIRECT_STATE_KEY,
} from '../../../constants/toolsets';
import {
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { loginToolset, logoutToolset } from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormErrors,
  ToolsetRedirectState,
} from '../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '../../../types/toolsets';

interface Props {
  auth: ToolsetAuthFormData;
  errors: ToolsetFormErrors;
  isSaving: boolean;
  toolsetId: string;
  endpoint: string;
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
}

const ORDERED_AUTH_TYPES = [
  ToolsetAuthTypes.OAuth,
  ToolsetAuthTypes.ApiKey,
  ToolsetAuthTypes.None,
];

const defaultWithLoginFor = (type: ToolsetAuthTypes): WithLogin => {
  if (type === ToolsetAuthTypes.None) return WithLogin.WithoutLogin;
  return WithLogin.WithLogin;
};

const buildAuthorizeUrl = (
  auth: ToolsetAuthFormData,
  redirectUri: string,
): string | null => {
  if (!auth.authorizationEndpoint?.trim() || !auth.clientId?.trim()) {
    return null;
  }
  try {
    const url = new URL(auth.authorizationEndpoint.trim());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', auth.clientId.trim());
    url.searchParams.set('redirect_uri', redirectUri);
    if (auth.scopes && auth.scopes.length > 0) {
      url.searchParams.set('scope', auth.scopes.join(' '));
    }
    return url.toString();
  } catch {
    return null;
  }
};

const AuthSection: FC<Props> = ({
  auth,
  errors,
  isSaving,
  toolsetId,
  endpoint,
  onAuthChange,
}) => {
  const { t } = useTranslation();
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authActionError, setAuthActionError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isControlsDisabled = auth.isLoggedIn || isSaving || isAuthBusy;

  const isLoginFormValid = useMemo(() => {
    if (auth.isLoggedIn) return true;
    const { authenticationType: type, withLogin: wl } = auth;
    if (type === ToolsetAuthTypes.OAuth && wl === WithLogin.WithConfig) {
      return Boolean(auth.clientId?.trim() && auth.clientSecret?.trim());
    }
    if (type === ToolsetAuthTypes.ApiKey && wl === WithLogin.WithLogin) {
      return Boolean(auth.keyHeader?.trim());
    }
    return true;
  }, [auth]);

  const canLogIn =
    Boolean(endpoint.trim()) && isLoginFormValid && !isControlsDisabled;

  const handleSelectType = (type: ToolsetAuthTypes) => {
    if (isControlsDisabled || type === auth.authenticationType) return;
    onAuthChange({
      authenticationType: type,
      withLogin: defaultWithLoginFor(type),
    });
  };

  const handleWithLoginChange = (value: string) => {
    onAuthChange({ withLogin: value as WithLogin });
  };

  const handleLogIn = async () => {
    if (!canLogIn) return;
    setAuthActionError('');

    if (auth.authenticationType === ToolsetAuthTypes.OAuth) {
      const redirectUri = `${window.location.origin}${ROUTES.ToolsetEditorCallback}`;
      const authorizeUrl = buildAuthorizeUrl(auth, redirectUri);
      if (!authorizeUrl) {
        setAuthActionError(t(ToolsetEditorI18nKeys.ErrorLoginFailed));
        return;
      }
      const redirectState: ToolsetRedirectState = {
        toolsetId,
        credentialsLevel: ToolsetCredentialsLevel.User,
        callbackUrl: window.location.href,
      };
      sessionStorage.setItem(
        TOOLSET_REDIRECT_STATE_KEY,
        JSON.stringify(redirectState),
      );
      window.location.href = authorizeUrl;
      return;
    }

    setIsAuthBusy(true);
    try {
      const body: ToolsetLoginBodyDto = {
        url: toolsetId,
        credentialsLevel:
          ToolsetCredentialsLevel.User as ToolsetLoginBodyDto['credentialsLevel'],
        authenticationType:
          auth.authenticationType as ToolsetLoginBodyDto['authenticationType'],
        apiKey: auth.apiKey,
      };
      await loginToolset(toolsetId, body);
      onAuthChange({ isLoggedIn: true });
    } catch {
      setAuthActionError(t(ToolsetEditorI18nKeys.ErrorLoginFailed));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleConfirmLogout = async () => {
    setAuthActionError('');
    setIsAuthBusy(true);
    try {
      const body: ToolsetLogoutBodyDto = {
        url: toolsetId,
        credentialsLevel:
          ToolsetCredentialsLevel.User as ToolsetLogoutBodyDto['credentialsLevel'],
        authenticationType:
          auth.authenticationType as ToolsetLogoutBodyDto['authenticationType'],
      };
      await logoutToolset(toolsetId, body);
      onAuthChange({ isLoggedIn: false });
      setShowLogoutConfirm(false);
    } catch {
      setAuthActionError(t(ToolsetEditorI18nKeys.ErrorLogoutFailed));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const renderLoginStatus = () => {
    if (auth.isLoggedIn) {
      return (
        <div className="flex items-center gap-3">
          <span className="dial-small-text text-success">
            {t(ToolsetEditorI18nKeys.LoggedInLabel)}
          </span>
          <DialPrimaryButton
            type="button"
            size={ElementSize.Small}
            label={t(ToolsetEditorI18nKeys.LogOutButton)}
            onClick={() => setShowLogoutConfirm(true)}
            disabled={isSaving || isAuthBusy}
          />
        </div>
      );
    }
    return (
      <div className="flex">
        <DialPrimaryButton
          type="button"
          size={ElementSize.Small}
          label={t(ToolsetEditorI18nKeys.LogInButton)}
          onClick={handleLogIn}
          disabled={!canLogIn}
        />
      </div>
    );
  };

  const renderOAuthContent = () => (
    <div className="flex flex-col gap-3 pb-3 ps-4">
      <div className="flex flex-col gap-2">
        <DialRadioButton
          name="oauth-login-mode"
          inputId="oauth-with-login"
          value={WithLogin.WithLogin}
          label={t(ToolsetEditorI18nKeys.WithLoginLabel)}
          checked={auth.withLogin === WithLogin.WithLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
        <DialRadioButton
          name="oauth-login-mode"
          inputId="oauth-with-config"
          value={WithLogin.WithConfig}
          label={t(ToolsetEditorI18nKeys.WithConfigLabel)}
          checked={auth.withLogin === WithLogin.WithConfig}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
      </div>

      {auth.withLogin === WithLogin.WithConfig && (
        <div className="flex flex-col gap-3">
          <DialInput
            id="toolset-client-id"
            value={auth.clientId ?? ''}
            onChange={(value) => onAuthChange({ clientId: value ?? '' })}
            labelProps={{
              label: t(ToolsetEditorI18nKeys.ClientIdLabel),
              required: true,
            }}
            error={errors.clientId || undefined}
            invalid={!!errors.clientId}
            disabled={isControlsDisabled}
          />
          <DialInput
            id="toolset-client-secret"
            value={auth.clientSecret ?? ''}
            onChange={(value) => onAuthChange({ clientSecret: value ?? '' })}
            labelProps={{
              label: t(ToolsetEditorI18nKeys.ClientSecretLabel),
              required: true,
            }}
            error={errors.clientSecret || undefined}
            invalid={!!errors.clientSecret}
            disabled={isControlsDisabled}
          />
          <DialInput
            id="toolset-authorization-endpoint"
            value={auth.authorizationEndpoint ?? ''}
            onChange={(value) =>
              onAuthChange({ authorizationEndpoint: value ?? '' })
            }
            labelProps={{
              label: t(ToolsetEditorI18nKeys.AuthorizationEndpointLabel),
            }}
            disabled={isControlsDisabled}
          />
          <DialInput
            id="toolset-token-endpoint"
            value={auth.tokenEndpoint ?? ''}
            onChange={(value) => onAuthChange({ tokenEndpoint: value ?? '' })}
            labelProps={{ label: t(ToolsetEditorI18nKeys.TokenEndpointLabel) }}
            disabled={isControlsDisabled}
          />
          <DialTagInput
            elementId="toolset-scopes"
            label={t(ToolsetEditorI18nKeys.ScopesLabel)}
            placeholder={t(ToolsetEditorI18nKeys.ScopesPlaceholder)}
            initialTags={auth.scopes ?? []}
            onChange={(scopes) => onAuthChange({ scopes })}
            disabled={isControlsDisabled}
          />
        </div>
      )}

      {renderLoginStatus()}
    </div>
  );

  const renderApiKeyContent = () => (
    <div className="flex flex-col gap-3 pb-3 ps-4">
      <div className="flex flex-col gap-2">
        <DialRadioButton
          name="apikey-login-mode"
          inputId="apikey-with-login"
          value={WithLogin.WithLogin}
          label={t(ToolsetEditorI18nKeys.WithLoginLabel)}
          checked={auth.withLogin === WithLogin.WithLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
        <DialRadioButton
          name="apikey-login-mode"
          inputId="apikey-without-login"
          value={WithLogin.WithoutLogin}
          label={t(ToolsetEditorI18nKeys.WithoutLoginLabel)}
          checked={auth.withLogin === WithLogin.WithoutLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
      </div>

      {auth.withLogin === WithLogin.WithLogin && (
        <div className="flex flex-col gap-3">
          <DialInput
            id="toolset-key-header"
            value={auth.keyHeader ?? ''}
            onChange={(value) => onAuthChange({ keyHeader: value ?? '' })}
            labelProps={{
              label: t(ToolsetEditorI18nKeys.KeyHeaderLabel),
              required: true,
            }}
            error={errors.keyHeader || undefined}
            invalid={!!errors.keyHeader}
            disabled={isControlsDisabled}
          />
          <DialInput
            id="toolset-api-key"
            value={auth.apiKey ?? ''}
            onChange={(value) => onAuthChange({ apiKey: value ?? '' })}
            labelProps={{ label: t(ToolsetEditorI18nKeys.ApiKeyLabel) }}
            disabled={isControlsDisabled}
          />
        </div>
      )}

      {auth.withLogin !== WithLogin.WithoutLogin && renderLoginStatus()}
    </div>
  );

  return (
    <section className="flex flex-col gap-2">
      <span className="dial-small-text text-secondary">
        {t(ToolsetEditorI18nKeys.AuthSectionTitle)}
      </span>

      {ORDERED_AUTH_TYPES.map((type) => {
        const option = AUTH_TYPE_OPTIONS[type];
        const Icon = option.Icon;
        const isSelected = auth.authenticationType === type;
        const isLocked = isControlsDisabled && !isSelected;

        return (
          <div key={type}>
            <button
              type="button"
              className={mergeClasses(
                'flex w-full items-center gap-3 border-s-2 px-4 py-3',
                isSelected ? 'border-s-accent-primary' : 'border-s-transparent',
                isLocked && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => handleSelectType(type)}
              disabled={isLocked}
            >
              <Icon
                size={DIAL_ICON_SIZE.SM}
                className={
                  isSelected ? 'text-accent-primary' : 'text-secondary'
                }
              />
              <span
                className={mergeClasses(
                  'text-sm',
                  isSelected ? 'text-accent-primary' : 'text-primary',
                )}
              >
                {t(option.labelKey)}
              </span>
            </button>

            {isSelected &&
              type === ToolsetAuthTypes.OAuth &&
              renderOAuthContent()}
            {isSelected &&
              type === ToolsetAuthTypes.ApiKey &&
              renderApiKeyContent()}
          </div>
        );
      })}

      {authActionError && (
        <DialNotification
          variant={NotificationVariant.Error}
          message={authActionError}
        />
      )}

      {showLogoutConfirm && (
        <DialConfirmationPopup
          open={showLogoutConfirm}
          header={t(ToolsetEditorI18nKeys.LogoutConfirmTitle)}
          description={t(ToolsetEditorI18nKeys.LogoutConfirmDescription)}
          confirmLabel={t(ToolsetEditorI18nKeys.LogOutButton)}
          cancelLabel={t(ButtonsI18nKeys.Cancel)}
          variant={ConfirmationPopupVariant.Danger}
          isLoading={isAuthBusy}
          disableConfirmButton={isAuthBusy}
          onConfirm={handleConfirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
          onClose={() => setShowLogoutConfirm(false)}
        />
      )}
    </section>
  );
};

export default memo(AuthSection);
