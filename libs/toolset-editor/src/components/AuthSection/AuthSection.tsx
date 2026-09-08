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
import { useState } from 'react';
import { AUTH_TYPE_ICONS } from '../../constants/toolsets';
import type {
  AuthSectionLabels,
  AuthSectionProps,
} from '../../models/auth-section-props';
import type { ToolsetAuthFormData } from '../../models/toolset-form';
import type {
  ToolsetLoginRequest,
  ToolsetLogoutRequest,
} from '../../models/toolset-form';
import { isToolsetAuthValid, isValidEndpointUrl } from '../../utils/toolsets';

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

const segmentLabelFor = (
  type: ToolsetAuthTypes,
  labels?: AuthSectionLabels,
): string => {
  if (type === ToolsetAuthTypes.None) {
    return labels?.typeNone ?? 'Open access';
  }
  if (type === ToolsetAuthTypes.OAuth) {
    return labels?.typeOAuth ?? 'OAuth';
  }
  return labels?.typeApiKey ?? 'API Key';
};

/** Authentication block of the Setup section: auth type selection, per-type fields, login/logout actions, and the OAuth popup flow. */
export const AuthSection: FC<AuthSectionProps> = ({
  auth,
  errors,
  isSaving,
  toolsetId,
  isEditMode,
  endpoint,
  authActions,
  oauthCallbackPath,
  onNotifySuccess,
  onNotifyError,
  onAuthChange,
  onEnsureSaved,
  labels,
}) => {
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
      const message =
        initiation.type === ToolsetOAuthInitiationResultType.Blocked
          ? (labels?.errorPopupBlocked ??
            'The login popup was blocked by your browser. Please allow popups for this site and try again.')
          : (labels?.errorOAuthConfigMissing ??
            'The OAuth provider did not return a valid client configuration. Please check the endpoint or contact your administrator.');
      onNotifyError(message);
      return;
    }

    setIsAuthBusy(true);
    const result = await waitForToolsetOAuthResult(
      initiation.popup,
      initiation.flowId,
      {
        toolsetId: savedToolsetId,
        credentialsLevel: ToolsetCredentialsLevel.User,
        callbackPath: oauthCallbackPath,
      },
    );
    setIsAuthBusy(false);

    if (result.type === ToolsetOAuthResultType.Success) {
      onAuthChange({ isLoggedIn: true });
      onNotifySuccess(labels?.loginSuccessMessage ?? 'Successfully logged in.');
    } else if (result.type === ToolsetOAuthResultType.Failure) {
      onNotifyError(
        labels?.errorLoginFailed ??
          'Failed to log in. Please check your credentials and try again.',
      );
    } else if (result.type === ToolsetOAuthResultType.Cancelled) {
      /*
       * Treat the backend as the final authority if popup tracking or
       * cross-process message delivery ever still reports a false cancel.
       * This keeps the form from showing "logged out" after a login that
       * actually completed server-side.
       */
      try {
        const refreshedAuth = await authActions.fetchAuthSettings(
          savedToolsetId,
        );
        if (refreshedAuth.isLoggedIn) {
          onAuthChange({ isLoggedIn: true });
          onNotifySuccess(
            labels?.loginSuccessMessage ?? 'Successfully logged in.',
          );
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
          onNotifyError(
            labels?.errorPopupBlocked ??
              'The login popup was blocked by your browser. Please allow popups for this site and try again.',
          );
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
            resolvedAuth = await authActions.fetchAuthSettings(savedToolsetId);
          } catch (error) {
            popup.close();
            const { traceId } = await getApiErrorDetails(error);
            onNotifyError(
              labels?.errorLoginFailed ??
                'Failed to log in. Please check your credentials and try again.',
              traceId,
            );
            return;
          }
          onAuthChange(resolvedAuth);

          const initiation = navigateToolsetOAuthPopup(
            popup,
            resolvedAuth,
            savedToolsetId,
            oauthCallbackPath,
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
        oauthCallbackPath,
      );
      await handleOAuthInitiation(initiation, savedToolsetId);
      return;
    }

    const savedToolsetId = await onEnsureSaved();
    if (!savedToolsetId) return;

    setIsAuthBusy(true);
    try {
      const body: ToolsetLoginRequest = {
        url: savedToolsetId,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: auth.authenticationType,
        apiKey: auth.apiKey?.trim(),
      };
      await authActions.login(savedToolsetId, body);
      onAuthChange({ isLoggedIn: true });
      onNotifySuccess(labels?.loginSuccessMessage ?? 'Successfully logged in.');
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      onNotifyError(
        labels?.errorLoginFailed ??
          'Failed to log in. Please check your credentials and try again.',
        traceId,
      );
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleConfirmLogout = async () => {
    setIsAuthBusy(true);
    try {
      const body: ToolsetLogoutRequest = {
        url: toolsetId,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: auth.authenticationType,
      };
      await authActions.logout(toolsetId, body);
      onAuthChange({ isLoggedIn: false });
      setShowLogoutConfirm(false);
      onNotifySuccess(
        labels?.logoutSuccessMessage ?? 'Successfully logged out.',
      );
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      onNotifyError(
        labels?.errorLogoutFailed ?? 'Failed to log out. Please try again.',
        traceId,
      );
    } finally {
      setIsAuthBusy(false);
    }
  };

  const renderLoginStatus = () => {
    if (auth.isLoggedIn) {
      return (
        <div className="flex">
          <NeutralButton
            label={labels?.logOutLabel ?? 'Log out'}
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
          label={labels?.logInLabel ?? 'Log in'}
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
          labelProps={{
            label: labels?.withLoginOAuthLabel ?? 'Standard login',
          }}
          isSelected={auth.withLogin === WithLogin.WithLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
        <Radio
          name="oauth-login-mode"
          id="oauth-with-config"
          value={WithLogin.WithConfig}
          labelProps={{ label: labels?.withConfigOAuthLabel ?? 'Custom login' }}
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
              label: labels?.clientIdLabel ?? 'Client ID',
              required: true,
            }}
            placeholder={labels?.clientIdPlaceholder ?? 'Enter client ID'}
            error={errors.clientId || undefined}
            invalid={!!errors.clientId}
            disabled={isControlsDisabled}
          />
          <Input
            id="toolset-client-secret"
            value={auth.clientSecret ?? ''}
            onChange={(value) => onAuthChange({ clientSecret: value ?? '' })}
            labelProps={{
              label: labels?.clientSecretLabel ?? 'Client secret',
              required: !isEditMode,
            }}
            placeholder={
              labels?.clientSecretPlaceholder ?? 'Enter client secret'
            }
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
              label:
                labels?.authorizationEndpointLabel ?? 'Authorization endpoint',
            }}
            placeholder={
              labels?.authorizationEndpointPlaceholder ??
              'Enter authorization endpoint'
            }
            error={errors.authorizationEndpoint || undefined}
            invalid={!!errors.authorizationEndpoint}
            disabled={isControlsDisabled}
          />
          <Input
            id="toolset-token-endpoint"
            value={auth.tokenEndpoint ?? ''}
            onChange={(value) => onAuthChange({ tokenEndpoint: value ?? '' })}
            labelProps={{
              label: labels?.tokenEndpointLabel ?? 'Token endpoint',
            }}
            placeholder={
              labels?.tokenEndpointPlaceholder ?? 'Enter token endpoint'
            }
            error={errors.tokenEndpoint || undefined}
            invalid={!!errors.tokenEndpoint}
            disabled={isControlsDisabled}
          />
          <TagInput
            id="toolset-scopes"
            labelProps={{
              label: labels?.scopesLabel ?? 'Scopes',
            }}
            placeholder={labels?.scopesPlaceholder ?? 'Enter scopes'}
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
      {labels?.openAccessDescription ?? 'Open endpoint, no credentials'}
    </p>
  );

  const renderApiKeyContent = () => (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-2">
        <Radio
          name="apikey-login-mode"
          id="apikey-with-login"
          value={WithLogin.WithLogin}
          labelProps={{ label: labels?.withLoginLabel ?? 'With login' }}
          isSelected={auth.withLogin === WithLogin.WithLogin}
          disabled={isControlsDisabled}
          onChange={handleWithLoginChange}
        />
        <Radio
          name="apikey-login-mode"
          id="apikey-without-login"
          value={WithLogin.WithoutLogin}
          labelProps={{ label: labels?.withoutLoginLabel ?? 'Without login' }}
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
            label: labels?.keyHeaderLabel ?? 'API Key parameter name',
            required: true,
          }}
          placeholder={
            labels?.keyHeaderPlaceholder ?? 'Enter API key parameter name'
          }
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
              label: labels?.apiKeyLabel ?? 'API key',
              required: true,
            }}
            placeholder={labels?.apiKeyPlaceholder ?? 'Enter API key'}
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
        {labels?.sectionTitle ?? 'Authentication'}
      </h3>

      <SegmentedControl
        aria-label={labels?.sectionTitle ?? 'Authentication'}
        value={auth.authenticationType}
        onChange={(type) => handleSelectType(type as ToolsetAuthTypes)}
        segmentClassName="px-2"
        items={[
          ToolsetAuthTypes.None,
          ToolsetAuthTypes.OAuth,
          ToolsetAuthTypes.ApiKey,
        ].map((type) => {
          const Icon = AUTH_TYPE_ICONS[type];
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
                  {segmentLabelFor(type, labels)}
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
          header={labels?.logoutConfirmTitle ?? 'Log out?'}
          description={
            labels?.logoutConfirmDescription ??
            'Are you sure you want to log out? You will need to re-enter your credentials to use this toolset again.'
          }
          confirmLabel={labels?.logOutLabel ?? 'Log out'}
          cancelLabel={labels?.cancelLabel ?? 'Cancel'}
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
