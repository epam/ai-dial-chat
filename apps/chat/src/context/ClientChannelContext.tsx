import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMatch } from 'react-router';
import {
  ClientChannelReportResult,
  reportClientChannel,
  subscribeClientChannel,
  unsubscribeClientChannel,
} from '../server-api/client-channel';
import {
  ClientChannelRpcRequest,
  EXTERNAL_SERVICE_SIGNIN_METHOD,
  PendingSigninEvent,
  PendingSigninEventKind,
  TOOLSET_SIGNIN_METHOD,
} from '../types/client-channel';
import { ROUTES } from '../types/routes';
import { parseExternalServiceUrl } from '../utils/external-services';
import { useFeatureFlag } from './AppConfigContext';

/** Capped exponential backoff for reconnect attempts (ms). After these are exhausted, the provider waits for `ensureConnected` (e.g. the next completion) or tab visibility to resume. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

interface ClientChannelContextValue {
  /** Current DIAL Core client-channel id, or `null` while disconnected/connecting. */
  channelId: string | null;
  /** Pending `toolset/signin` events awaiting a login/decline resolution, keyed by RPC event id. */
  pendingEvents: PendingSigninEvent[];
  /** Reports `{ id: eventId, result }` back to DIAL Core and removes the event from `pendingEvents` on success. Throws (and leaves the event pending) on failure. */
  reportEvent: (
    eventId: string,
    result: ClientChannelReportResult,
  ) => Promise<void>;
  /** Best-effort: triggers an immediate reconnect attempt if currently disconnected, without blocking the caller. */
  ensureConnected: () => void;
}

const ClientChannelContext = createContext<
  ClientChannelContextValue | undefined
>(undefined);

interface Props {
  children: ReactNode;
}

