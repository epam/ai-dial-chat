import {
  type GetMessagesResponse,
  type OverlayMessageEvent,
  type OverlayMessageRequest,
  type OverlayMessageResponse,
  OverlayEventType,
  OverlayRequestType,
  type SendMessageResponse,
  type SetOverlayOptionsPayload,
  type SetOverlayOptionsResponse,
  type SetSystemPromptResponse,
  type SetTemperaturePayload,
  type SetTemperatureResponse,
  isOverlayMessageRequest,
} from '@epam/ai-dial-chat-shared';
import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getConversationRoute } from '../../constants/routes';
import { AuthStatus } from '../../types/auth-status';
import { useAppConfig } from '../AppConfigContext';
import { useUser } from '../auth/UserContext';
import { useTheme } from '../ThemeContext';

/**
 * Read/write surface backed by whichever conversation `ConversationPage`
 * currently has mounted. Registered/unregistered by `ConversationPage` via
 * `registerActiveConversationBridge`.
 */
export interface ActiveConversationBridge {
  /** Returns the active conversation's messages. */
  getMessages: () => GetMessagesResponse;
  /** Sends a new message in the active conversation. */
  sendMessage: (content: string) => Promise<SendMessageResponse>;
  /** Sets the message input's current text content. */
  setInputContent: (content: string) => void;
  /** Persists a new system prompt on the active conversation. */
  setSystemPrompt: (systemPrompt: string) => Promise<SetSystemPromptResponse>;
  /** Persists a new temperature on the active conversation. */
  setTemperature: (temperature: number) => Promise<SetTemperatureResponse>;
}

/** Public API exposed by `OverlayProvider` via `useOverlay`/`useOptionalOverlay`. */
export interface OverlayContextType {
  /** Registers (or, with `null`, unregisters) the bridge backing active-conversation requests. */
  registerActiveConversationBridge: (
    bridge: ActiveConversationBridge | null,
  ) => void;
  /** Deployment id received via `SET_OVERLAY_OPTIONS`, awaiting application once deployments are available. */
  pendingModelId: string | null;
  /** Clears `pendingModelId` once a consumer has applied it. */
  clearPendingModelId: () => void;
  /** Emits `SELECTED_CONVERSATION_LOADED`, and `READY_TO_INTERACT` the first time it is called. */
  notifyConversationLoaded: () => void;
  /** Emits `CONVERSATIONS_UPDATED`. */
  notifyConversationsUpdated: () => void;
  /** Emits `GPT_START_GENERATING`. */
  notifyGenerationStart: () => void;
  /** Emits `GPT_END_GENERATING`. */
  notifyGenerationEnd: () => void;
  /** Emits `STOP_GENERATING`. */
  notifyStopGenerating: () => void;
}

const OverlayContext = createContext<OverlayContextType | undefined>(undefined);

const ACTIVE_CONVERSATION_REQUEST_TYPES: ReadonlySet<OverlayRequestType> =
  new Set([
    OverlayRequestType.GetMessages,
    OverlayRequestType.SendMessage,
    OverlayRequestType.SetInputContent,
    OverlayRequestType.SetSystemPrompt,
    OverlayRequestType.SetTemperature,
  ]);

const DEFAULT_PENDING_BRIDGE_REQUEST_TIMEOUT_MS = 10000;

interface PendingBridgeRequest {
  request: OverlayMessageRequest;
  timeoutId: number;
}

const getRequestExpiresAt = (request: OverlayMessageRequest): number =>
  typeof request.expiresAt === 'number'
    ? request.expiresAt
    : Date.now() + DEFAULT_PENDING_BRIDGE_REQUEST_TIMEOUT_MS;

const isRequestExpired = (request: OverlayMessageRequest): boolean =>
  typeof request.expiresAt === 'number' && request.expiresAt <= Date.now();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasStringPayload = <TKey extends string>(
  payload: unknown,
  key: TKey,
): payload is Record<TKey, string> =>
  isRecord(payload) && typeof payload[key] === 'string';

const hasTemperaturePayload = (
  payload: unknown,
): payload is SetTemperaturePayload =>
  isRecord(payload) &&
  typeof payload.temperature === 'number' &&
  Number.isFinite(payload.temperature);

