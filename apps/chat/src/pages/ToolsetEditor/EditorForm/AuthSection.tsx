import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  type ToolsetOAuthInitiationResult,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  waitForToolsetOAuthResult,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import { TAG_INPUT_TAG_CLASS_NAME } from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Input,
  NeutralButton,
  Radio,
  SegmentedControl,
  TagInput,
} from '@epam/ai-dial-ui-kit';
import { IconLogin, IconLogout } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTH_TYPE_OPTIONS } from '../../../constants/toolsets';
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
} from '../../../models/toolsets';
import { loginToolset, logoutToolset } from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import {
  fetchToolsetAuthSettings,
  isToolsetAuthValid,
  isValidEndpointUrl,
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
  const { showSuccessNotification, showErrorNotification } = useNotification();
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
      showErrorNotification({
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
        callbackPath: ROUTES.ToolsetSignIn,
      },
    );
    setIsAuthBusy(false);

    if (result.type === ToolsetOAuthResultType.Success) {
      onAuthChange({ isLoggedIn: true });
      showSuccessNotification({
        message: t(ToolsetEditorI18nKeys.LoginSuccess),
      });
    } else if (result.type === ToolsetOAuthResultType.Failure) {
      showErrorNotification({
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
          showSuccessNotification({
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
          showErrorNotification({
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
            showErrorNotification({
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
            ROUTES.ToolsetSignIn,
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

      const initiation = initiateOAuthLogin(
        auth,
        savedToolsetId,
        ROUTES.ToolsetSignIn,
      );
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
      showSuccessNotification({
        message: t(ToolsetEditorI18nKeys.LoginSuccess),
      });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      showErrorNotification({
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
      showSuccessNotification({
        message: t(ToolsetEditorI18nKeys.LogoutSuccess),
      });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      showErrorNotification({
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
        <div className="flex">
          <NeutralButton
            label={t(ButtonsI18nKeys.LogOut)}
            iconBefore={
              <IconLogout
                size={DIAL_ICON_SIZE.MD}
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            onClick={() => setShowLogoutConfirm(true)}
            disabled={isSaving || isAuthBusy}
          />
        </div>
      );
    }
    return (
      <div className="flex">
        <NeutralButton
          label={t(ButtonsI18nKeys.LogIn)}
          iconBefore={
            <IconLogin size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />
          }
          onClick={handleLogIn}
          disabled={!canLogIn}
        />
      </div>
    );
  };

  const renderOAuthContent = () => (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-2">
        <Radio
          name="oauth-login-mode"
          id="oauth-with-login"
          value={WithLogin.WithLogin}
          labelProps={{ label: t(ToolsetEditorI18nKeys.WithLoginOAuthLabel) }}
          isSelected={auth.withLogin === WithLogin.WithLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
        <Radio
          name="oauth-login-mode"
          id="oauth-with-config"
          value={WithLogin.WithConfig}
          labelProps={{ label: t(ToolsetEditorI18nKeys.WithConfigOAuthLabel) }}
          isSelected={auth.withLogin === WithLogin.WithConfig}
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
            placeholder={t(ToolsetEditorI18nKeys.ClientIdPlaceholder)}
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
            placeholder={t(ToolsetEditorI18nKeys.ClientSecretPlaceholder)}
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
            placeholder={t(
              ToolsetEditorI18nKeys.AuthorizationEndpointPlaceholder,
            )}
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
            placeholder={t(ToolsetEditorI18nKeys.TokenEndpointPlaceholder)}
            error={errors.tokenEndpoint || undefined}
            invalid={!!errors.tokenEndpoint}
            disabled={isControlsDisabled}
          />
          <TagInput
            id="toolset-scopes"
            labelProps={{
              label: t(ToolsetEditorI18nKeys.ScopesLabel),
            }}
            placeholder={t(ToolsetEditorI18nKeys.ScopesPlaceholder)}
            value={auth.scopes ?? []}
            onChange={(scopes) => onAuthChange({ scopes })}
            disabled={isControlsDisabled}
            tagClassName={TAG_INPUT_TAG_CLASS_NAME}
          />
        </div>
      )}

      {renderLoginStatus()}
    </div>
  );

  const renderNoneContent = () => (
    <p className="dial-small-text pt-2 text-secondary">
      {t(ToolsetEditorI18nKeys.OpenAccessDescription)}
    </p>
  );

  const renderApiKeyContent = () => (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-2">
        <Radio
          name="apikey-login-mode"
          id="apikey-with-login"
          value={WithLogin.WithLogin}
          labelProps={{ label: t(ToolsetEditorI18nKeys.WithLoginLabel) }}
          isSelected={auth.withLogin === WithLogin.WithLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
        <Radio
          name="apikey-login-mode"
          id="apikey-without-login"
          value={WithLogin.WithoutLogin}
          labelProps={{ label: t(ToolsetEditorI18nKeys.WithoutLoginLabel) }}
          isSelected={auth.withLogin === WithLogin.WithoutLogin}
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
          placeholder={t(ToolsetEditorI18nKeys.KeyHeaderPlaceholder)}
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
            placeholder={t(ToolsetEditorI18nKeys.ApiKeyPlaceholder)}
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
      <h3 className="dial-h3-text">
        {t(ToolsetEditorI18nKeys.AuthSectionTitle)}
      </h3>

      <SegmentedControl
        aria-label={t(ToolsetEditorI18nKeys.AuthSectionTitle)}
        value={auth.authenticationType}
        onChange={(type) => handleSelectType(type as ToolsetAuthTypes)}
        segmentClassName="px-2 !flex-none !min-w-0"
        items={[
          ToolsetAuthTypes.None,
          ToolsetAuthTypes.OAuth,
          ToolsetAuthTypes.ApiKey,
        ].map((type) => {
          const { labelKey, Icon } = AUTH_TYPE_OPTIONS[type];
          return {
            value: type,
            label: (
              <div className="flex items-center gap-2">
                <Icon
                  className="shrink-0"
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
                <span className="sr-only desktop:not-sr-only">
                  {t(labelKey)}
                </span>
              </div>
            ),
            disabled: isControlsDisabled && auth.authenticationType !== type,
          };
        })}
      />

      {auth.authenticationType === ToolsetAuthTypes.None && renderNoneContent()}
      {auth.authenticationType === ToolsetAuthTypes.OAuth &&
        renderOAuthContent()}
      {auth.authenticationType === ToolsetAuthTypes.ApiKey &&
        renderApiKeyContent()}

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
