import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import { Input } from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialPopup,
  DialSpinner,
  GhostButton,
  NeutralButton,
  PopupSize,
  PrimaryButton,
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
  ExternalServiceLoginOutcomeType,
  useExternalServiceLogin,
} from '../../hooks/externalServices/useExternalServiceLogin';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../hooks/toolsets/useToolsetLogin';
import { useUiFeature } from '../../hooks/useUiFeature';
import type { ResolvedRowInfo } from '../../models/signin-interrupt';
import { ClientChannelReportResult } from '../../server-api/client-channel';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  getExternalService,
  type GetExternalServiceResponseDto,
} from '../../server-api/external-services';
import { getToolset } from '../../server-api/toolsets';
import {
  PendingSigninEventKind,
  type PendingSigninEvent,
} from '../../types/client-channel';
import { RowAuthType } from '../../types/signin-interrupt';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '../../types/toolsets';
import { buildExternalServiceScopeId } from '../../utils/external-services';
import {
  resolveExternalServiceInfo,
  resolveToolsetInfo,
} from '../../utils/signin-interrupt';

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

interface SigninRowProps {
  event: PendingSigninEvent;
  info: ResolvedRowInfo;
  rowState: RowState;
  onApiKeyChange: (eventId: string, value: string) => void;
  onLogin: (event: PendingSigninEvent, info: ResolvedRowInfo) => void;
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
  const isApiKey = info.authenticationType === RowAuthType.ApiKey;
  const isNoAuth = info.authenticationType === RowAuthType.None;
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
          id={`signin-interrupt-api-key-${event.id}`}
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

