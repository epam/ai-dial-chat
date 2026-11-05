import {
  type DialToolsetDto,
  type GetExternalServiceResponseDto,
  ReportClientChannelDtoResultEnum,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalServiceAuthType,
  type ExternalServiceCredentialsLevel,
  type ExternalServiceLoginOutcome,
  ExternalServiceLoginOutcomeType,
  type ExternalServiceLoginParams,
} from '../../external-services/useExternalServiceLogin';
import {
  ToolsetAuthTypes,
  type ToolsetCredentialsLevel,
} from '../../oauth/types';
import {
  type ToolsetLoginOutcome,
  ToolsetLoginOutcomeType,
  type ToolsetLoginParams,
} from '../../oauth/useToolsetLogin/useToolsetLogin';
import {
  type PendingExternalServiceSigninEvent,
  type PendingSigninEvent,
  PendingSigninEventKind,
  type PendingToolsetSigninEvent,
} from '../../shared/client-channel';
import { buildExternalServiceScopeId } from '../../shared/external-services';
import type {
  SigninInterruptAnnouncement,
  SigninInterruptRow,
  SigninRowInfo,
} from '../models';
import {
  getSigninEventResourceKey,
  resolveExternalServiceSigninRowInfo,
  resolveToolsetSigninRowInfo,
} from '../signin-row-info';
import {
  SigninInterruptAnnouncementKind,
  SigninInterruptRowError,
  SigninInterruptRowStatus,
} from '../types';

/** Host data and operations `useSigninInterrupt` resolves pending sign-in events with. */
export interface UseSigninInterruptOptions {
  /** Pending client-channel sign-in events, in display order. */
  pendingEvents: PendingSigninEvent[];
  /** Toolsets the host already has loaded; a listed toolset is not fetched again. */
  toolsets: DialToolsetDto[];
  /** Locale toolset display names are resolved for. */
  activeLocale: string;
  /** Locale used when a display name has no entry for `activeLocale`. */
  primaryLocale: string;
  /** Fetches a toolset that `toolsets` does not list; a rejection keeps the fallback name. */
  getToolset: (toolsetId: string) => Promise<DialToolsetDto>;
  /** Fetches an application's external service; a rejection keeps the fallback name. */
  getExternalService: (
    appId: string,
    serviceName: string,
  ) => Promise<GetExternalServiceResponseDto>;
  /** Logs in to a toolset, e.g. `useToolsetLogin().login`. */
  loginToolset: (params: ToolsetLoginParams) => Promise<ToolsetLoginOutcome>;
  /** Logs in to an external service, e.g. `useExternalServiceLogin().login`. */
  loginExternalService: (
    params: ExternalServiceLoginParams,
  ) => Promise<ExternalServiceLoginOutcome>;
  /** Refreshes the host's toolset list after a successful toolset login, before success is reported. */
  refetchToolsets: () => Promise<unknown>;
  /** Reports an event's resolution on the client channel; a rejection leaves the event pending. */
  reportEvent: (
    eventId: string,
    result: ReportClientChannelDtoResultEnum,
  ) => Promise<unknown>;
}

/** Rows, announcement and actions of a sign-in interrupt dialog. */
export interface UseSigninInterruptResult {
  /** One row per pending event, in `pendingEvents` order. */
  rows: SigninInterruptRow[];
  /** Latest resolution to announce, or `undefined` before the first one. */
  announcement?: SigninInterruptAnnouncement;
  /** Whether logins grant offline-use consent. Defaults to `true`. */
  offlineUsageConsent: boolean;
  /** Sets `offlineUsageConsent`. */
  setOfflineUsageConsent: (value: boolean) => void;
  /** Whether any row uses an API key or OAuth, so the offline-use consent control applies. */
  isOfflineUsageConsentShown: boolean;
  /** Stores a row's typed API key and clears its error. */
  changeApiKey: (eventId: string, value: string) => void;
  /** Starts a login for a row; synchronous up to the login call so an OAuth popup stays inside the click. */
  login: (eventId: string) => void;
  /** Reports a row as `denied`. */
  decline: (eventId: string) => Promise<void>;
  /** Declines every pending event. */
  declineAll: () => void;
}

