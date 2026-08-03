import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { Input } from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialPopup,
  DialSpinner,
  NeutralButton,
  PrimaryButton,
  GhostButton,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { DialToolsetDto } from '@epam/chat-api-client';
import { IconAlertCircleFilled } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useClientChannel } from '../../context/ClientChannelContext';
import { useDeployments } from '../../context/DeploymentsContext';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../hooks/toolsets/useToolsetLogin';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ClientChannelReportResult } from '../../server-api/client-channel';
import { getToolset } from '../../server-api/toolsets';
import type { PendingSigninEvent } from '../../types/client-channel';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '../../types/toolsets';
import {
  getToolsetFallbackName,
  isPublicToolsetId,
} from '../../utils/toolsets';

enum RowStatus {
  Idle = 'idle',
  Processing = 'processing',
}

interface RowState {
  status: RowStatus;
  error?: string;
  apiKey: string;
}

const DEFAULT_ROW_STATE: RowState = { status: RowStatus.Idle, apiKey: '' };

interface ResolvedToolsetInfo {
  displayName: string;
  displayVersion?: string;
  authenticationType?: ToolsetAuthTypes;
  credentialsLevel: ToolsetCredentialsLevel;
}

const resolveToolsetInfo = (
  toolsetId: string,
  toolset: DialToolsetDto | undefined,
): ResolvedToolsetInfo => ({
  displayName: toolset?.displayName ?? getToolsetFallbackName(toolsetId),
  displayVersion: toolset?.displayVersion,
  authenticationType: toolset?.authSettings
    ?.authenticationType as ToolsetAuthTypes,
  credentialsLevel: isPublicToolsetId(toolsetId)
    ? ToolsetCredentialsLevel.User
    : ToolsetCredentialsLevel.Global,
});

interface SigninRowProps {
  event: PendingSigninEvent;
  info: ResolvedToolsetInfo;
  rowState: RowState;
  onApiKeyChange: (eventId: string, value: string) => void;
  onLogin: (event: PendingSigninEvent, info: ResolvedToolsetInfo) => void;
  onDecline: (eventId: string) => void;
}