      {isNoAuth ? (
        <div className="flex justify-end">
          <span className="dial-small-text text-secondary">
            {t(ToolsetSigninI18nKeys.NoCredentialsRequired)}
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
};

/** Dedup/grouping key for a pending event's underlying resource, used to resolve metadata once per resource and to auto-resolve sibling events. */
const getResourceKey = (event: PendingSigninEvent): string =>
  event.kind === PendingSigninEventKind.Toolset
    ? event.toolsetId
    : buildExternalServiceScopeId(event.appId, event.serviceName);

/**
 * Global, non-dismissible dialog that surfaces pending DIAL-Core-pushed
 * `toolset/signin` and `external-service/signin` events (raised mid-completion
 * when a tool call or an application's external service needs fresh
 * credentials) and lets the user log in or decline each one.
 */
const SigninInterruptDialog: FC = () => {
  const { t } = useTranslation();
  const { pendingEvents, reportEvent } = useClientChannel();
  const { toolsets, refetchToolsets } = useDeployments();
  const { login: loginToolsetResource } = useToolsetLogin();
  const { login: loginExternalService } = useExternalServiceLogin();
  const isLiveChatInteractionUiEnabled = useUiFeature(
    OverlayFeature.LiveChatInteraction,
  );
  const isLiveChatInteractionCapable = useFeatureFlag('liveChatInteraction');

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [resolvedToolsets, setResolvedToolsets] = useState<
    Record<string, DialToolsetDto>
  >({});
  const [resolvedExternalServices, setResolvedExternalServices] = useState<
    Record<string, GetExternalServiceResponseDto>
  >({});
  const [statusMessage, setStatusMessage] = useState('');
  const fetchingToolsetsRef = useRef(new Set<string>());
  const fetchingExternalServicesRef = useRef(new Set<string>());
  const autoResolvedRef = useRef(new Set<string>());

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
    for (const id of Array.from(autoResolvedRef.current)) {
      if (!activeIds.has(id)) autoResolvedRef.current.delete(id);
    }
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

  /* Best-effort fetch of metadata not yet present in the cached toolset list or resolved external-service map — the fallback name renders until this resolves. */
  useEffect(() => {
    const fetchToolset = async (toolsetId: string): Promise<void> => {
      try {
        const dto = await getToolset(toolsetId);
        setResolvedToolsets((prev) => ({ ...prev, [toolsetId]: dto }));
      } catch {
        // Best-effort — the fallback name renders until a later retry succeeds.
      } finally {
        fetchingToolsetsRef.current.delete(toolsetId);
      }
    };

    const fetchExternalService = async (
      appId: string,
      serviceName: string,
      key: string,
    ): Promise<void> => {
      try {
        const service = await getExternalService(appId, serviceName);
        setResolvedExternalServices((prev) => ({ ...prev, [key]: service }));
      } catch {
        // Best-effort — the fallback name renders until a later retry succeeds.
      } finally {
        fetchingExternalServicesRef.current.delete(key);
      }
    };

    for (const event of pendingEvents) {
      if (event.kind === PendingSigninEventKind.Toolset) {
        const known =
          toolsets.find((toolsetItem) => toolsetItem.id === event.toolsetId) ??
          resolvedToolsets[event.toolsetId];
        if (known || fetchingToolsetsRef.current.has(event.toolsetId)) continue;

        fetchingToolsetsRef.current.add(event.toolsetId);
        void fetchToolset(event.toolsetId);
      } else {
        const { appId, serviceName } = event;
        const key = buildExternalServiceScopeId(appId, serviceName);
        if (
          resolvedExternalServices[key] ||
          fetchingExternalServicesRef.current.has(key)
        ) {
          continue;
        }

        fetchingExternalServicesRef.current.add(key);
        void fetchExternalService(appId, serviceName, key);
      }
    }
  }, [pendingEvents, toolsets, resolvedToolsets, resolvedExternalServices]);

  const infoByResourceKey = useMemo(() => {
    const map = new Map<string, ResolvedRowInfo>();
    for (const event of pendingEvents) {
      const key = getResourceKey(event);
      if (map.has(key)) continue;
      if (event.kind === PendingSigninEventKind.Toolset) {
        const toolset =
          toolsets.find((toolsetItem) => toolsetItem.id === event.toolsetId) ??
          resolvedToolsets[event.toolsetId];
        map.set(key, resolveToolsetInfo(event.toolsetId, toolset));
      } else {
        map.set(
          key,
          resolveExternalServiceInfo(
            event.serviceName,
            resolvedExternalServices[key],
          ),
        );
      }
    }
    return map;
  }, [pendingEvents, toolsets, resolvedToolsets, resolvedExternalServices]);

  const reportSuccessOnce = useCallback(
    async (eventId: string, displayName: string) => {
      await reportEvent(eventId, ClientChannelReportResult.Success);
      setStatusMessage(
        t(ToolsetSigninI18nKeys.StatusLoginSuccess, { name: displayName }),
      );
    },
    [reportEvent, t],
  );

  /* A resolved-to-NONE external service needs no credentials — auto-resolve it once, rather than showing a dead-end row. */
  useEffect(() => {
    for (const event of pendingEvents) {
      if (event.kind !== PendingSigninEventKind.ExternalService) continue;
      const key = getResourceKey(event);
      const info = infoByResourceKey.get(key);
      if (info?.authenticationType !== RowAuthType.None) continue;
      if (autoResolvedRef.current.has(event.id)) continue;

      autoResolvedRef.current.add(event.id);
      void reportSuccessOnce(event.id, info.displayName);
    }
  }, [pendingEvents, infoByResourceKey, reportSuccessOnce]);

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
        const resourceKey = info ? getResourceKey(info) : undefined;
        setStatusMessage(
          t(ToolsetSigninI18nKeys.StatusDeclineSuccess, {
            name: resourceKey
              ? (infoByResourceKey.get(resourceKey)?.displayName ?? '')
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
    [reportEvent, setRowState, pendingEvents, infoByResourceKey, t],
  );

  const handleDeclineAll = useCallback(() => {
    for (const event of pendingEvents) {
      void handleDecline(event.id);
    }
  }, [pendingEvents, handleDecline]);

  const resolveSiblingIds = useCallback(
    (event: PendingSigninEvent, info: ResolvedRowInfo): string[] =>
      pendingEvents
        .filter(
          (other) =>
            other.id !== event.id &&
            other.kind === event.kind &&
            getResourceKey(other) === getResourceKey(event) &&
            infoByResourceKey.get(getResourceKey(other))?.credentialsLevel ===
              info.credentialsLevel,
        )
        .map((other) => other.id),
    [pendingEvents, infoByResourceKey],
  );

  const finishLogin = useCallback(
    async (event: PendingSigninEvent, info: ResolvedRowInfo) => {
      const siblingIds = resolveSiblingIds(event, info);
      try {
        await reportSuccessOnce(event.id, info.displayName);
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
    },
    [resolveSiblingIds, reportSuccessOnce, reportEvent, setRowState, t],
  );

  const handleLoginToolset = useCallback(
    (
      event: Extract<
        PendingSigninEvent,
        { kind: PendingSigninEventKind.Toolset }
      >,
      info: ResolvedRowInfo,
    ) => {
      const rowState = getRowState(event.id);
      const run = async (): Promise<void> => {
        const outcome = await loginToolsetResource({
          toolsetId: event.toolsetId,
          credentialsLevel: info.credentialsLevel as ToolsetCredentialsLevel,
          authenticationType: (info.authenticationType ??
            ToolsetAuthTypes.ApiKey) as ToolsetAuthTypes,
          apiKey: rowState.apiKey,
          oauthSettings: info.oauthSettings,
          forceStale: true,
        });
        if (outcome.type === ToolsetLoginOutcomeType.Success) {
          await refetchToolsets();
          await finishLogin(event, info);
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
        setRowState(event.id, { status: RowStatus.Idle });
      };
      void run();
    },
    [
      getRowState,
      loginToolsetResource,
      refetchToolsets,
      finishLogin,
      setRowState,
      t,
    ],
  );

  const handleLoginExternalService = useCallback(
    (
      event: Extract<
        PendingSigninEvent,
        { kind: PendingSigninEventKind.ExternalService }
      >,
      info: ResolvedRowInfo,
    ) => {
      const rowState = getRowState(event.id);
      const run = async (): Promise<void> => {
        const outcome = await loginExternalService({
          appId: event.appId,
          serviceId: event.serviceName,
          credentialsLevel:
            info.credentialsLevel as ExternalServiceCredentialsLevel,
          authenticationType: (info.authenticationType ??
            ExternalServiceAuthType.ApiKey) as ExternalServiceAuthType,
          apiKey: rowState.apiKey,
          oauthSettings: info.oauthSettings,
          forceStale: true,
        });
        if (outcome.type === ExternalServiceLoginOutcomeType.Success) {
          await finishLogin(event, info);
          return;
        }
        if (outcome.type === ExternalServiceLoginOutcomeType.PopupBlocked) {
          setRowState(event.id, {
            status: RowStatus.Idle,
            error: t(ToolsetSigninI18nKeys.ErrorPopupBlocked),
          });
          return;
        }
        if (outcome.type === ExternalServiceLoginOutcomeType.Failure) {
          setRowState(event.id, {
            status: RowStatus.Idle,
            error: t(ToolsetSigninI18nKeys.ErrorLoginFailed),
          });
          return;
        }
        setRowState(event.id, { status: RowStatus.Idle });
      };
      void run();
    },
    [getRowState, loginExternalService, finishLogin, setRowState, t],
  );

  const handleLogin = useCallback(
    (event: PendingSigninEvent, info: ResolvedRowInfo) => {
      /*
       * Must stay synchronous up to the login call for the OAuth popup-open
       * to remain inside the click's call stack — no `await` before it.
       */
      setRowState(event.id, { status: RowStatus.Processing, error: undefined });
      if (event.kind === PendingSigninEventKind.Toolset) {
        handleLoginToolset(event, info);
      } else {
        handleLoginExternalService(event, info);
      }
    },
    [setRowState, handleLoginToolset, handleLoginExternalService],
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
          {pendingEvents.map((event) => {
            const key = getResourceKey(event);
            const fallback =
              event.kind === PendingSigninEventKind.Toolset
                ? resolveToolsetInfo(event.toolsetId, undefined)
                : resolveExternalServiceInfo(event.serviceName, undefined);
            return (
              <SigninRow
                key={event.id}
                event={event}
                info={infoByResourceKey.get(key) ?? fallback}
                rowState={getRowState(event.id)}
                onApiKeyChange={handleApiKeyChange}
                onLogin={handleLogin}
                onDecline={handleDecline}
              />
            );
          })}
        </div>
      </div>
    </DialPopup>
  );
};

export default memo(SigninInterruptDialog);
