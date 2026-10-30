import type { CatalogItemCredentials } from '@epam/ai-dial-catalog';
import type {
  ApplicationSchemaSummaryDto,
  ApplicationExternalServiceDto,
} from '@epam/ai-dial-chat-api-client';
import {
  decodeToolsetId,
  ExternalServiceAuthStatus,
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  ExternalServiceLoginOutcomeType,
  mapDeploymentDetailsDtoToEntityDetails,
  mapToolsetCredentials,
  navigateToolsetOAuthPopup,
  normalizeDeploymentId,
  normalizeToolsetId,
  openToolsetOAuthPopup,
  resolveToolsetCredentialsLevel,
  selectToolsetAuthStatus,
  subscribeToolsetLoginSuccess,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  waitForToolsetOAuthResult,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  ElementSize,
  NeutralButton,
  Popup,
  Spinner,
  WarningMessageNotification,
} from '@epam/ai-dial-ui-kit';
import {
  AppsEditorHost,
  type AppsEditorClientMessage,
} from '@epam/ai-dial-visualizer-connector';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ApplicationCredentials } from '../../../components/ApplicationCredentials/ApplicationCredentials';
import {
  ApplicationCredentialsI18nKeys,
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useUser } from '../../../context/auth/UserContext';
import { useTheme } from '../../../context/ThemeContext';
import { useExternalServiceLogin } from '../../../hooks/externalServices/useExternalServiceLogin';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { listExternalServices } from '../../../server-api/external-services';
import { getToolset, logoutToolset } from '../../../server-api/toolsets';
import type {
  ExternalServiceLoginResultPayload,
  ToolsetLoginResultPayload,
  ToolsetLogoutResultPayload,
  TriggerSaveGeneralPayload,
} from '../../../types/apps-editor';
import {
  AppsEditorEvent,
  AppsEditorIframeQuery,
  ExternalServiceLoginFailureReason,
} from '../../../types/apps-editor';
import { ROUTES } from '../../../types/routes';
import { toolsetDtoToForm } from '../../../utils/toolsets';

/**
 * How long the embedded editor has to send its first postMessage before it is
 * reported as not responding. A load event is not enough: the browser also
 * fires it for its own error page when the editor host is unreachable.
 */
export const EDITOR_RESPONSE_TIMEOUT_MS = 15000;

/* Every non-success outcome of `useExternalServiceLogin`, as the reason the embedded editor receives. */
const EXTERNAL_SERVICE_LOGIN_FAILURE_REASONS: Record<
  Exclude<
    ExternalServiceLoginOutcomeType,
    ExternalServiceLoginOutcomeType.Success
  >,
  ExternalServiceLoginFailureReason
> = {
  [ExternalServiceLoginOutcomeType.PopupBlocked]:
    ExternalServiceLoginFailureReason.PopupBlocked,
  [ExternalServiceLoginOutcomeType.Cancelled]:
    ExternalServiceLoginFailureReason.Cancelled,
  [ExternalServiceLoginOutcomeType.AdminConsentRequired]:
    ExternalServiceLoginFailureReason.AdminConsentRequired,
  [ExternalServiceLoginOutcomeType.OfflineUnavailable]:
    ExternalServiceLoginFailureReason.OfflineUnavailable,
  [ExternalServiceLoginOutcomeType.Failure]:
    ExternalServiceLoginFailureReason.Failure,
};

/* The authentication types the relay signs in to; API keys stay with the editor or the dialog. */
const isRelayedAuthType = (
  type: ApplicationExternalServiceDto['authenticationType'],
): boolean =>
  type === ExternalServiceAuthType.OAuth ||
  type === ExternalServiceAuthType.DialNative;

export interface AppEditorIframeHandle {
  triggerSave: (general?: TriggerSaveGeneralPayload) => void;
}

type EditorHost = AppsEditorHost<
  TriggerSaveGeneralPayload,
  CatalogItemCredentials
>;

interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  /** Starts a new readiness wait on mount, URL change, or explicit Reload. */
  onLoadStart?: () => void;
  onUpdated?: () => void;
  /**
   * Called when the embedded editor's `SaveSuccess` message resolves, with
   * `hasChanges` normalized to a strict boolean (a missing/non-boolean field
   * on the message is treated as `false`) — see `SaveSuccessMessage`.
   */
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  /**
   * Notifies the host whenever the embedded editor reports whether its form
   * is valid (`AppsEditorEvent.ValidityState`). `true` until the editor says
   * otherwise, and re-gated to `true` when the iframe reloads.
   */
  onValidityChange?: (isValid: boolean) => void;
  /**
   * Notifies the host whenever the embedded editor reports unsaved edits
   * (`AppsEditorEvent.DirtyState`). `false` until the editor says otherwise,
   * after `SaveSuccess`, and whenever the iframe reloads.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * Notifies the host whenever the iframe's readiness to save changes.
   * Reflects `AppsEditorEvent.ReadyToSave` (the embedded editor's own data
   * model is loaded/validated and it is safe to trigger a save) — not the
   * generic `ReadyToInteract` (UI rendered), which only controls this
   * component's own loading-spinner overlay.
   */
  onReadyChange?: (isReady: boolean) => void;
  /**
   * Notifies the host whenever the iframe reports the user is logged out
   * (`AppsEditorEvent.LoggedOut`). The host treats this as an expected
   * unauthenticated state until a later `ReadyToSave` confirms recovery.
   */
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
  /**
   * Notifies the host whenever the embedded editor is reported as not
   * responding: no postMessage arrived from its window and origin within
   * `EDITOR_RESPONSE_TIMEOUT_MS`. Like `onLoggedOutChange`, it explains why
   * `ReadyToSave` never arrives, so the host can skip its generic error.
   */
  onUnresponsiveChange?: (isUnresponsive: boolean) => void;
}