const SigninRow: FC<SigninRowProps> = ({
  event,
  info,
  rowState,
  onApiKeyChange,
  onLogin,
  onDecline,
}) => {
  const { t } = useTranslation();
  const isProcessing = rowState.status === RowStatus.Processing;
  const isApiKey = info.authenticationType === ToolsetAuthTypes.ApiKey;
  const canSubmitLogin = !isApiKey || rowState.apiKey.trim().length > 0;

  return (
    <div
      role="group"
      aria-label={info.displayName}
      aria-busy={isProcessing}
      className="flex flex-col gap-2 border-b border-primary py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="dial-body-semi-text min-w-0 flex-1 truncate text-primary">
          {info.displayName}
          {info.displayVersion ? ` (${info.displayVersion})` : ''}
        </span>
        {isProcessing && (
          <DialSpinner size={16} ariaLabel={t(ButtonsI18nKeys.LogIn)} />
        )}
      </div>

      {isApiKey && (
        <Input
          id={`toolset-signin-api-key-${event.id}`}
          type="password"
          value={rowState.apiKey}
          placeholder={t(ToolsetSigninI18nKeys.ApiKeyPlaceholder)}
          labelProps={{ label: t(ToolsetSigninI18nKeys.ApiKeyLabel) }}
          disabled={isProcessing}
          onChange={(value) => onApiKeyChange(event.id, value ?? '')}
        />
      )}

      {rowState.error && (
        <div className="flex items-center gap-2 text-sm text-error">
          <IconAlertCircleFilled size={DIAL_ICON_SIZE.SM} aria-hidden />
          <span>{rowState.error}</span>
          <button
            type="button"
            className="dial-small-text underline"
            onClick={() => onLogin(event, info)}
          >
            {t(ToolsetSigninI18nKeys.ErrorRetry)}
          </button>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <GhostButton
          label={t(ToolsetSigninI18nKeys.RowDecline)}
          disabled={isProcessing}
          onClick={() => onDecline(event.id)}
        />
        <PrimaryButton
          label={t(ButtonsI18nKeys.LogIn)}
          disabled={isProcessing || !canSubmitLogin}
          onClick={() => onLogin(event, info)}
        />
      </div>
    </div>
  );
};

/**
 * Global, non-dismissible dialog that surfaces pending DIAL-Core-pushed
 * `toolset/signin` events (raised mid-completion when a tool call needs
 * fresh credentials) and lets the user log in or decline each one.
 */
const ToolsetSigninDialog: FC = () => {
  const { t } = useTranslation();
  const { pendingEvents, reportEvent } = useClientChannel();
  const { toolsets, refetchToolsets } = useDeployments();
  const { login } = useToolsetLogin();
  const isLiveChatInteractionUiEnabled = useUiFeature(
    OverlayFeature.LiveChatInteraction,
  );
  const isLiveChatInteractionCapable = useFeatureFlag('liveChatInteraction');

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [resolvedToolsets, setResolvedToolsets] = useState<
    Record<string, DialToolsetDto>
  >({});
  const [statusMessage, setStatusMessage] = useState('');
  const fetchingRef = useRef(new Set<string>());

  const getRowState = useCallback(
    (eventId: string): RowState => rowStates[eventId] ?? DEFAULT_ROW_STATE,
    [rowStates],
  );

  /*
   * Core's RPC `id` can reappear in a later, unrelated completion (see
   * ClientChannelContext's `resolvedIdsRef` handling), so a row's local
   * state must not survive past the event it belonged to — otherwise a
   * fresh occurrence of the same id would render with a stale leftover
   * status (e.g. permanently stuck "processing" from a prior resolved
   * decline/login) instead of starting clean.
   */
  useEffect(() => {
    const activeIds = new Set(pendingEvents.map((event) => event.id));
    setRowStates((prev) => {
      let changed = false;
      const next: Record<string, RowState> = {};
      for (const [eventId, state] of Object.entries(prev)) {
        if (activeIds.has(eventId)) {
          next[eventId] = state;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pendingEvents]);

  const setRowState = useCallback(
    (eventId: string, patch: Partial<RowState>) => {
      setRowStates((prev) => ({
        ...prev,
        [eventId]: { ...(prev[eventId] ?? DEFAULT_ROW_STATE), ...patch },
      }));
    },
    [],
  );

  /* Best-effort fetch of toolset metadata not yet present in the cached list — the fallback name renders until this resolves. */
  useEffect(() => {
    for (const event of pendingEvents) {
      const known =
        toolsets.find((toolsetItem) => toolsetItem.id === event.toolsetId) ??
        resolvedToolsets[event.toolsetId];
      if (known || fetchingRef.current.has(event.toolsetId)) continue;

      fetchingRef.current.add(event.toolsetId);
      getToolset(event.toolsetId)
        .then((dto) => {
          setResolvedToolsets((prev) => ({ ...prev, [event.toolsetId]: dto }));
        })
        .catch(() => undefined)
        .finally(() => {
          fetchingRef.current.delete(event.toolsetId);
        });
    }
  }, [pendingEvents, toolsets, resolvedToolsets]);

  const infoByToolsetId = useMemo(() => {
    const map = new Map<string, ResolvedToolsetInfo>();
    for (const event of pendingEvents) {
      if (map.has(event.toolsetId)) continue;
      const toolset =
        toolsets.find((toolsetItem) => toolsetItem.id === event.toolsetId) ??
        resolvedToolsets[event.toolsetId];
      map.set(event.toolsetId, resolveToolsetInfo(event.toolsetId, toolset));
    }
    return map;
  }, [pendingEvents, toolsets, resolvedToolsets]);

  const handleApiKeyChange = useCallback(
    (eventId: string, value: string) => {
      setRowState(eventId, { apiKey: value, error: undefined });
    },
    [setRowState],
  );

  const handleDecline = useCallback(
    async (eventId: string) => {
      setRowState(eventId, { status: RowStatus.Processing, error: undefined });
      try {
        await reportEvent(eventId, ClientChannelReportResult.Denied);
        const info = pendingEvents.find((event) => event.id === eventId);
        setStatusMessage(
          t(ToolsetSigninI18nKeys.StatusDeclineSuccess, {
            name: info
              ? (infoByToolsetId.get(info.toolsetId)?.displayName ?? '')
              : '',
          }),
        );
      } catch {
        setRowState(eventId, {
          status: RowStatus.Idle,
          error: t(ToolsetSigninI18nKeys.ErrorDeclineFailed),
        });
      }
    },
    [reportEvent, setRowState, pendingEvents, infoByToolsetId, t],
  );

  const handleDeclineAll = useCallback(() => {
    for (const event of pendingEvents) {
      void handleDecline(event.id);
    }
  }, [pendingEvents, handleDecline]);

  const handleLogin = useCallback(
    (event: PendingSigninEvent, info: ResolvedToolsetInfo) => {
      /*
       * Must stay synchronous up to `login(...)` for the OAuth popup-open to
       * remain inside the click's call stack — no `await` before this call.
       */
      setRowState(event.id, { status: RowStatus.Processing, error: undefined });
      const rowState = getRowState(event.id);

      void login({
        toolsetId: event.toolsetId,
        credentialsLevel: info.credentialsLevel,
        authenticationType: info.authenticationType ?? ToolsetAuthTypes.ApiKey,
        apiKey: rowState.apiKey,
        oauthSettings: {
          clientId: resolvedToolsets[event.toolsetId]?.authSettings?.clientId,
          authorizationEndpoint:
            resolvedToolsets[event.toolsetId]?.authSettings
              ?.authorizationEndpoint,
          scopes:
            resolvedToolsets[event.toolsetId]?.authSettings?.scopesSupported,
          codeChallenge:
            resolvedToolsets[event.toolsetId]?.authSettings?.codeChallenge,
          codeChallengeMethod:
            resolvedToolsets[event.toolsetId]?.authSettings
              ?.codeChallengeMethod,
        },
        forceStale: true,
      }).then(async (outcome) => {
        if (outcome.type === ToolsetLoginOutcomeType.Success) {
          await refetchToolsets();
          /*
           * A fresh signin for a toolset is valid for every other pending
           * event that targets the same toolset and the same resolved
           * credentials level — resolve each with its own report call
           * rather than leaving siblings pending indefinitely.
           */
          const siblingIds = pendingEvents
            .filter(
              (other) =>
                other.id !== event.id &&
                other.toolsetId === event.toolsetId &&
                infoByToolsetId.get(other.toolsetId)?.credentialsLevel ===
                  info.credentialsLevel,
            )
            .map((other) => other.id);

          try {
            await reportEvent(event.id, ClientChannelReportResult.Success);
            setStatusMessage(
              t(ToolsetSigninI18nKeys.StatusLoginSuccess, {
                name: info.displayName,
              }),
            );
          } catch {
            setRowState(event.id, {
              status: RowStatus.Idle,
              error: t(ToolsetSigninI18nKeys.ErrorLoginFailed),
            });
            return;
          }
          for (const siblingId of siblingIds) {
            void reportEvent(siblingId, ClientChannelReportResult.Success);
          }
          return;
        }

        if (outcome.type === ToolsetLoginOutcomeType.PopupBlocked) {
          setRowState(event.id, {
            status: RowStatus.Idle,
            error: t(ToolsetSigninI18nKeys.ErrorPopupBlocked),
          });
          return;
        }
        if (outcome.type === ToolsetLoginOutcomeType.Failure) {
          setRowState(event.id, {
            status: RowStatus.Idle,
            error: t(ToolsetSigninI18nKeys.ErrorLoginFailed),
          });
          return;
        }
        // Cancelled — silent, matches the pre-refactor Catalog behavior.
        setRowState(event.id, { status: RowStatus.Idle });
      });
    },
    [
      login,
      getRowState,
      setRowState,
      resolvedToolsets,
      refetchToolsets,
      reportEvent,
      pendingEvents,
      infoByToolsetId,
      t,
    ],
  );

  if (
    pendingEvents.length === 0 ||
    !isLiveChatInteractionUiEnabled ||
    !isLiveChatInteractionCapable
  ) {
    return null;
  }

  /* With a single pending event, the row's own Decline button already
   * covers it — showing "Decline all" too is a redundant duplicate action. */
  const footer =
    pendingEvents.length > 1 ? (
      <div className="flex items-center justify-end gap-2 px-6 py-4">
        <NeutralButton
          label={t(ToolsetSigninI18nKeys.DeclineAll)}
          onClick={handleDeclineAll}
        />
      </div>
    ) : undefined;

  return (
    <DialPopup
      open
      hideClose
      closeOnOutsideClick={false}
      size={PopupSize.Md}
      header={t(ToolsetSigninI18nKeys.DialogTitle)}
      footer={footer}
    >
      <div className="flex flex-col gap-2 px-6 py-4">
        <p className="dial-small-text text-secondary">
          {t(ToolsetSigninI18nKeys.DialogDescription)}
        </p>
        <span role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </span>
        <div className="flex flex-col">
          {pendingEvents.map((event) => (
            <SigninRow
              key={event.id}
              event={event}
              info={
                infoByToolsetId.get(event.toolsetId) ??
                resolveToolsetInfo(event.toolsetId, undefined)
              }
              rowState={getRowState(event.id)}
              onApiKeyChange={handleApiKeyChange}
              onLogin={handleLogin}
              onDecline={handleDecline}
            />
          ))}
        </div>
      </div>
    </DialPopup>
  );
};

export default memo(ToolsetSigninDialog);