const parseSigninEvent = (payload: string): PendingSigninEvent | null => {
  try {
    const parsed = JSON.parse(payload) as ClientChannelRpcRequest;
    if (typeof parsed.id !== 'string') return null;

    if (parsed.method === TOOLSET_SIGNIN_METHOD) {
      const toolsetId = parsed.params?.toolsetId;
      if (typeof toolsetId !== 'string') return null;
      return { kind: PendingSigninEventKind.Toolset, id: parsed.id, toolsetId };
    }

    if (parsed.method === EXTERNAL_SERVICE_SIGNIN_METHOD) {
      /*
       * `params.url` is `applications/{bucket}/{app}/external_services/{name}`
       * — split into the application's own id (for metadata) and the
       * specific service name (keys the app's `external_services` map and
       * is required, rejoined, as the sign-in/sign-out scope id).
       */
      const url = parsed.params?.url;
      if (typeof url !== 'string' || !url) return null;
      const parsedUrl = parseExternalServiceUrl(url);
      if (!parsedUrl) return null;
      return {
        kind: PendingSigninEventKind.ExternalService,
        id: parsed.id,
        appId: parsedUrl.appId,
        serviceName: parsedUrl.serviceName,
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const ClientChannelProvider: FC<Props> = ({ children }) => {
  const isEnabled = useFeatureFlag('liveChatInteraction');
  /*
   * `toolset/signin` and `external_service/signin` events can only ever be
   * pushed by DIAL Core while a completion is streaming, which only happens
   * on a specific conversation page (`Conversation`, mounted at
   * `/conversations/*`) and the AppsEditor test-chat preview
   * (`AppPreviewChat`) — the two callers of `useConversationStream`. The bare
   * `/` route (`ConversationRoute`) is only the pre-conversation
   * composer/empty state: it creates a conversation via a plain REST call
   * and navigates to `/conversations/<id>` before any stream exists, so it
   * is intentionally excluded here.
   */
  const matchConversations = useMatch(`${ROUTES.Conversations}/*`);
  const matchAppsEditor = useMatch(ROUTES.AppsEditor);
  const isStreamingCapablePage = !!(matchConversations ?? matchAppsEditor);
  const isActive = isEnabled && isStreamingCapablePage;

  const [channelId, setChannelId] = useState<string | null>(null);
  const [pendingEvents, setPendingEvents] = useState<PendingSigninEvent[]>([]);

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const channelIdRef = useRef<string | null>(null);
  const eventsMapRef = useRef(new Map<string, PendingSigninEvent>());
  const resolvedIdsRef = useRef(new Set<string>());
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const isStoppedRef = useRef(false);

  const syncPendingEvents = useCallback(() => {
    setPendingEvents(Array.from(eventsMapRef.current.values()));
  }, []);

  const addEvent = useCallback(
    (event: PendingSigninEvent) => {
      if (
        eventsMapRef.current.has(event.id) ||
        resolvedIdsRef.current.has(event.id)
      ) {
        return;
      }
      eventsMapRef.current.set(event.id, event);
      syncPendingEvents();
    },
    [syncPendingEvents],
  );

  const removeEvent = useCallback(
    (eventId: string) => {
      if (eventsMapRef.current.delete(eventId)) {
        syncPendingEvents();
      }
    },
    [syncPendingEvents],
  );

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current != null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const readStream = useCallback(
    async (body: ReadableStream<Uint8Array>, signal: AbortSignal) => {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          if (signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (!trimmed.startsWith('data:')) continue;
            const event = parseSigninEvent(trimmed.slice(5).trim());
            if (event) addEvent(event);
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    [addEvent],
  );

  const connectRef = useRef<() => Promise<void>>(async () => undefined);

  const scheduleReconnect = useCallback(() => {
    if (isStoppedRef.current || !isActiveRef.current) return;
    if (attemptRef.current >= RECONNECT_DELAYS_MS.length) return;

    const delay = RECONNECT_DELAYS_MS[attemptRef.current];
    attemptRef.current += 1;
    clearRetryTimeout();
    retryTimeoutRef.current = setTimeout(() => {
      void connectRef.current();
    }, delay);
  }, [clearRetryTimeout]);

  const connect = useCallback(async () => {
    if (isStoppedRef.current || !isActiveRef.current) return;
    if (abortControllerRef.current) return; // already connecting/connected

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { body, channelId: newChannelId } = await subscribeClientChannel(
        channelIdRef.current ?? undefined,
        controller.signal,
      );
      attemptRef.current = 0;
      channelIdRef.current = newChannelId;
      setChannelId(newChannelId);

      await readStream(body, controller.signal);

      if (!controller.signal.aborted) {
        abortControllerRef.current = null;
        scheduleReconnect();
      }
    } catch {
      abortControllerRef.current = null;
      if (!controller.signal.aborted) {
        scheduleReconnect();
      }
    }
  }, [readStream, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const ensureConnected = useCallback(() => {
    if (isStoppedRef.current || !isActiveRef.current) return;

    /*
     * Core reuses the same RPC `id` across separate completions (it is not
     * a globally unique value), so a resolution recorded for a previous
     * completion must not permanently suppress the dialog for a later one.
     * Forgetting resolved ids at the start of every new completion keeps the
     * dedup guard scoped to "duplicate delivery within the same occurrence"
     * (still-pending events in `eventsMapRef` are untouched) instead of
     * "never show this id again for the rest of the session".
     */
    resolvedIdsRef.current.clear();

    if (abortControllerRef.current || channelIdRef.current) return;
    attemptRef.current = 0;
    clearRetryTimeout();
    void connect();
  }, [clearRetryTimeout, connect]);

  const disconnect = useCallback(() => {
    clearRetryTimeout();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const currentChannelId = channelIdRef.current;
    if (currentChannelId) {
      void unsubscribeClientChannel(currentChannelId).catch(() => undefined);
    }
    channelIdRef.current = null;
    setChannelId(null);
    eventsMapRef.current.clear();
    resolvedIdsRef.current.clear();
    syncPendingEvents();
  }, [clearRetryTimeout, syncPendingEvents]);

  useEffect(() => {
    isStoppedRef.current = false;
    if (!isActive) {
      disconnect();
      return undefined;
    }

    attemptRef.current = 0;
    void connect();

    return () => {
      isStoppedRef.current = true;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ensureConnected();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, ensureConnected]);

  const reportEvent = useCallback(
    async (
      eventId: string,
      result: ClientChannelReportResult,
    ): Promise<void> => {
      const currentChannelId = channelIdRef.current;
      if (!currentChannelId) {
        throw new Error('No active client channel to report on');
      }
      await reportClientChannel(currentChannelId, { id: eventId, result });
      resolvedIdsRef.current.add(eventId);
      removeEvent(eventId);
    },
    [removeEvent],
  );

  const value = useMemo(
    () => ({ channelId, pendingEvents, reportEvent, ensureConnected }),
    [channelId, pendingEvents, reportEvent, ensureConnected],
  );

  return (
    <ClientChannelContext.Provider value={value}>
      {children}
    </ClientChannelContext.Provider>
  );
};

export const useClientChannel = (): ClientChannelContextValue => {
  const ctx = useContext(ClientChannelContext);
  if (!ctx) {
    throw new Error(
      'useClientChannel must be used within a ClientChannelProvider',
    );
  }
  return ctx;
};