const AppEditorIframe = forwardRef<AppEditorIframeHandle, Props>(
  function AppEditorIframe(
    {
      schema,
      appId,
      onLoadStart,
      onUpdated,
      onSaveSuccess,
      onSaveError,
      onValidityChange,
      onDirtyChange,
      onReadyChange,
      onLoggedOutChange,
      onUnresponsiveChange,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const { user } = useUser();
    const { currentTheme } = useTheme();
    const isApplicationAuthCapable = useFeatureFlag('liveChatInteraction');
    const isApplicationAuthEnabled = useUiFeature(
      OverlayFeature.LiveChatInteraction,
    );
    const [credentialsAppId, setCredentialsAppId] = useState<string | null>(
      null,
    );
    const { login: loginExternalService } = useExternalServiceLogin();

    const [isUiLoading, setIsUiLoading] = useState(true);
    const [isReadyToSave, setIsReadyToSave] = useState(false);
    const [isLoggedOut, setIsLoggedOut] = useState(false);
    const [isFormValid, setIsFormValid] = useState(true);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [hasEditorResponded, setHasEditorResponded] = useState(false);
    const [isResponseTimedOut, setIsResponseTimedOut] = useState(false);
    // Bumped by Reload to remount the iframe with the same URL.
    const [reloadKey, setReloadKey] = useState(0);
    const isUnresponsive = isResponseTimedOut && !hasEditorResponded;
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const editorHostRef = useRef<EditorHost | null>(null);
    const onLoadStartRef = useRef(onLoadStart);

    useEffect(() => {
      onLoadStartRef.current = onLoadStart;
    }, [onLoadStart]);

    /* Single source for the name sent in the iframe URL and used as the
     * postMessage type prefix (`${applicationName}/readyToInteract`, ...). */
    const applicationName = schema.displayName ?? '';

    const iframeUrl = useMemo(() => {
      const providerId = user?.providerId ?? '';
      const params = new URLSearchParams({
        [AppsEditorIframeQuery.AuthProvider]: providerId,
        [AppsEditorIframeQuery.Id]: appId,
        [AppsEditorIframeQuery.Theme]: currentTheme,
        [AppsEditorIframeQuery.ApplicationCredentials]: String(
          isApplicationAuthCapable && isApplicationAuthEnabled,
        ),
        [AppsEditorIframeQuery.ExternalServiceLogin]: String(
          isApplicationAuthCapable && isApplicationAuthEnabled,
        ),
      });
      if (applicationName) {
        params.set(AppsEditorIframeQuery.ApplicationName, applicationName);
      }
      return `${schema.editorUrl}?${params.toString()}`;
    }, [
      schema.editorUrl,
      applicationName,
      appId,
      user?.providerId,
      currentTheme,
      isApplicationAuthCapable,
      isApplicationAuthEnabled,
    ]);

    /*
     * Single source of truth for the embedded editor's origin — every
     * postMessage send/receive site below needs the same
     * guard-then-parse-`schema.editorUrl` logic, so it's computed once here
     * instead of being repeated (and risking drifting out of sync, e.g. one
     * site guarding against a malformed URL and another not) at each site.
     * `null` covers missing, malformed, and opaque editor origins.
     */
    const targetOrigin = useMemo(() => {
      if (!schema.editorUrl) return null;
      try {
        const origin = new URL(schema.editorUrl).origin;
        return origin === 'null' ? null : origin;
      } catch {
        return null;
      }
    }, [schema.editorUrl]);

    /* Each async request replies through its original host. A destroyed host
     * drops the result instead of sending it into a newly loaded editor. */
    const postToolsetLoginResult = (
      host: EditorHost,
      payload: Omit<ToolsetLoginResultPayload, 'type'>,
    ) => {
      host.send({
        type: AppsEditorEvent.ToolsetLoginResult,
        ...payload,
      });
    };

    const postToolsetLogoutResult = (
      host: EditorHost,
      payload: Omit<ToolsetLogoutResultPayload, 'type'>,
    ) => {
      host.send({
        type: AppsEditorEvent.ToolsetLogoutResult,
        ...payload,
      });
    };

    /**
     * Refreshes a toolset's credentials/status the same way Catalog's
     * Details panel does after login/logout (`CatalogView.handleFetchDetails`
     * → `getDeploymentDetails` → `mapDeploymentDetailsDtoToEntityDetails` →
     * `mapToolsetCredentials`), so the iframe gets the same up-to-date status
     * shape Catalog would show. Best-effort only — `undefined` on any
     * failure, since the login `success` flag is already authoritative.
     */
    const fetchToolsetCredentials = useCallback(
      async (
        encodedToolsetId: string,
      ): Promise<CatalogItemCredentials | undefined> => {
        try {
          const dto = await getDeploymentDetails(encodedToolsetId);
          const entityDetails = mapDeploymentDetailsDtoToEntityDetails(dto);
          return entityDetails.type === 'TOOLSET'
            ? mapToolsetCredentials(
                encodedToolsetId,
                entityDetails.data,
                user?.isAdmin ?? false,
              )
            : undefined;
        } catch {
          return undefined;
        }
      },
      [user?.isAdmin],
    );

    /**
     * Handles a toolset login requested from inside the QuickApps iframe.
     * The iframe only ever sends a `toolsetId` — everything else (OAuth
     * client config, popup, login call) is owned here, reusing the same
     * popup/BroadcastChannel machinery `AuthSection`'s admin Log In button
     * uses (`navigateToolsetOAuthPopup` + `waitForToolsetOAuthResult`), so
     * this never duplicates OAuth config or a second callback route.
     *
     * The popup is opened as the very first statement, before any `await`,
     * to stay inside the synchronous portion of the triggering `message`
     * event handler — this is what gives the browser's popup blocker the
     * best chance of treating it as user-triggered, since the actual click
     * happened inside a cross-origin iframe and only reaches here via an
     * async `postMessage`.
     */
    const handleToolsetLoginRequest = useCallback(
      async (toolsetId: string, host: EditorHost) => {
        /*
         * The iframe is expected to send the raw, human-readable id (e.g.
         * contains a real space) — the toolsets API requires the
         * already-percent-encoded form (`%20`, not a real space) everywhere
         * it's used as a path segment or body identifier. `normalizeToolsetId`
         * (rather than `encodeToolsetId` directly) guards against an iframe
         * that sends an already-encoded id instead: encoding that a second
         * time would double-escape it (`%20` → `%2520`) and 404 against the
         * backend. `toolsetId` (raw, as received) is only ever used to echo
         * the request back to the iframe below; every backend call uses
         * `encodedToolsetId`.
         */
        const encodedToolsetId = normalizeToolsetId(toolsetId);

        const popup = openToolsetOAuthPopup();
        if (!popup) {
          postToolsetLoginResult(host, {
            toolsetId,
            success: false,
            reason: 'popup-blocked',
          });
          return;
        }

        const auth = await getToolset(encodedToolsetId)
          .then((dto) => toolsetDtoToForm(dto).auth)
          .catch(() => null);

        if (!auth) {
          popup.close();
          postToolsetLoginResult(host, {
            toolsetId,
            success: false,
            reason: 'toolset-fetch-failed',
          });
          return;
        }

        if (auth.authenticationType !== ToolsetAuthTypes.OAuth) {
          popup.close();
          postToolsetLoginResult(host, {
            toolsetId,
            success: false,
            reason: 'not-oauth',
          });
          return;
        }

        const credentialsLevel =
          resolveToolsetCredentialsLevel(encodedToolsetId);
        const initiation = navigateToolsetOAuthPopup(
          popup,
          auth,
          encodedToolsetId,
          ROUTES.ToolsetSignIn,
          credentialsLevel,
        );
        if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
          postToolsetLoginResult(host, {
            toolsetId,
            success: false,
            reason: 'invalid-config',
          });
          return;
        }

        const result = await waitForToolsetOAuthResult(
          initiation.popup,
          initiation.flowId,
          {
            toolsetId: encodedToolsetId,
            credentialsLevel,
            callbackPath: ROUTES.ToolsetSignIn,
          },
        );
        if (result.type === ToolsetOAuthResultType.Success) {
          postToolsetLoginResult(host, {
            toolsetId,
            success: true,
            credentialsLevel: result.credentialsLevel,
            credentials: await fetchToolsetCredentials(encodedToolsetId),
          });
          return;
        }
        if (result.type === ToolsetOAuthResultType.Failure) {
          postToolsetLoginResult(host, {
            toolsetId,
            success: false,
            reason: result.reason,
          });
          return;
        }

        /*
         * Treat the backend as the final authority if popup tracking or
         * cross-process message delivery ever still reports a false cancel.
         * This avoids reporting a failed login to the iframe after it
         * actually completed server-side.
         */
        try {
          const refreshed = await getToolset(encodedToolsetId);
          const statusField = selectToolsetAuthStatus(
            refreshed.authSettings,
            credentialsLevel,
          );
          if (statusField === 'SIGNED_IN') {
            postToolsetLoginResult(host, {
              toolsetId,
              success: true,
              credentialsLevel,
              credentials: await fetchToolsetCredentials(encodedToolsetId),
            });
            return;
          }
        } catch {
          // Best-effort verification only — a genuine cancel stays silent.
        }
        postToolsetLoginResult(host, {
          toolsetId,
          success: false,
          reason: 'cancelled',
        });
      },
      [fetchToolsetCredentials],
    );

    /**
     * Handles a toolset logout requested from inside the QuickApps iframe.
     * Unlike login, logout needs no popup/OAuth round-trip, so this is a
     * single direct call to the existing `logoutToolset` endpoint — the
     * backend resolves the toolset's stored authentication type itself when
     * the request body omits it, so this never needs a prior `getToolset`
     * call the way login does.
     */
    const handleToolsetLogoutRequest = useCallback(
      async (toolsetId: string, host: EditorHost) => {
        const encodedToolsetId = normalizeToolsetId(toolsetId);
        const credentialsLevel =
          resolveToolsetCredentialsLevel(encodedToolsetId);

        try {
          await logoutToolset(encodedToolsetId, {
            url: encodedToolsetId,
            credentialsLevel,
          });
          postToolsetLogoutResult(host, {
            toolsetId,
            success: true,
            credentialsLevel,
            credentials: await fetchToolsetCredentials(encodedToolsetId),
          });
        } catch {
          postToolsetLogoutResult(host, {
            toolsetId,
            success: false,
            reason: 'logout-failed',
          });
        }
      },
      [fetchToolsetCredentials],
    );

    const postExternalServiceLoginResult = (
      host: EditorHost,
      payload: Omit<ExternalServiceLoginResultPayload, 'type'>,
    ) => {
      host.send({
        type: AppsEditorEvent.ExternalServiceLoginResult,
        ...payload,
      });
    };

    /**
     * Handles a sign-in to one external service requested from inside the
     * embedded editor, without the application-credentials dialog. The editor
     * names the application and the service and passes the person's own
     * offline-use choice; the OAuth settings, the popup and the sign-in call
     * stay here and in `useExternalServiceLogin`, always at USER level.
     *
     * As in `handleToolsetLoginRequest`, the popup is reserved as the very
     * first statement, before any `await`: the click happened inside a
     * cross-origin iframe and only reaches here through `postMessage`.
     */
    const handleExternalServiceLoginRequest = useCallback(
      async (
        appId: string,
        serviceId: string,
        offlineUsageConsent: boolean,
        host: EditorHost,
      ) => {
        const reply = (
          success: boolean,
          reason?: ExternalServiceLoginFailureReason,
        ) => {
          postExternalServiceLoginResult(host, {
            appId,
            serviceId,
            success,
            reason,
          });
        };

        const popup = openToolsetOAuthPopup();
        if (!popup) {
          reply(false, ExternalServiceLoginFailureReason.PopupBlocked);
          return;
        }

        const normalizedAppId = normalizeDeploymentId(appId);
        let service: ApplicationExternalServiceDto | undefined;
        try {
          const services = await listExternalServices(normalizedAppId);
          service = services.find((candidate) => candidate.id === serviceId);
        } catch {
          popup.close();
          reply(false, ExternalServiceLoginFailureReason.Failure);
          return;
        }
        if (!service) {
          popup.close();
          reply(false, ExternalServiceLoginFailureReason.NotFound);
          return;
        }
        if (!isRelayedAuthType(service.authenticationType)) {
          popup.close();
          reply(false, ExternalServiceLoginFailureReason.UnsupportedAuthType);
          return;
        }

        try {
          const outcome = await loginExternalService({
            appId: normalizedAppId,
            serviceId,
            credentialsLevel: ExternalServiceCredentialsLevel.User,
            authenticationType:
              service.authenticationType as ExternalServiceAuthType,
            oauthSettings: {
              clientId: service.clientId,
              authorizationEndpoint: service.authorizationEndpoint,
              scopes: service.scopesSupported,
              codeChallenge: service.codeChallenge,
              codeChallengeMethod: service.codeChallengeMethod,
            },
            offlineUsageConsent,
            forceStale:
              service.userLevelAuthStatus === ExternalServiceAuthStatus.Failed,
            popup,
          });
          if (outcome.type === ExternalServiceLoginOutcomeType.Success) {
            reply(true);
          } else {
            reply(false, EXTERNAL_SERVICE_LOGIN_FAILURE_REASONS[outcome.type]);
          }
        } catch {
          reply(false, ExternalServiceLoginFailureReason.Failure);
        }
      },
      [loginExternalService],
    );

    const handleMessage = useCallback(
      (message: AppsEditorClientMessage, host: EditorHost) => {
        switch (message.type) {
          case AppsEditorEvent.RequestApplicationCredentials:
            if (isApplicationAuthCapable && isApplicationAuthEnabled) {
              setCredentialsAppId(normalizeDeploymentId(message.appId));
            }
            break;
          case AppsEditorEvent.RequestExternalServiceLogin:
            if (isApplicationAuthCapable && isApplicationAuthEnabled) {
              void handleExternalServiceLoginRequest(
                message.appId,
                message.serviceId,
                message.offlineUsageConsent,
                host,
              );
            }
            break;
          case AppsEditorEvent.ReadyToInteract:
            setIsUiLoading(false);
            break;
          case AppsEditorEvent.ReadyToSave:
            setIsLoggedOut(false);
            setIsReadyToSave(true);
            break;
          case AppsEditorEvent.LoggedOut:
            setIsReadyToSave(false);
            setIsLoggedOut(true);
            break;
          case AppsEditorEvent.UpdatedSuccess:
            onUpdated?.();
            break;
          case AppsEditorEvent.SaveSuccess:
            setIsFormDirty(false);
            onSaveSuccess?.(message.hasChanges === true);
            break;
          case AppsEditorEvent.SaveError:
            onSaveError?.(message.error);
            break;
          case AppsEditorEvent.ValidityState:
            setIsFormValid(message.payload.isValid);
            break;
          case AppsEditorEvent.DirtyState:
            setIsFormDirty(message.payload.isDirty);
            break;
          case AppsEditorEvent.RequestToolsetLogin:
            void handleToolsetLoginRequest(message.toolsetId, host);
            break;
          case AppsEditorEvent.RequestToolsetLogout:
            void handleToolsetLogoutRequest(message.toolsetId, host);
            break;
          default:
            break;
        }
      },
      [
        onUpdated,
        onSaveSuccess,
        onSaveError,
        handleToolsetLoginRequest,
        handleToolsetLogoutRequest,
        handleExternalServiceLoginRequest,
        isApplicationAuthCapable,
        isApplicationAuthEnabled,
      ],
    );

    const handleMessageRef = useRef(handleMessage);
    useEffect(() => {
      handleMessageRef.current = handleMessage;
    }, [handleMessage]);

    useEffect(() => {
      const targetWindow = iframeRef.current?.contentWindow;
      if (!targetOrigin || !targetWindow) return;
      const host: EditorHost = new AppsEditorHost({
        targetWindow,
        targetOrigin,
        applicationName,
        onMessage: (message) => handleMessageRef.current(message, host),
        onActivity: () => setHasEditorResponded(true),
      });
      editorHostRef.current = host;
      return () => {
        host.destroy();
        editorHostRef.current = null;
      };
    }, [targetOrigin, applicationName, iframeUrl, reloadKey]);

    /*
     * Keeps the iframe's toolset status in sync with logins completed
     * outside its own RequestToolsetLogin flow (e.g. via the global
     * SigninInterruptDialog). Subscribes for the component's whole mounted
     * lifetime — deliberately not gated on preview visibility — since the
     * iframe stays mounted-but-hidden during Preview and must still receive
     * updates then, without being reloaded.
     *
     * Not filtered to toolsets this app actually references: the host has no
     * such list (only the embedded editor's own data model knows which
     * toolsets an app uses), so every successful login is forwarded and the
     * embedded editor is contractually responsible for ignoring an
     * unrecognized `toolsetId` — see the "Settings iframe receives live
     * updates for toolset logins initiated elsewhere" requirement in the
     * `quick-app-authoring` spec. The forwarded `credentials` are never more
     * than the user's own permissions already expose via `getDeploymentDetails`.
     */
    useEffect(() => {
      if (!targetOrigin) return undefined;
      let isStale = false;
      const unsubscribe = subscribeToolsetLoginSuccess<ToolsetCredentialsLevel>(
        ({ toolsetId, credentialsLevel }) => {
          const host = editorHostRef.current;
          if (!host) return;
          const rawToolsetId = decodeToolsetId(toolsetId);
          void (async () => {
            const credentials = await fetchToolsetCredentials(toolsetId);
            /*
             * Unsubscribe cleanup suppresses old callbacks; the captured host
             * also drops replies after an iframe reload at the same origin.
             */
            if (isStale) return;
            postToolsetLoginResult(host, {
              toolsetId: rawToolsetId,
              success: true,
              credentialsLevel,
              credentials,
            });
          })();
        },
      );
      return () => {
        isStale = true;
        unsubscribe();
      };
    }, [targetOrigin, fetchToolsetCredentials]);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const handleLoad = () => setIsUiLoading(false);
      iframe.addEventListener('load', handleLoad);
      return () => {
        iframe.removeEventListener('load', handleLoad);
      };
    }, [iframeUrl, reloadKey]);

    /* Re-gates readiness-to-save (and the logged-out and dirty flags) whenever the
     * iframe reloads for a different app/schema, so stale values from the
     * previous app don't leak into the newly loaded one — the new iframe
     * must send its own ReadyToSave/LoggedOut. */
    useEffect(() => {
      onLoadStartRef.current?.();
      setIsReadyToSave(false);
      setIsLoggedOut(false);
      setIsFormValid(true);
      setIsFormDirty(false);
      setCredentialsAppId(null);
      setHasEditorResponded(false);
      setIsResponseTimedOut(false);
    }, [iframeUrl, reloadKey]);

    useEffect(() => {
      if (hasEditorResponded) return undefined;
      const timeoutId = setTimeout(
        () => setIsResponseTimedOut(true),
        EDITOR_RESPONSE_TIMEOUT_MS,
      );
      return () => clearTimeout(timeoutId);
    }, [hasEditorResponded, iframeUrl, reloadKey]);

    useEffect(() => {
      onReadyChange?.(isReadyToSave);
    }, [isReadyToSave, onReadyChange]);

    useEffect(() => {
      onValidityChange?.(isFormValid);
    }, [isFormValid, onValidityChange]);

    useEffect(() => {
      onDirtyChange?.(isFormDirty);
    }, [isFormDirty, onDirtyChange]);

    useEffect(() => {
      onLoggedOutChange?.(isLoggedOut);
    }, [isLoggedOut, onLoggedOutChange]);

    useEffect(() => {
      onUnresponsiveChange?.(isUnresponsive);
    }, [isUnresponsive, onUnresponsiveChange]);

    const handleReload = useCallback(() => {
      setIsUiLoading(true);
      setReloadKey((key) => key + 1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        triggerSave: (general?: TriggerSaveGeneralPayload) => {
          editorHostRef.current?.send({
            type: AppsEditorEvent.TriggerSave,
            general,
          });
        },
      }),
      [],
    );

    return (
      <div className="flex size-full flex-col gap-2">
        {credentialsAppId &&
          isApplicationAuthCapable &&
          isApplicationAuthEnabled && (
            <Popup
              open
              header={t(ApplicationCredentialsI18nKeys.Title)}
              closeAriaLabel={t(ButtonsI18nKeys.Close)}
              onClose={() => setCredentialsAppId(null)}
            >
              <ApplicationCredentials
                key={credentialsAppId}
                appId={credentialsAppId}
                showEmptyState
              />
            </Popup>
          )}
        {isUnresponsive && (
          <WarningMessageNotification
            title={t(AppsEditorI18nKeys.SettingsStepUnresponsiveTitle)}
            message={t(AppsEditorI18nKeys.SettingsStepUnresponsiveMessage, {
              host: targetOrigin ?? schema.editorUrl,
            })}
            textClassName="break-words"
            action={
              <NeutralButton
                size={ElementSize.Small}
                label={t(ButtonsI18nKeys.Reload)}
                onClick={handleReload}
              />
            }
          />
        )}
        <div className="relative min-h-0 flex-1">
          {isUiLoading && !isUnresponsive && (
            <div className="absolute inset-0 flex items-center justify-center bg-layer-sunken">
              {/*
               * The kit Spinner is itself the role="status" live region; naming
               * its image here exposes the label without nesting a second one.
               */}
              <Spinner
                ariaLabel={t(AppsEditorI18nKeys.SettingsStepLoadingLabel)}
              />
            </div>
          )}
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={iframeUrl}
            title={schema.displayName}
            className="size-full border-none"
            allow="local-network-access=*"
          />
        </div>
      </div>
    );
  },
);

export default memo(AppEditorIframe);