interface RowState {
  status: SigninInterruptRowStatus;
  error?: SigninInterruptRowError;
  apiKey: string;
}

const DEFAULT_ROW_STATE: RowState = {
  status: SigninInterruptRowStatus.Idle,
  apiKey: '',
};

const resolveFallbackInfo = (
  event: PendingSigninEvent,
  primaryLocale: string,
): SigninRowInfo =>
  event.kind === PendingSigninEventKind.Toolset
    ? resolveToolsetSigninRowInfo(
        event.toolsetId,
        undefined,
        primaryLocale,
        primaryLocale,
      )
    : resolveExternalServiceSigninRowInfo(event.serviceName, undefined);

/** Resolves pending sign-in events into dialog rows and runs their login, decline and result reporting. */
export const useSigninInterrupt = ({
  pendingEvents,
  toolsets,
  activeLocale,
  primaryLocale,
  getToolset,
  getExternalService,
  loginToolset,
  loginExternalService,
  refetchToolsets,
  reportEvent,
}: UseSigninInterruptOptions): UseSigninInterruptResult => {
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [resolvedToolsets, setResolvedToolsets] = useState<
    Record<string, DialToolsetDto>
  >({});
  const [resolvedExternalServices, setResolvedExternalServices] = useState<
    Record<string, GetExternalServiceResponseDto>
  >({});
  const [announcement, setAnnouncement] =
    useState<SigninInterruptAnnouncement>();
  /*
   * Standing permission for the application to use these credentials while the
   * user is away; Core gates every on-behalf-of mint on it. Offered checked
   * because the interrupt only appears when an application has said it needs to
   * act for the user — but shown and declinable, never attached silently to the
   * "Log in" click.
   */
  const [offlineUsageConsent, setOfflineUsageConsent] = useState(true);
  const fetchingToolsetsRef = useRef(new Set<string>());
  const fetchingExternalServicesRef = useRef(new Set<string>());
  const autoResolvedRef = useRef(new Set<string>());

  const getRowState = useCallback(
    (eventId: string): RowState => rowStates[eventId] ?? DEFAULT_ROW_STATE,
    [rowStates],
  );

  /*
   * Core's RPC `id` can reappear in a later, unrelated completion, so a row's
   * local state must not survive past the event it belonged to — otherwise a
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
  }, [
    pendingEvents,
    toolsets,
    resolvedToolsets,
    resolvedExternalServices,
    getToolset,
    getExternalService,
  ]);

  const infoByResourceKey = useMemo(() => {
    const map = new Map<string, SigninRowInfo>();
    for (const event of pendingEvents) {
      const key = getSigninEventResourceKey(event);
      if (map.has(key)) continue;
      if (event.kind === PendingSigninEventKind.Toolset) {
        const toolset =
          toolsets.find((toolsetItem) => toolsetItem.id === event.toolsetId) ??
          resolvedToolsets[event.toolsetId];
        map.set(
          key,
          resolveToolsetSigninRowInfo(
            event.toolsetId,
            toolset,
            activeLocale,
            primaryLocale,
          ),
        );
      } else {
        map.set(
          key,
          resolveExternalServiceSigninRowInfo(
            event.serviceName,
            resolvedExternalServices[key],
          ),
        );
      }
    }
    return map;
  }, [
    pendingEvents,
    toolsets,
    resolvedToolsets,
    resolvedExternalServices,
    activeLocale,
    primaryLocale,
  ]);

  const getInfo = useCallback(
    (event: PendingSigninEvent): SigninRowInfo =>
      infoByResourceKey.get(getSigninEventResourceKey(event)) ??
      resolveFallbackInfo(event, primaryLocale),
    [infoByResourceKey, primaryLocale],
  );

  const reportSuccessOnce = useCallback(
    async (eventId: string, displayName: string) => {
      await reportEvent(eventId, ReportClientChannelDtoResultEnum.Success);
      setAnnouncement({
        kind: SigninInterruptAnnouncementKind.LoginSucceeded,
        name: displayName,
      });
    },
    [reportEvent],
  );

  /* A resolved-to-NONE external service needs no credentials — auto-resolve it once, rather than showing a dead-end row. */
  useEffect(() => {
    for (const event of pendingEvents) {
      if (event.kind !== PendingSigninEventKind.ExternalService) continue;
      const info = infoByResourceKey.get(getSigninEventResourceKey(event));
      if (info?.authenticationType !== ExternalServiceAuthType.None) continue;
      if (autoResolvedRef.current.has(event.id)) continue;

      autoResolvedRef.current.add(event.id);
      void reportSuccessOnce(event.id, info.displayName);
    }
  }, [pendingEvents, infoByResourceKey, reportSuccessOnce]);

  const changeApiKey = useCallback(
    (eventId: string, value: string) => {
      setRowState(eventId, { apiKey: value, error: undefined });
    },
    [setRowState],
  );

  const decline = useCallback(
    async (eventId: string) => {
      setRowState(eventId, {
        status: SigninInterruptRowStatus.Processing,
        error: undefined,
      });
      try {
        await reportEvent(eventId, ReportClientChannelDtoResultEnum.Denied);
        const event = pendingEvents.find((item) => item.id === eventId);
        setAnnouncement({
          kind: SigninInterruptAnnouncementKind.Declined,
          name: event
            ? (infoByResourceKey.get(getSigninEventResourceKey(event))
                ?.displayName ?? '')
            : '',
        });
      } catch {
        setRowState(eventId, {
          status: SigninInterruptRowStatus.Idle,
          error: SigninInterruptRowError.DeclineFailed,
        });
      }
    },
    [reportEvent, setRowState, pendingEvents, infoByResourceKey],
  );

  const declineAll = useCallback(() => {
    for (const event of pendingEvents) {
      void decline(event.id);
    }
  }, [pendingEvents, decline]);

  const resolveSiblingIds = useCallback(
    (event: PendingSigninEvent, info: SigninRowInfo): string[] =>
      pendingEvents
        .filter(
          (other) =>
            other.id !== event.id &&
            other.kind === event.kind &&
            getSigninEventResourceKey(other) ===
              getSigninEventResourceKey(event) &&
            infoByResourceKey.get(getSigninEventResourceKey(other))
              ?.credentialsLevel === info.credentialsLevel,
        )
        .map((other) => other.id),
    [pendingEvents, infoByResourceKey],
  );

  const finishLogin = useCallback(
    async (event: PendingSigninEvent, info: SigninRowInfo) => {
      const siblingIds = resolveSiblingIds(event, info);
      try {
        await reportSuccessOnce(event.id, info.displayName);
      } catch {
        setRowState(event.id, {
          status: SigninInterruptRowStatus.Idle,
          error: SigninInterruptRowError.LoginFailed,
        });
        return;
      }
      for (const siblingId of siblingIds) {
        void reportEvent(siblingId, ReportClientChannelDtoResultEnum.Success);
      }
    },
    [resolveSiblingIds, reportSuccessOnce, reportEvent, setRowState],
  );

  const failRow = useCallback(
    (eventId: string, error?: SigninInterruptRowError) => {
      setRowState(eventId, { status: SigninInterruptRowStatus.Idle, error });
    },
    [setRowState],
  );

  const runToolsetLogin = useCallback(
    async (
      event: PendingToolsetSigninEvent,
      info: SigninRowInfo,
      apiKey: string,
    ): Promise<void> => {
      const outcome = await loginToolset({
        toolsetId: event.toolsetId,
        credentialsLevel: info.credentialsLevel as ToolsetCredentialsLevel,
        authenticationType: (info.authenticationType ??
          ToolsetAuthTypes.ApiKey) as ToolsetAuthTypes,
        apiKey,
        oauthSettings: info.oauthSettings,
        forceStale: true,
        offlineUsageConsent,
      });
      switch (outcome.type) {
        case ToolsetLoginOutcomeType.Success:
          await refetchToolsets();
          await finishLogin(event, info);
          return;
        case ToolsetLoginOutcomeType.PopupBlocked:
          failRow(event.id, SigninInterruptRowError.PopupBlocked);
          return;
        case ToolsetLoginOutcomeType.Failure:
          failRow(event.id, SigninInterruptRowError.LoginFailed);
          return;
        default:
          failRow(event.id);
      }
    },
    [loginToolset, offlineUsageConsent, refetchToolsets, finishLogin, failRow],
  );

  const runExternalServiceLogin = useCallback(
    async (
      event: PendingExternalServiceSigninEvent,
      info: SigninRowInfo,
      apiKey: string,
    ): Promise<void> => {
      const outcome = await loginExternalService({
        appId: event.appId,
        serviceId: event.serviceName,
        credentialsLevel:
          info.credentialsLevel as ExternalServiceCredentialsLevel,
        authenticationType:
          info.authenticationType ?? ExternalServiceAuthType.ApiKey,
        apiKey,
        oauthSettings: info.oauthSettings,
        forceStale: true,
        offlineUsageConsent,
      });
      switch (outcome.type) {
        case ExternalServiceLoginOutcomeType.Success:
          await finishLogin(event, info);
          return;
        case ExternalServiceLoginOutcomeType.AdminConsentRequired:
          failRow(event.id, SigninInterruptRowError.AdminConsentRequired);
          return;
        case ExternalServiceLoginOutcomeType.OfflineUnavailable:
          failRow(event.id, SigninInterruptRowError.OfflineUnavailable);
          return;
        case ExternalServiceLoginOutcomeType.PopupBlocked:
          failRow(event.id, SigninInterruptRowError.PopupBlocked);
          return;
        case ExternalServiceLoginOutcomeType.Failure:
          failRow(event.id, SigninInterruptRowError.LoginFailed);
          return;
        default:
          failRow(event.id);
      }
    },
    [loginExternalService, offlineUsageConsent, finishLogin, failRow],
  );

  const login = useCallback(
    (eventId: string) => {
      const event = pendingEvents.find((item) => item.id === eventId);
      if (!event) return;
      const info = getInfo(event);
      const { apiKey } = getRowState(eventId);
      /*
       * Must stay synchronous up to the login call for the OAuth popup-open
       * to remain inside the click's call stack — no `await` before it.
       */
      setRowState(eventId, {
        status: SigninInterruptRowStatus.Processing,
        error: undefined,
      });
      if (event.kind === PendingSigninEventKind.Toolset) {
        void runToolsetLogin(event, info, apiKey);
      } else {
        void runExternalServiceLogin(event, info, apiKey);
      }
    },
    [
      pendingEvents,
      getInfo,
      getRowState,
      setRowState,
      runToolsetLogin,
      runExternalServiceLogin,
    ],
  );

  const rows = useMemo(
    (): SigninInterruptRow[] =>
      pendingEvents.map((event) => {
        const info = getInfo(event);
        const { status, error, apiKey } = getRowState(event.id);
        const requiresApiKey =
          info.authenticationType === ExternalServiceAuthType.ApiKey;
        return {
          event,
          info,
          status,
          isProcessing: status === SigninInterruptRowStatus.Processing,
          error,
          apiKey,
          requiresApiKey,
          requiresNoCredentials:
            info.authenticationType === ExternalServiceAuthType.None,
          isDialNative:
            info.authenticationType === ExternalServiceAuthType.DialNative,
          canSubmitLogin: !requiresApiKey || apiKey.trim().length > 0,
        };
      }),
    [pendingEvents, getInfo, getRowState],
  );

  const isOfflineUsageConsentShown = useMemo(
    () =>
      pendingEvents.some((event) => {
        const authType = infoByResourceKey.get(
          getSigninEventResourceKey(event),
        )?.authenticationType;
        return (
          authType === ExternalServiceAuthType.ApiKey ||
          authType === ExternalServiceAuthType.OAuth
        );
      }),
    [pendingEvents, infoByResourceKey],
  );

  return {
    rows,
    announcement,
    offlineUsageConsent,
    setOfflineUsageConsent,
    isOfflineUsageConsentShown,
    changeApiKey,
    login,
    decline,
    declineAll,
  };
};
