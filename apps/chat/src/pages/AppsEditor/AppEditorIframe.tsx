import type { CatalogItemCredentials } from '@epam/ai-dial-catalog';
import { DialSpinner } from '@epam/ai-dial-ui-kit';
import type { ApplicationSchemaSummaryDto } from '@epam/chat-api-client';
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
import { AppsEditorI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { getDeploymentDetails } from '../../server-api/deployments';
import { getToolset, logoutToolset } from '../../server-api/toolsets';
import type {
  ToolsetLoginResultPayload,
  ToolsetLogoutResultPayload,
} from '../../types/apps-editor';
import { AppsEditorEvent } from '../../types/apps-editor';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
} from '../../types/toolsets';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapToolsetCredentials,
} from '../../utils/map-entity-details-to-catalog';
import {
  encodeToolsetId,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  toolsetDtoToForm,
  waitForToolsetOAuthResult,
} from '../../utils/toolsets';

export interface AppEditorIframeHandle {
  triggerSave: () => void;
}

interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

const AppEditorIframe = forwardRef<AppEditorIframeHandle, Props>(
  function AppEditorIframe(
    { schema, appId, onUpdated, onSaveSuccess, onSaveError },
    ref,
  ) {
    const { t } = useTranslation();
    const { user } = useUser();
    const { currentTheme } = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const iframeUrl = useMemo(() => {
      const providerId = user?.providerId ?? '';
      const params = new URLSearchParams({
        authProvider: providerId,
        id: appId,
        theme: currentTheme,
      });
      return `${schema.editorUrl}?${params.toString()}`;
    }, [schema.editorUrl, appId, user?.providerId, currentTheme]);

    /**
     * Posts the outcome of a `RequestToolsetLogin` back into the iframe.
     * Kept as a plain function (not a hook-tracked callback) since it takes
     * no closed-over state beyond `schema.editorUrl`, resolved fresh on
     * every call from the current iframe/schema.
     */
    const postToolsetLoginResult = (
      targetOrigin: string,
      payload: Omit<ToolsetLoginResultPayload, 'type'>,
    ) => {
      const message: ToolsetLoginResultPayload = {
        type: AppsEditorEvent.ToolsetLoginResult,
        ...payload,
      };
      iframeRef.current?.contentWindow?.postMessage(message, targetOrigin);
    };

    /**
     * Posts the outcome of a `RequestToolsetLogout` back into the iframe.
     * See `postToolsetLoginResult` above for why this stays a plain
     * function rather than a hook-tracked callback.
     */
    const postToolsetLogoutResult = (
      targetOrigin: string,
      payload: Omit<ToolsetLogoutResultPayload, 'type'>,
    ) => {
      const message: ToolsetLogoutResultPayload = {
        type: AppsEditorEvent.ToolsetLogoutResult,
        ...payload,
      };
      iframeRef.current?.contentWindow?.postMessage(message, targetOrigin);
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
      async (toolsetId: string) => {
        if (!schema.editorUrl) return;
        const targetOrigin = new URL(schema.editorUrl).origin;
        /*
         * The iframe sends the raw, human-readable id (e.g. contains a real
         * space) — the toolsets API requires the already-percent-encoded
         * form (`%20`, not a real space) everywhere it's used as a path
         * segment or body identifier. `toolsetId` (raw) is only ever used to
         * echo the request back to the iframe below; every backend call
         * uses `encodedToolsetId`.
         */
        const encodedToolsetId = encodeToolsetId(toolsetId);

        const popup = openToolsetOAuthPopup();
        if (!popup) {
          postToolsetLoginResult(targetOrigin, {
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
          postToolsetLoginResult(targetOrigin, {
            toolsetId,
            success: false,
            reason: 'toolset-fetch-failed',
          });
          return;
        }

        if (auth.authenticationType !== ToolsetAuthTypes.OAuth) {
          popup.close();
          postToolsetLoginResult(targetOrigin, {
            toolsetId,
            success: false,
            reason: 'not-oauth',
          });
          return;
        }

        const credentialsLevel = ToolsetCredentialsLevel.User;
        const initiation = navigateToolsetOAuthPopup(
          popup,
          auth,
          encodedToolsetId,
          credentialsLevel,
        );
        if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
          postToolsetLoginResult(targetOrigin, {
            toolsetId,
            success: false,
            reason: 'invalid-config',
          });
          return;
        }

        const result = await waitForToolsetOAuthResult(
          initiation.popup,
          initiation.flowId,
        );
        if (result.type === ToolsetOAuthResultType.Success) {
          postToolsetLoginResult(targetOrigin, {
            toolsetId,
            success: true,
            credentialsLevel: result.credentialsLevel,
            credentials: await fetchToolsetCredentials(encodedToolsetId),
          });
          return;
        }
        if (result.type === ToolsetOAuthResultType.Failure) {
          postToolsetLoginResult(targetOrigin, {
            toolsetId,
            success: false,
            reason: result.reason,
          });
          return;
        }

        /*
         * Cancelled: the callback popup posts its result and closes itself
         * back-to-back — under load the opener can observe `popup.closed`
         * before the `BroadcastChannel` message arrives, so a login that
         * actually succeeded server-side can still surface as Cancelled
         * here. Re-fetching the toolset's real status (same recheck
         * `CatalogView`/`AuthSection` already do) avoids reporting a false
         * failure to the iframe for a login that already went through.
         */
        try {
          const refreshed = await getToolset(encodedToolsetId);
          const statusField = refreshed.authSettings?.userLevelAuthStatus;
          if (statusField === 'SIGNED_IN') {
            postToolsetLoginResult(targetOrigin, {
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
        postToolsetLoginResult(targetOrigin, {
          toolsetId,
          success: false,
          reason: 'cancelled',
        });
      },
      [schema.editorUrl, fetchToolsetCredentials],
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
      async (toolsetId: string) => {
        if (!schema.editorUrl) return;
        const targetOrigin = new URL(schema.editorUrl).origin;
        const encodedToolsetId = encodeToolsetId(toolsetId);
        const credentialsLevel = ToolsetCredentialsLevel.User;

        try {
          await logoutToolset(encodedToolsetId, {
            url: encodedToolsetId,
            credentialsLevel,
          });
          postToolsetLogoutResult(targetOrigin, {
            toolsetId,
            success: true,
            credentialsLevel,
            credentials: await fetchToolsetCredentials(encodedToolsetId),
          });
        } catch {
          postToolsetLogoutResult(targetOrigin, {
            toolsetId,
            success: false,
            reason: 'logout-failed',
          });
        }
      },
      [schema.editorUrl, fetchToolsetCredentials],
    );

    const handleMessage = useCallback(
      (event: MessageEvent) => {
        if (
          !schema.editorUrl ||
          event.origin !== new URL(schema.editorUrl).origin
        )
          return;
        const displayName = schema.displayName ?? '';
        if (
          event.data?.type ===
          `${displayName}/${AppsEditorEvent.ReadyToInteract}`
        ) {
          setIsLoading(false);
        } else if (
          event.data?.type ===
          `${displayName}/${AppsEditorEvent.UpdatedSuccess}`
        ) {
          onUpdated?.();
        } else if (event.data?.type === AppsEditorEvent.SaveSuccess) {
          onSaveSuccess?.();
        } else if (event.data?.type === AppsEditorEvent.SaveError) {
          onSaveError?.(event.data?.error ?? '');
        } else if (
          event.data?.type === AppsEditorEvent.RequestToolsetLogin &&
          typeof event.data?.toolsetId === 'string' &&
          event.data.toolsetId
        ) {
          void handleToolsetLoginRequest(event.data.toolsetId);
        } else if (
          event.data?.type === AppsEditorEvent.RequestToolsetLogout &&
          typeof event.data?.toolsetId === 'string' &&
          event.data.toolsetId
        ) {
          void handleToolsetLogoutRequest(event.data.toolsetId);
        }
      },
      [
        schema.editorUrl,
        schema.displayName,
        onUpdated,
        onSaveSuccess,
        onSaveError,
        handleToolsetLoginRequest,
        handleToolsetLogoutRequest,
      ],
    );

    useEffect(() => {
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [handleMessage]);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const handleLoad = () => setIsLoading(false);
      iframe.addEventListener('load', handleLoad);
      return () => {
        iframe.removeEventListener('load', handleLoad);
      };
    }, [iframeUrl]);

    useImperativeHandle(
      ref,
      () => ({
        triggerSave: () => {
          if (!schema.editorUrl) return;
          iframeRef.current?.contentWindow?.postMessage(
            { type: AppsEditorEvent.TriggerSave },
            new URL(schema.editorUrl).origin,
          );
        },
      }),
      [schema.editorUrl],
    );

    return (
      <div className="relative size-full">
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-layer-1"
            aria-label={t(AppsEditorI18nKeys.SettingsStepLoadingLabel)}
            aria-live="polite"
          >
            <DialSpinner />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          title={schema.displayName}
          className="size-full border-none"
        />
      </div>
    );
  },
);

export default memo(AppEditorIframe);