const hasOptionalStringField = (
  payload: Record<string, unknown>,
  key: keyof SetOverlayOptionsPayload,
): boolean =>
  !(key in payload) || payload[key] == null || typeof payload[key] === 'string';

const hasSetOverlayOptionsPayload = (
  payload: unknown,
): payload is Partial<SetOverlayOptionsPayload> | null | undefined => {
  if (payload == null) {
    return true;
  }
  if (!isRecord(payload)) {
    return false;
  }
  return (
    hasOptionalStringField(payload, 'hostDomain') &&
    hasOptionalStringField(payload, 'theme') &&
    hasOptionalStringField(payload, 'modelId') &&
    hasOptionalStringField(payload, 'overlayConversationId')
  );
};

const logOverlayWarning = (message: string, error?: unknown): void => {
  if (error) {
    console.warn(`Overlay: ${message}`, error);
    return;
  }
  console.warn(`Overlay: ${message}`);
};

/**
 * Detects whether overlay mode is reachable: the runtime config flag is on
 * and the app is actually framed. Does not validate the framing origin —
 * that happens server-side (CSP `frame-ancestors`) and again on the
 * `SET_OVERLAY_OPTIONS` handshake message.
 */
export const isOverlayModeEligible = (overlayEnabled: boolean): boolean =>
  overlayEnabled && typeof window !== 'undefined' && window.self !== window.top;

/**
 * Owns overlay-mode state: the `window` `message` listener, the handshake
 * state machine, the validated `hostDomain`, and the active-conversation
 * bridge registry. Mounted only when overlay mode is eligible (see
 * `OverlayModeGate`) — never attaches a listener otherwise.
 */
