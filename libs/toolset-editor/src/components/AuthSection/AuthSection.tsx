import {
  getApiErrorDetails,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
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
  PasswordInput,
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
import type {
  ToolsetLoginRequest,
  ToolsetLogoutRequest,
} from '../../models/toolset-form';
import type { ToolsetOAuthLoginResult } from '../../models/toolset-oauth-login';
import { ToolsetOAuthLoginStatus } from '../../models/toolset-oauth-login';
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
  onOAuthLogin,
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
   * Applies whatever the host's OAuth flow settled on. The status is the
   * only thing this component knows about that flow — which popup opened,
   * which route it came back through, and how the result travelled between
   * them are all the host's business.
   */
  const applyOAuthResult = (result: ToolsetOAuthLoginResult) => {
    /*
     * Merged first, and regardless of status: dynamic client registration
     * assigns `clientId`/`authorizationEndpoint` during the flow, and the
     * form should show them even if authorizing then failed.
     */
    if (result.auth != null) onAuthChange(result.auth);

    switch (result.status) {
      case ToolsetOAuthLoginStatus.Success:
        onAuthChange({ isLoggedIn: true });
        onNotifySuccess(
          labels?.loginSuccessMessage ?? 'Successfully logged in.',
        );
        return;
      case ToolsetOAuthLoginStatus.PopupBlocked:
        onNotifyError(
          labels?.errorPopupBlocked ??
            'The login popup was blocked by your browser. Please allow popups for this site and try again.',
        );
        return;
      case ToolsetOAuthLoginStatus.InvalidConfig:
        /*
         * Distinct from a blocked popup and from a generic login failure:
         * the provider returned no client to authorize against, which is
         * actionable in a way the other two are not.
         */
        onNotifyError(
          labels?.errorOAuthConfigMissing ??
            'The OAuth provider did not return a valid client configuration. Please check the endpoint or contact your administrator.',
        );
        return;
      case ToolsetOAuthLoginStatus.Failed:
        onNotifyError(
          labels?.errorLoginFailed ??
            'Failed to log in. Please check your credentials and try again.',
          result.traceId,
        );
        return;
      case ToolsetOAuthLoginStatus.Cancelled:
        /* Nothing failed, so nothing is reported. */
        return;
    }
  };

  const handleLogIn = async () => {
    if (!canLogIn) return;

    if (auth.authenticationType === ToolsetAuthTypes.OAuth) {
      /*
       * `onOAuthLogin` is called before the first `await` in this branch, so
       * the host can still open a popup inside the user gesture. Busy is set
       * first for the same reason it always was: `onEnsureSaved` can resolve
       * in a single microtask when the form is already saved, and a second
       * click in that window would start a second concurrent login.
       */
      setIsAuthBusy(true);
      try {
        applyOAuthResult(
          await onOAuthLogin({ auth, ensureSaved: onEnsureSaved }),
        );
      } finally {
        setIsAuthBusy(false);
      }
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
          <PasswordInput
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
            showPasswordLabel={
              labels?.showClientSecretLabel ?? 'Show client secret'
            }
            hidePasswordLabel={
              labels?.hideClientSecretLabel ?? 'Hide client secret'
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
          <PasswordInput
            id="toolset-api-key"
            value={auth.apiKey ?? ''}
            onChange={(value) => onAuthChange({ apiKey: value ?? '' })}
            labelProps={{
              label: labels?.apiKeyLabel ?? 'API key',
              required: true,
            }}
            placeholder={labels?.apiKeyPlaceholder ?? 'Enter API key'}
            showPasswordLabel={labels?.showApiKeyLabel ?? 'Show API key'}
            hidePasswordLabel={labels?.hideApiKeyLabel ?? 'Hide API key'}
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
