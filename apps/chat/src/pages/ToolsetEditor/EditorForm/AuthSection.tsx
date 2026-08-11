import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  ConfirmationPopup,
  Input,
  DialRadioButton,
  DialTagInput,
  ElementSize,
  NotificationVariant,
  mergeClasses,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_TYPE_OPTIONS,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  WithLogin,
} from '../../../constants/toolsets';
import {
  ApiI18nKeys,
  AuthI18nKeys,
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import type {
  ToolsetAuthFormData,
  ToolsetFormErrors,
  ToolsetOAuthInitiationResult,
} from '../../../models/toolsets';
import { getApiErrorDetails } from '../../../server-api/api-error';
import { loginToolset, logoutToolset } from '../../../server-api/toolsets';
import {
  fetchToolsetAuthSettings,
  initiateOAuthLogin,
  isToolsetAuthValid,
  isValidEndpointUrl,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  waitForToolsetOAuthResult,
} from '../../../utils/toolsets';

interface Props {
  auth: ToolsetAuthFormData;
  errors: ToolsetFormErrors;
  isSaving: boolean;
  toolsetId: string;
  isEditMode: boolean;
  endpoint: string;
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
  onEnsureSaved: () => Promise<string | false>;
}

const ORDERED_AUTH_TYPES = [
  ToolsetAuthTypes.OAuth,
  ToolsetAuthTypes.ApiKey,
  ToolsetAuthTypes.None,
];

/*
 * OAuth defaults to WithConfig when no client is configured yet, so a
 * brand-new toolset can't be saved with an empty OAuth registration — the
 * config fields only render in WithConfig mode. Once a client exists (e.g.
 * loaded from a saved toolset), WithLogin becomes the default so switching
 * back to OAuth just reauthenticates against the existing config.
 */
const defaultWithLoginFor = (
  type: ToolsetAuthTypes,
  hasExistingOAuthConfig: boolean,
): WithLogin => {
  if (type === ToolsetAuthTypes.None) return WithLogin.WithoutLogin;
  if (type === ToolsetAuthTypes.OAuth && !hasExistingOAuthConfig) {
    return WithLogin.WithConfig;
  }
  return WithLogin.WithLogin;
};

const AuthSection: FC<Props> = ({
  auth,
  errors,
  isSaving,
  toolsetId,
  isEditMode,
  endpoint,
  onAuthChange,
  onEnsureSaved,
}) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isControlsDisabled = auth.isLoggedIn || isSaving || isAuthBusy;

  const canLogIn =
    isValidEndpointUrl(endpoint) &&
    isToolsetAuthValid(auth, isEditMode) &&
    !isControlsDisabled;

  const handleSelectType = (type: ToolsetAuthTypes) => {
    if (isControlsDisabled || type === auth.authenticationType) return;
    onAuthChange({
      authenticationType: type,
      withLogin: defaultWithLoginFor(type, Boolean(auth.clientId?.trim())),
    });
  };

  const handleWithLoginChange = (value: string) => {
    onAuthChange({ withLogin: value as WithLogin });
  };

  /*
   * Shared by both OAuth initiation paths below: waits for the popup result
   * and applies the same success/failure/cancelled handling regardless of
   * whether the authorize URL was built from already-known form state or
   * from settings freshly fetched after dynamic client registration.
   */
  const handleOAuthInitiation = async (
    initiation: ToolsetOAuthInitiationResult,
    savedToolsetId: string,
  ) => {
    if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
      /*
       * `InvalidConfig` means the authorize URL couldn't be built from a
       * known-good client (e.g. Core's dynamic client registration didn't
       * return a usable clientId/authorizationEndpoint) — distinct from a
       * browser-blocked popup, and from a generic post-redirect login
       * failure, so it gets its own actionable message.
       */
      const errorKey =
        initiation.type === ToolsetOAuthInitiationResultType.Blocked
          ? ToolsetEditorI18nKeys.ErrorPopupBlocked
          : ToolsetEditorI18nKeys.ErrorOAuthConfigMissing;
      showNotification({
        variant: NotificationVariant.Error,
        message: t(errorKey),
      });
      return;
    }

    setIsAuthBusy(true);
    const result = await waitForToolsetOAuthResult(
      initiation.popup,
      initiation.flowId,
      {
        toolsetId: savedToolsetId,
        credentialsLevel: ToolsetCredentialsLevel.User,
      },
    );
    setIsAuthBusy(false);

    if (result.type === ToolsetOAuthResultType.Success) {
      onAuthChange({ isLoggedIn: true });
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ToolsetEditorI18nKeys.LoginSuccess),
      });
    } else if (result.type === ToolsetOAuthResultType.Failure) {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
      });
    } else if (result.type === ToolsetOAuthResultType.Cancelled) {
      /*
       * Treat the backend as the final authority if popup tracking or
       * cross-process message delivery ever still reports a false cancel.
       * This keeps the form from showing "logged out" after a login that
       * actually completed server-side.
       */
      try {
        const refreshedAuth = await fetchToolsetAuthSettings(savedToolsetId);
        if (refreshedAuth.isLoggedIn) {
          onAuthChange({ isLoggedIn: true });
          showNotification({
            variant: NotificationVariant.Success,
            message: t(ToolsetEditorI18nKeys.LoginSuccess),
          });
        }
      } catch {
        // Best-effort verification only — a genuine cancel stays silent.
      }
    }
  };

  const handleLogIn = async () => {
    if (!canLogIn) return;

    if (auth.authenticationType === ToolsetAuthTypes.OAuth) {
      /*
       * "With Login" and no client id yet means this OAuth client relies on
       * Core's dynamic client registration (RFC 7591), which only assigns
       * `clientId`/`authorizationEndpoint` once the toolset is created — the
       * pre-save `auth` form state never carries them (the fields aren't
       * even rendered outside "With Login & Config"). Opening the popup
       * synchronously here, before the persist/fetch awaits, keeps it a
       * user-triggered popup rather than one browsers block as programmatic.
       */
      const needsDynamicRegistration =
        auth.withLogin === WithLogin.WithLogin && !auth.clientId?.trim();

      if (needsDynamicRegistration) {
        const popup = openToolsetOAuthPopup();
        if (!popup) {
          showNotification({
            variant: NotificationVariant.Error,
            message: t(ToolsetEditorI18nKeys.ErrorPopupBlocked),
          });
          return;
        }

        /*
         * Set busy immediately once the popup is open — this branch has two
         * awaits (persist, then fetch) before `handleOAuthInitiation` would
         * otherwise set it, and `onEnsureSaved` resolves in a single
         * microtask when the form is already saved and unchanged (it never
         * flips `isSaving`). Without this, a second click during that window
         * would open a second popup and start a second concurrent login.
         * The `finally` covers every exit from this branch — the two early
         * returns below, and both the Started and non-Started outcomes of
         * `handleOAuthInitiation` (which already clears busy itself for the
         * Started case, making this a harmless redundant reset).
         */
        setIsAuthBusy(true);
        try {
          const savedToolsetId = await onEnsureSaved();
          if (!savedToolsetId) {
            popup.close();
            return;
          }

          let resolvedAuth: ToolsetAuthFormData;
          try {
            resolvedAuth = await fetchToolsetAuthSettings(savedToolsetId);
          } catch (error) {
            popup.close();
            const { traceId } = await getApiErrorDetails(error);
            showNotification({
              variant: NotificationVariant.Error,
              message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
              requestId: traceId,
            });
            return;
          }
          onAuthChange(resolvedAuth);

          const initiation = navigateToolsetOAuthPopup(
            popup,
            resolvedAuth,
            savedToolsetId,
            ToolsetCredentialsLevel.User,
          );
          await handleOAuthInitiation(initiation, savedToolsetId);
        } finally {
          setIsAuthBusy(false);
        }
        return;
      }

      const savedToolsetId = await onEnsureSaved();
      if (!savedToolsetId) return;

      const initiation = initiateOAuthLogin(auth, savedToolsetId);
      await handleOAuthInitiation(initiation, savedToolsetId);
      return;
    }

    const savedToolsetId = await onEnsureSaved();
    if (!savedToolsetId) return;

    setIsAuthBusy(true);
    try {
      const body: ToolsetLoginBodyDto = {
        url: savedToolsetId,
        credentialsLevel:
          ToolsetCredentialsLevel.User as ToolsetLoginBodyDto['credentialsLevel'],
        authenticationType:
          auth.authenticationType as ToolsetLoginBodyDto['authenticationType'],
        apiKey: auth.apiKey?.trim(),
      };
      await loginToolset(savedToolsetId, body);
      onAuthChange({ isLoggedIn: true });
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ToolsetEditorI18nKeys.LoginSuccess),
      });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
        requestId: traceId,
      });
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleConfirmLogout = async () => {
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
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ToolsetEditorI18nKeys.LogoutSuccess),
      });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ToolsetEditorI18nKeys.ErrorLogoutFailed),
        requestId: traceId,
      });
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
          <PrimaryButton
            size={ElementSize.Small}
            label={t(ButtonsI18nKeys.LogOut)}
            onClick={() => setShowLogoutConfirm(true)}
            disabled={isSaving || isAuthBusy}
          />
        </div>
      );
    }
    return (
      <div className="flex">
        <PrimaryButton
          size={ElementSize.Small}
          label={t(ButtonsI18nKeys.LogIn)}
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
          <Input
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
          <Input
            id="toolset-client-secret"
            value={auth.clientSecret ?? ''}
            onChange={(value) => onAuthChange({ clientSecret: value ?? '' })}
            labelProps={{
              label: t(ToolsetEditorI18nKeys.ClientSecretLabel),
              required: !isEditMode,
            }}
            error={errors.clientSecret || undefined}
            invalid={!!errors.clientSecret}
            disabled={isControlsDisabled}
          />
          <Input
            id="toolset-authorization-endpoint"
            value={auth.authorizationEndpoint ?? ''}
            onChange={(value) =>
              onAuthChange({ authorizationEndpoint: value ?? '' })
            }
            labelProps={{
              label: t(ToolsetEditorI18nKeys.AuthorizationEndpointLabel),
            }}
            error={errors.authorizationEndpoint || undefined}
            invalid={!!errors.authorizationEndpoint}
            disabled={isControlsDisabled}
          />
          <Input
            id="toolset-token-endpoint"
            value={auth.tokenEndpoint ?? ''}
            onChange={(value) => onAuthChange({ tokenEndpoint: value ?? '' })}
            labelProps={{
              label: t(ToolsetEditorI18nKeys.TokenEndpointLabel),
            }}
            error={errors.tokenEndpoint || undefined}
            invalid={!!errors.tokenEndpoint}
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

      <div className="flex flex-col gap-3">
        <Input
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

        {auth.withLogin === WithLogin.WithLogin && (
          <Input
            id="toolset-api-key"
            value={auth.apiKey ?? ''}
            onChange={(value) => onAuthChange({ apiKey: value ?? '' })}
            labelProps={{
              label: t(ApiI18nKeys.ApiKey),
              required: true,
            }}
            error={errors.apiKey || undefined}
            invalid={!!errors.apiKey}
            disabled={isControlsDisabled}
          />
        )}
      </div>

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
                isSelected ? 'border-s-info' : 'border-s-transparent',
                isLocked && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => handleSelectType(type)}
              disabled={isLocked}
            >
              <Icon
                size={DIAL_ICON_SIZE.SM}
                className={isSelected ? 'text-accent' : 'text-secondary'}
              />
              <span
                className={mergeClasses(
                  'text-sm',
                  isSelected ? 'text-accent' : 'text-primary',
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

      {showLogoutConfirm && (
        <ConfirmationPopup
          open={showLogoutConfirm}
          header={t(AuthI18nKeys.LogOutConfirmTitle)}
          description={t(ToolsetEditorI18nKeys.LogoutConfirmDescription)}
          confirmLabel={t(ButtonsI18nKeys.LogOut)}
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