export const OverlayProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const {
    config: { overlayAllowedOrigins },
  } = useAppConfig();
  const { status: authStatus } = useUser();
  const { setTheme } = useTheme();
  const navigate = useNavigate();

  const hostDomainRef = useRef<string | null>(null);
  const hasSentInitReadyRef = useRef(false);
  const hasSentReadyRef = useRef(false);
  const hasEmittedReadyToInteractRef = useRef(false);
  const hasPendingConversationLoadedEventRef = useRef(false);
  const activeBridgeRef = useRef<ActiveConversationBridge | null>(null);
  const pendingBridgeRequestsRef = useRef<PendingBridgeRequest[]>([]);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);

  const postBootstrapEvent = useCallback((type: OverlayEventType) => {
    window.parent.postMessage({ type }, '*');
  }, []);

  const postToHost = useCallback(
    (message: OverlayMessageEvent | OverlayMessageResponse): boolean => {
      if (!hostDomainRef.current) return false;
      window.parent.postMessage(message, hostDomainRef.current);
      return true;
    },
    [],
  );

  const flushConversationLoadedEvent = useCallback(() => {
    if (!hasPendingConversationLoadedEventRef.current) return;
    if (!postToHost({ type: OverlayEventType.SelectedConversationLoaded })) {
      return;
    }

    hasPendingConversationLoadedEventRef.current = false;
    if (!hasEmittedReadyToInteractRef.current) {
      hasEmittedReadyToInteractRef.current = postToHost({
        type: OverlayEventType.ReadyToInteract,
      });
    }
  }, [postToHost]);

  const isTrustedHostOrigin = useCallback(
    (origin: string): boolean =>
      hostDomainRef.current === origin &&
      overlayAllowedOrigins.includes(origin),
    [overlayAllowedOrigins],
  );

  const clearPendingBridgeRequests = useCallback(() => {
    pendingBridgeRequestsRef.current.forEach(({ timeoutId }) => {
      window.clearTimeout(timeoutId);
    });
    pendingBridgeRequestsRef.current = [];
  }, []);

  const queuePendingBridgeRequest = useCallback(
    (request: OverlayMessageRequest) => {
      const expiresAt = getRequestExpiresAt(request);
      const delayMs = expiresAt - Date.now();
      if (delayMs <= 0) {
        return;
      }

      pendingBridgeRequestsRef.current =
        pendingBridgeRequestsRef.current.filter((pending) => {
          if (pending.request.requestId !== request.requestId) {
            return true;
          }
          window.clearTimeout(pending.timeoutId);
          return false;
        });

      const timeoutId = window.setTimeout(() => {
        pendingBridgeRequestsRef.current =
          pendingBridgeRequestsRef.current.filter(
            (pending) => pending.request.requestId !== request.requestId,
          );
      }, delayMs);

      pendingBridgeRequestsRef.current.push({ request, timeoutId });
    },
    [],
  );

  const executeAgainstBridge = useCallback(
    (
      bridge: ActiveConversationBridge,
      type: OverlayRequestType,
      payload: unknown,
    ): Promise<unknown> | null => {
      switch (type) {
        case OverlayRequestType.GetMessages:
          return Promise.resolve(bridge.getMessages());
        case OverlayRequestType.SendMessage:
          if (!hasStringPayload(payload, 'content')) {
            return null;
          }
          return bridge.sendMessage(payload.content);
        case OverlayRequestType.SetInputContent:
          if (!hasStringPayload(payload, 'content')) {
            return null;
          }
          bridge.setInputContent(payload.content);
          return Promise.resolve(undefined);
        case OverlayRequestType.SetSystemPrompt:
          if (!hasStringPayload(payload, 'systemPrompt')) {
            return null;
          }
          return bridge.setSystemPrompt(payload.systemPrompt);
        case OverlayRequestType.SetTemperature:
          if (!hasTemperaturePayload(payload)) {
            return null;
          }
          return bridge.setTemperature(payload.temperature);
        default:
          return Promise.resolve(undefined);
      }
    },
    [],
  );

  const handleActiveConversationRequest = useCallback(
    (request: OverlayMessageRequest) => {
      if (isRequestExpired(request)) {
        return;
      }
      const bridge = activeBridgeRef.current;
      if (!bridge) {
        queuePendingBridgeRequest(request);
        return;
      }
      const requestType = request.type as OverlayRequestType;
      let responsePromise: Promise<unknown> | null = null;
      try {
        responsePromise = executeAgainstBridge(
          bridge,
          requestType,
          request.payload,
        );
      } catch (error) {
        logOverlayWarning(`failed to execute ${requestType}`, error);
        return;
      }
      if (!responsePromise) {
        logOverlayWarning(`rejected malformed ${requestType} payload`);
        return;
      }
      void responsePromise
        .then((responsePayload) => {
          postToHost({
            type: `${requestType}/RESPONSE`,
            requestId: request.requestId,
            payload: responsePayload,
          });
        })
        .catch((error) => {
          logOverlayWarning(`failed to execute ${requestType}`, error);
        });
    },
    [executeAgainstBridge, postToHost, queuePendingBridgeRequest],
  );

  const registerActiveConversationBridge = useCallback(
    (bridge: ActiveConversationBridge | null) => {
      activeBridgeRef.current = bridge;
      if (bridge && pendingBridgeRequestsRef.current.length > 0) {
        const pending = pendingBridgeRequestsRef.current;
        pendingBridgeRequestsRef.current = [];
        pending.forEach(({ request, timeoutId }) => {
          window.clearTimeout(timeoutId);
          handleActiveConversationRequest(request);
        });
      }
    },
    [handleActiveConversationRequest],
  );

  const handleSetOverlayOptions = useCallback(
    (origin: string, request: OverlayMessageRequest) => {
      if (!overlayAllowedOrigins.includes(origin)) {
        logOverlayWarning(`rejected SET_OVERLAY_OPTIONS from ${origin}`);
        return;
      }
      if (!hasSetOverlayOptionsPayload(request.payload)) {
        logOverlayWarning('rejected malformed SET_OVERLAY_OPTIONS payload');
        return;
      }
      const payload = request.payload;
      if (payload?.hostDomain && payload.hostDomain !== origin) {
        logOverlayWarning(
          `rejected SET_OVERLAY_OPTIONS with hostDomain ${payload.hostDomain} from ${origin}`,
        );
        return;
      }
      if (hostDomainRef.current && hostDomainRef.current !== origin) {
        logOverlayWarning(`rejected SET_OVERLAY_OPTIONS from ${origin}`);
        return;
      }
      hostDomainRef.current = origin;

      if (payload?.theme) {
        setTheme(payload.theme);
      }
      if (payload?.modelId) {
        setPendingModelId(payload.modelId);
      }
      if (payload?.overlayConversationId) {
        navigate(getConversationRoute(payload.overlayConversationId));
      }

      const responsePayload: SetOverlayOptionsResponse = { applied: true };
      postToHost({
        type: `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
        requestId: request.requestId,
        payload: responsePayload,
      });
      flushConversationLoadedEvent();
    },
    [
      overlayAllowedOrigins,
      setTheme,
      navigate,
      postToHost,
      flushConversationLoadedEvent,
    ],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!isOverlayMessageRequest(data)) return;

      if (data.type === OverlayRequestType.SetOverlayOptions) {
        handleSetOverlayOptions(event.origin, data);
        return;
      }
      if (
        ACTIVE_CONVERSATION_REQUEST_TYPES.has(data.type as OverlayRequestType)
      ) {
        if (!isTrustedHostOrigin(event.origin)) {
          return;
        }
        handleActiveConversationRequest(data);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    handleSetOverlayOptions,
    handleActiveConversationRequest,
    isTrustedHostOrigin,
  ]);

  useEffect(() => clearPendingBridgeRequests, [clearPendingBridgeRequests]);

  useEffect(() => {
    if (hasSentInitReadyRef.current) return;
    hasSentInitReadyRef.current = true;
    postBootstrapEvent(OverlayEventType.InitReady);
  }, [postBootstrapEvent]);

  useEffect(() => {
    if (authStatus === AuthStatus.Loading) return;
    if (hasSentReadyRef.current) return;
    hasSentReadyRef.current = true;
    postBootstrapEvent(OverlayEventType.Ready);
  }, [authStatus, postBootstrapEvent]);

  const clearPendingModelId = useCallback(() => {
    setPendingModelId(null);
  }, []);

  const notifyConversationLoaded = useCallback(() => {
    hasPendingConversationLoadedEventRef.current = true;
    flushConversationLoadedEvent();
  }, [flushConversationLoadedEvent]);

  const notifyConversationsUpdated = useCallback(() => {
    postToHost({ type: OverlayEventType.ConversationsUpdated });
  }, [postToHost]);

  const notifyGenerationStart = useCallback(() => {
    postToHost({ type: OverlayEventType.GptStartGenerating });
  }, [postToHost]);

  const notifyGenerationEnd = useCallback(() => {
    postToHost({ type: OverlayEventType.GptEndGenerating });
  }, [postToHost]);

  const notifyStopGenerating = useCallback(() => {
    postToHost({ type: OverlayEventType.StopGenerating });
  }, [postToHost]);

  const value = useMemo<OverlayContextType>(
    () => ({
      registerActiveConversationBridge,
      pendingModelId,
      clearPendingModelId,
      notifyConversationLoaded,
      notifyConversationsUpdated,
      notifyGenerationStart,
      notifyGenerationEnd,
      notifyStopGenerating,
    }),
    [
      registerActiveConversationBridge,
      pendingModelId,
      clearPendingModelId,
      notifyConversationLoaded,
      notifyConversationsUpdated,
      notifyGenerationStart,
      notifyGenerationEnd,
      notifyStopGenerating,
    ],
  );

  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
};

/** Returns the overlay context. Throws when used outside `OverlayProvider`. */
export const useOverlay = (): OverlayContextType => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
};

/**
 * Returns the overlay context, or `undefined` outside `OverlayProvider`.
 * Use this in components rendered in both overlay and non-overlay mode
 * (e.g. `RequireAuth`, `ConversationPage`) to branch behavior without
 * throwing.
 */
export const useOptionalOverlay = (): OverlayContextType | undefined =>
  useContext(OverlayContext);

/**
 * Mounts `OverlayProvider` around `children` only when overlay mode is
 * eligible (config flag on and the app is framed); otherwise renders
 * `children` directly with no listener attached.
 */
export const OverlayModeGate: FC<{ children: ReactNode }> = ({ children }) => {
  const {
    config: { overlayEnabled },
  } = useAppConfig();

  if (!isOverlayModeEligible(overlayEnabled)) {
    return children;
  }

  return <OverlayProvider>{children}</OverlayProvider>;
};
