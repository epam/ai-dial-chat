import { parseExternalServiceUrl } from '@epam/ai-dial-chat-hooks';
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import { useFeatureFlag } from './AppConfigContext';
import { useGeneration } from './GenerationContext';

/** Capped exponential backoff for reconnect attempts (ms). After these are exhausted, the provider waits for `ensureConnected` (e.g. the next completion) or tab visibility to resume. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

/** Idle grace period (ms) after a generation settles before disconnecting the channel, if nothing else is generating. Mirrors chat 1.0's `UNSUBSCRIBE_IDLE_DELAY_MS`. */
const IDLE_DISCONNECT_DELAY_MS = 1000;

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
  /** Resolves with the current channel id, nudging a connect attempt and waiting up to `timeoutMs` (default 40000) if one isn't established yet. Resolves `null` if the mechanism is inactive or the wait times out. */
  waitForChannel: (timeoutMs?: number) => Promise<string | null>;
  /** Notifies the provider that a generation just settled (completed or errored), so it can schedule an idle disconnect if nothing else is generating. */
  notifyGenerationSettled: () => void;
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
  const { hasActiveGeneration } = useGeneration();
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
  // Sync before effects fire so callbacks always see the latest value — see client-channel-protocol spec.
  useLayoutEffect(() => {
    isActiveRef.current = isActive;
  });

  const channelIdRef = useRef<string | null>(null);
  const eventsMapRef = useRef(new Map<string, PendingSigninEvent>());
  const resolvedIdsRef = useRef(new Set<string>());
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleDisconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const attemptRef = useRef(0);
  const isStoppedRef = useRef(false);
  const channelWaitersRef = useRef<Set<(id: string | null) => void>>(new Set());
  /*
   * Bumped by `disconnect()`. Lets a stale `connect()` invocation — one whose
   * subscribe call resolves or rejects after a teardown/reconnect has moved
   * on — recognize it is no longer current and skip every ref write it would
   * otherwise perform, instead of racing a newer connection.
   */
  const connectionGenerationRef = useRef(0);
  /*
   * Counted (not boolean) so two concurrent completions each hold their own
   * token: the first to settle releases only its own token, leaving the
   * second's demand intact. Internal only — never exposed on
   * `ClientChannelContextValue`, so `libs/chat-hooks` learns nothing about
   * demand.
   */
  const demandRef = useRef(new Set<symbol>());

  const resolveChannelWaiters = useCallback((id: string | null) => {
    const waiters = channelWaitersRef.current;
    channelWaitersRef.current = new Set();
    waiters.forEach((resolve) => resolve(id));
  }, []);

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

  const clearIdleDisconnectTimeout = useCallback(() => {
    if (idleDisconnectTimeoutRef.current != null) {
      clearTimeout(idleDisconnectTimeoutRef.current);
      idleDisconnectTimeoutRef.current = null;
    }
  }, []);

  /*
   * An unresolved signin event is the one thing that pins the channel open:
   * DIAL Core is blocked waiting for its report, and `reportEvent` needs this
   * channel id to deliver it. The signin-interrupt contract also says the
   * global dialog is dismissible only by resolving every listed event, and the
   * dialog renders exactly this pending-event list — so tearing the channel
   * down (which clears the list) would dismiss it by itself. Both the idle
   * timer and the route-leave teardown therefore stand down while this holds.
   */
  const hasPendingEvents = useCallback(() => eventsMapRef.current.size > 0, []);

  /** True while a completion has acquired demand — decides whether a channel *should* exist (eligibility alone only decides whether one *may*). */
  const hasDemand = useCallback(() => demandRef.current.size > 0, []);

  /** Adds a fresh opaque token to the demand registry, unconditionally — callers are expected to have already checked eligibility. */
  const acquireDemand = useCallback((): symbol => {
    const token = Symbol('client-channel-demand');
    demandRef.current.add(token);
    return token;
  }, []);

  /** Removes exactly this token, if still present. */
  const releaseDemand = useCallback((token: symbol) => {
    demandRef.current.delete(token);
  }, []);

  /**
   * The channel is wanted while the flag/route condition holds AND a
   * completion has acquired demand, and also while any signin event is still
   * unresolved (the pending-event term is what lets a pinned channel
   * reconnect off-route).
   */
  const isChannelWanted = useCallback(
    () => (isActiveRef.current && hasDemand()) || hasPendingEvents(),
    [hasDemand, hasPendingEvents],
  );

  /*
   * `notifyGenerationSettled()` has no way to identify which token its own
   * generation's `ensureConnected()` call acquired — the capability is
   * intentionally parameterless. Since every held token means the same
   * thing ("some completion still needs this channel"), removing any single
   * one keeps the count correct: one `ensureConnected()` call acquires
   * exactly one token per generation, and this removes exactly one per
   * settlement, so the registry never leaks regardless of which token is
   * popped.
   */
  const releaseOneDemand = useCallback(() => {
    const { value, done } = demandRef.current.values().next();
    if (!done) demandRef.current.delete(value);
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
    if (isStoppedRef.current || !isChannelWanted()) return;
    if (attemptRef.current >= RECONNECT_DELAYS_MS.length) return;

    const delay = RECONNECT_DELAYS_MS[attemptRef.current];
    attemptRef.current += 1;
    clearRetryTimeout();
    retryTimeoutRef.current = setTimeout(() => {
      void connectRef.current();
    }, delay);
  }, [clearRetryTimeout, isChannelWanted]);

  const connect = useCallback(async () => {
    if (isStoppedRef.current || !isChannelWanted()) return;
    if (abortControllerRef.current) return; // already connecting/connected

    const myGeneration = connectionGenerationRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    /** True while this call is still the connection `disconnect()` hasn't superseded and its own attempt hasn't been aborted. */
    const isCurrent = () =>
      !controller.signal.aborted &&
      myGeneration === connectionGenerationRef.current;

    try {
      const { body, channelId: newChannelId } = await subscribeClientChannel(
        channelIdRef.current ?? undefined,
        controller.signal,
      );

      if (!isCurrent()) {
        // A superseded/aborted attempt's late success installs nothing.
        void body.cancel().catch(() => undefined);
        return;
      }

      attemptRef.current = 0;
      channelIdRef.current = newChannelId;
      setChannelId(newChannelId);
      resolveChannelWaiters(newChannelId);

      await readStream(body, controller.signal);

      if (isCurrent()) {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        scheduleReconnect();
      }
    } catch {
      if (isCurrent()) {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        resolveChannelWaiters(null);
        scheduleReconnect();
      }
    }
  }, [isChannelWanted, readStream, resolveChannelWaiters, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /**
   * The mechanical half of "make sure a connection is under way": clears the
   * idle timer, forgets resolved-event dedup state, and kicks off `connect()`
   * if nothing is already connecting/connected. Carries no demand semantics
   * of its own — callers that need demand held call `acquireDemand()`
   * themselves, so this can be reused (by `waitForChannel`) without
   * double-acquiring for the same completion.
   */
  const beginConnectionAttempt = useCallback(() => {
    clearIdleDisconnectTimeout();
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
  }, [clearIdleDisconnectTimeout, clearRetryTimeout, connect]);

  const ensureConnected = useCallback(() => {
    if (!isStoppedRef.current && isActiveRef.current) {
      acquireDemand();
    }
    beginConnectionAttempt();
  }, [acquireDemand, beginConnectionAttempt]);

  const disconnect = useCallback(() => {
    connectionGenerationRef.current += 1;
    clearRetryTimeout();
    clearIdleDisconnectTimeout();
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
    demandRef.current.clear();
    syncPendingEvents();
    resolveChannelWaiters(null);
  }, [
    clearIdleDisconnectTimeout,
    clearRetryTimeout,
    resolveChannelWaiters,
    syncPendingEvents,
  ]);

  const scheduleIdleDisconnect = useCallback(() => {
    clearIdleDisconnectTimeout();
    idleDisconnectTimeoutRef.current = setTimeout(() => {
      idleDisconnectTimeoutRef.current = null;
      /*
       * Re-checked at fire time: a generation may have started, a signin
       * event may have arrived, or a new completion may have acquired demand
       * (before its own generation is even tracked), inside the grace window.
       */
      if (hasActiveGeneration() || hasPendingEvents() || hasDemand()) return;
      disconnect();
    }, IDLE_DISCONNECT_DELAY_MS);
  }, [
    clearIdleDisconnectTimeout,
    disconnect,
    hasActiveGeneration,
    hasDemand,
    hasPendingEvents,
  ]);

  const notifyGenerationSettled = useCallback(() => {
    releaseOneDemand();
    if (hasActiveGeneration()) return;
    if (hasPendingEvents()) {
      /*
       * The generation that carried the signin event has settled — Core ends
       * the completion while it waits for the report — but the event it left
       * behind still needs this channel, so no disconnect is scheduled and any
       * timer armed before the event arrived is dropped.
       */
      clearIdleDisconnectTimeout();
      return;
    }
    scheduleIdleDisconnect();
  }, [
    clearIdleDisconnectTimeout,
    hasActiveGeneration,
    hasPendingEvents,
    releaseOneDemand,
    scheduleIdleDisconnect,
  ]);

  // See client-channel-protocol spec for the full rationale.
  const waitForChannel = useCallback(
    (timeoutMs = 40000): Promise<string | null> => {
      if (channelIdRef.current) return Promise.resolve(channelIdRef.current);
      if (isStoppedRef.current || !isActiveRef.current) {
        return Promise.resolve(null);
      }

      /*
       * Short-lived: held only for this wait's own duration and released the
       * moment it settles, below — never by `notifyGenerationSettled()`. The
       * long-lived demand for the completion's full lifetime is
       * `ensureConnected()`'s (every real caller invokes it just before this).
       * This token exists so a connect attempt this call kicks off stays
       * "wanted" for as long as the wait itself is outstanding, independent
       * of that.
       */
      const waitToken = acquireDemand();
      beginConnectionAttempt();

      return new Promise<string | null>((resolve) => {
        const waiters = channelWaitersRef.current;
        const settle = (id: string | null) => {
          waiters.delete(settle);
          clearTimeout(timeoutId);
          releaseDemand(waitToken);
          resolve(id);
        };
        waiters.add(settle);
        const timeoutId = setTimeout(
          () => settle(channelIdRef.current),
          timeoutMs,
        );
      });
    },
    [acquireDemand, beginConnectionAttempt, releaseDemand],
  );

  const disconnectRef = useRef(disconnect);
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  /*
   * Route/flag lifecycle. The teardown lives in the effect body rather than in
   * a cleanup so that a re-run caused by the route (or flag) changing can
   * honour the pending-event pin — a cleanup cannot tell a dependency change
   * apart from an unmount, and would tear the channel down (clearing the
   * dialog's events) on every route change. Unmount is handled by its own
   * effect below, which always disconnects.
   */
  useEffect(() => {
    isStoppedRef.current = false;
    if (!isActive) {
      /*
       * Leaving a streaming-capable route with signin events still unresolved
       * keeps the subscription: the dialog is application-level, outlives the
       * route that spawned it, and its report calls still need this channel.
       * The flag going off is different — the whole mechanism is disabled, so
       * the pending events go with it.
       */
      if (isEnabled && hasPendingEvents()) return;
      disconnect();
    }
    /*
     * No connect half: becoming eligible (route mount/return, flag turning
     * on) records eligibility only — it creates no demand, so nothing
     * connects here. `ensureConnected`/`waitForChannel` are the only paths
     * that create demand, and they run at the start of every completion.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isEnabled]);

  /* Unmounting ends the session's use of the channel outright — pin or not. */
  useEffect(
    () => () => {
      isStoppedRef.current = true;
      disconnectRef.current();
    },
    [],
  );

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

      if (hasPendingEvents()) return;
      /*
       * Last event resolved — resume the lifecycle that was held off while the
       * dialog was open: tear down at once if the route no longer wants a
       * channel, otherwise fall back to the idle grace period.
       */
      if (!isActiveRef.current) {
        disconnect();
      } else if (!hasActiveGeneration() && !hasDemand()) {
        scheduleIdleDisconnect();
      }
    },
    [
      disconnect,
      hasActiveGeneration,
      hasDemand,
      hasPendingEvents,
      removeEvent,
      scheduleIdleDisconnect,
    ],
  );

  const value = useMemo(
    () => ({
      channelId,
      pendingEvents,
      reportEvent,
      ensureConnected,
      waitForChannel,
      notifyGenerationSettled,
    }),
    [
      channelId,
      pendingEvents,
      reportEvent,
      ensureConnected,
      waitForChannel,
      notifyGenerationSettled,
    ],
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
