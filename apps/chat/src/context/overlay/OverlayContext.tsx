import {
  type CreateConversationPayload,
  type CreateConversationResponse,
  type DeleteConversationPayload,
  type DeleteConversationResponse,
  type GetConversationsResponse,
  type GetMessagesResponse,
  type GetSelectedConversationsResponse,
  type OverlayConversation,
  type OverlayMessageEvent,
  type OverlayMessageRequest,
  type OverlayMessageResponse,
  OverlayEventType,
  OverlayRequestType,
  type RenameConversationPayload,
  type RenameConversationResponse,
  type SelectConversationPayload,
  type SelectConversationResponse,
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
  MutableRefObject,
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
import { conversationIdsMatch } from '../../utils/conversation-id-match';
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

/**
 * Read/write surface over the current user's conversation list, backed by
 * `ConversationsContext`/`DeploymentsContext`/navigation. Registered/
 * unregistered by the conversation-list bridge hook via
 * `registerConversationListBridge`.
 */
export interface ConversationListBridge {
  /** Returns the current user's conversation list. */
  getConversations: () => OverlayConversation[];
  /** Creates a new conversation, persisting immediately if `firstMessage` is given. */
  createConversation: (options: {
    deploymentId?: string;
    firstMessage?: string;
  }) => Promise<CreateConversationResponse>;
  /** Deletes the conversation matching `id`. */
  deleteConversation: (id: string) => Promise<DeleteConversationResponse>;
  /** Renames the conversation matching `id` to `newName`. */
  renameConversation: (
    id: string,
    newName: string,
  ) => Promise<RenameConversationResponse>;
  /** Navigates to the conversation matching `id`. */
  selectConversation: (id: string) => Promise<SelectConversationResponse>;
}

/** Public API exposed by `OverlayProvider` via `useOverlay`/`useOptionalOverlay`. */
export interface OverlayContextType {
  /**
   * Registers (or, with `null`, unregisters) the bridge backing
   * active-conversation requests, along with the id of the conversation it
   * backs (`null` when no conversation is mounted, e.g. the composer route).
   */
  registerActiveConversationBridge: (
    bridge: ActiveConversationBridge | null,
    conversationId: string | null,
  ) => void;
  /** Registers (or, with `null`, unregisters) the bridge backing conversation-list requests. */
  registerConversationListBridge: (
    bridge: ConversationListBridge | null,
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

const CONVERSATION_LIST_REQUEST_TYPES: ReadonlySet<OverlayRequestType> =
  new Set([
    OverlayRequestType.GetConversations,
    OverlayRequestType.GetSelectedConversations,
    OverlayRequestType.SelectConversation,
    OverlayRequestType.CreateConversation,
    OverlayRequestType.CreateLocalConversation,
    OverlayRequestType.DeleteConversation,
    OverlayRequestType.RenameConversation,
  ]);

const DEFAULT_PENDING_BRIDGE_REQUEST_TIMEOUT_MS = 10000;

interface PendingBridgeRequest {
  request: OverlayMessageRequest;
  timeoutId: number;
}

interface PendingConversationSelection {
  requestId: string;
  requestType: OverlayRequestType;
  targetId: string;
  timeoutId: number;
}

const getRequestExpiresAt = (request: OverlayMessageRequest): number =>
  typeof request.expiresAt === 'number'
    ? request.expiresAt
    : Date.now() + DEFAULT_PENDING_BRIDGE_REQUEST_TIMEOUT_MS;

const isRequestExpired = (request: OverlayMessageRequest): boolean =>
  typeof request.expiresAt === 'number' && request.expiresAt <= Date.now();

/** Queues `request` on `requestsRef` until `getRequestExpiresAt` passes, then drops it. */
const queuePendingRequest = (
  requestsRef: MutableRefObject<PendingBridgeRequest[]>,
  request: OverlayMessageRequest,
): void => {
  const expiresAt = getRequestExpiresAt(request);
  const delayMs = expiresAt - Date.now();
  if (delayMs <= 0) {
    return;
  }

  requestsRef.current = requestsRef.current.filter((pending) => {
    if (pending.request.requestId !== request.requestId) {
      return true;
    }
    window.clearTimeout(pending.timeoutId);
    return false;
  });

  const timeoutId = window.setTimeout(() => {
    requestsRef.current = requestsRef.current.filter(
      (pending) => pending.request.requestId !== request.requestId,
    );
  }, delayMs);

  requestsRef.current.push({ request, timeoutId });
};

/** Clears every queued request on `requestsRef` and their timeouts. */
const clearPendingRequests = (
  requestsRef: MutableRefObject<PendingBridgeRequest[]>,
): void => {
  requestsRef.current.forEach(({ timeoutId }) => {
    window.clearTimeout(timeoutId);
  });
  requestsRef.current = [];
};

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

const hasSelectConversationPayload = (
  payload: unknown,
): payload is SelectConversationPayload => hasStringPayload(payload, 'id');

const hasDeleteConversationPayload = (
  payload: unknown,
): payload is DeleteConversationPayload => hasStringPayload(payload, 'id');

const hasRenameConversationPayload = (
  payload: unknown,
): payload is RenameConversationPayload =>
  hasStringPayload(payload, 'id') && hasStringPayload(payload, 'newName');

const hasCreateConversationPayload = (
  payload: unknown,
): payload is Partial<CreateConversationPayload> | null | undefined => {
  if (payload == null) {
    return true;
  }
  if (!isRecord(payload)) {
    return false;
  }
  return (
    (!('deploymentId' in payload) ||
      payload.deploymentId == null ||
      typeof payload.deploymentId === 'string') &&
    (!('firstMessage' in payload) ||
      payload.firstMessage == null ||
      typeof payload.firstMessage === 'string')
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
  const currentConversationIdRef = useRef<string | null>(null);
  const conversationListBridgeRef = useRef<ConversationListBridge | null>(null);
  const pendingBridgeRequestsRef = useRef<PendingBridgeRequest[]>([]);
  const pendingConversationListRequestsRef = useRef<PendingBridgeRequest[]>([]);
  const pendingConversationSelectionsRef = useRef<
    PendingConversationSelection[]
  >([]);
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

  const clearAllPendingRequests = useCallback(() => {
    clearPendingRequests(pendingBridgeRequestsRef);
    clearPendingRequests(pendingConversationListRequestsRef);
    pendingConversationSelectionsRef.current.forEach(({ timeoutId }) => {
      window.clearTimeout(timeoutId);
    });
    pendingConversationSelectionsRef.current = [];
  }, []);

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
        queuePendingRequest(pendingBridgeRequestsRef, request);
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
    [executeAgainstBridge, postToHost],
  );

  const buildSelectedConversationProjection =
    useCallback((): OverlayConversation | null => {
      const id = currentConversationIdRef.current;
      if (!id) {
        return null;
      }
      const fromSnapshot = conversationListBridgeRef.current
        ?.getConversations()
        .find((conversation) => conversationIdsMatch(conversation.id, id));
      if (fromSnapshot) {
        return fromSnapshot;
      }
      /*
       * The active bridge only carries an id (task 5.1), not a title, so a
       * conversation created moments ago (not yet reflected in the
       * conversation-list bridge's snapshot) is reported with an empty
       * title rather than omitted entirely.
       */
      return {
        id,
        title: '',
        updatedAt: Date.now(),
        isPinned: false,
        isReadonly: false,
        sharedWithMe: false,
        publishedWithMe: false,
      };
    }, []);

  const resolvePendingConversationSelections = useCallback(
    (conversationId: string) => {
      if (pendingConversationSelectionsRef.current.length === 0) {
        return;
      }
      const matches = pendingConversationSelectionsRef.current.filter(
        (pending) => conversationIdsMatch(pending.targetId, conversationId),
      );
      if (matches.length === 0) {
        return;
      }
      pendingConversationSelectionsRef.current =
        pendingConversationSelectionsRef.current.filter(
          (pending) => !conversationIdsMatch(pending.targetId, conversationId),
        );
      const conversation = buildSelectedConversationProjection();
      matches.forEach(({ requestType, requestId, timeoutId }) => {
        window.clearTimeout(timeoutId);
        const responsePayload: SelectConversationResponse = {
          conversation: conversation ?? undefined,
        };
        postToHost({
          type: `${requestType}/RESPONSE`,
          requestId,
          payload: responsePayload,
        });
      });
    },
    [buildSelectedConversationProjection, postToHost],
  );

  const registerActiveConversationBridge = useCallback(
    (
      bridge: ActiveConversationBridge | null,
      conversationId: string | null,
    ) => {
      activeBridgeRef.current = bridge;
      currentConversationIdRef.current = conversationId;
      if (bridge && pendingBridgeRequestsRef.current.length > 0) {
        const pending = pendingBridgeRequestsRef.current;
        pendingBridgeRequestsRef.current = [];
        pending.forEach(({ request, timeoutId }) => {
          window.clearTimeout(timeoutId);
          handleActiveConversationRequest(request);
        });
      }
      if (conversationId) {
        resolvePendingConversationSelections(conversationId);
      }
    },
    [handleActiveConversationRequest, resolvePendingConversationSelections],
  );

  const queueConversationSelectionWait = useCallback(
    (
      targetId: string,
      requestType: OverlayRequestType,
      request: OverlayMessageRequest,
    ) => {
      const expiresAt = getRequestExpiresAt(request);
      const delayMs = expiresAt - Date.now();
      if (delayMs <= 0) {
        return;
      }
      const timeoutId = window.setTimeout(() => {
        pendingConversationSelectionsRef.current =
          pendingConversationSelectionsRef.current.filter(
            (pending) => pending.requestId !== request.requestId,
          );
      }, delayMs);
      pendingConversationSelectionsRef.current.push({
        requestId: request.requestId,
        requestType,
        targetId,
        timeoutId,
      });
    },
    [],
  );

  const executeAgainstConversationListBridge = useCallback(
    (
      bridge: ConversationListBridge,
      type: OverlayRequestType,
      payload: unknown,
    ): Promise<unknown> | null => {
      switch (type) {
        case OverlayRequestType.GetConversations: {
          const responsePayload: GetConversationsResponse = {
            conversations: bridge.getConversations(),
          };
          return Promise.resolve(responsePayload);
        }
        case OverlayRequestType.CreateConversation: {
          if (!hasCreateConversationPayload(payload)) {
            return null;
          }
          return bridge.createConversation({
            deploymentId: payload?.deploymentId,
            firstMessage: payload?.firstMessage,
          });
        }
        case OverlayRequestType.CreateLocalConversation:
          return bridge.createConversation({});
        case OverlayRequestType.DeleteConversation:
          if (!hasDeleteConversationPayload(payload)) {
            return null;
          }
          return bridge.deleteConversation(payload.id);
        case OverlayRequestType.RenameConversation:
          if (!hasRenameConversationPayload(payload)) {
            return null;
          }
          return bridge.renameConversation(payload.id, payload.newName);
        default:
          return Promise.resolve(undefined);
      }
    },
    [],
  );

  const handleConversationListRequest = useCallback(
    (request: OverlayMessageRequest) => {
      if (isRequestExpired(request)) {
        return;
      }
      const requestType = request.type as OverlayRequestType;

      if (requestType === OverlayRequestType.GetSelectedConversations) {
        const conversation = buildSelectedConversationProjection();
        const responsePayload: GetSelectedConversationsResponse = {
          conversations: conversation ? [conversation] : [],
        };
        postToHost({
          type: `${requestType}/RESPONSE`,
          requestId: request.requestId,
          payload: responsePayload,
        });
        return;
      }

      if (requestType === OverlayRequestType.SelectConversation) {
        if (!hasSelectConversationPayload(request.payload)) {
          logOverlayWarning(`rejected malformed ${requestType} payload`);
          return;
        }
        const bridge = conversationListBridgeRef.current;
        if (!bridge) {
          queuePendingRequest(pendingConversationListRequestsRef, request);
          return;
        }
        const { id } = request.payload;
        void bridge.selectConversation(id).catch((error) => {
          logOverlayWarning(`failed to execute ${requestType}`, error);
        });
        queueConversationSelectionWait(id, requestType, request);
        return;
      }

      const bridge = conversationListBridgeRef.current;
      if (!bridge) {
        queuePendingRequest(pendingConversationListRequestsRef, request);
        return;
      }
      let responsePromise: Promise<unknown> | null = null;
      try {
        responsePromise = executeAgainstConversationListBridge(
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
    [
      buildSelectedConversationProjection,
      executeAgainstConversationListBridge,
      postToHost,
      queueConversationSelectionWait,
    ],
  );

  const registerConversationListBridge = useCallback(
    (bridge: ConversationListBridge | null) => {
      conversationListBridgeRef.current = bridge;
      if (bridge && pendingConversationListRequestsRef.current.length > 0) {
        const pending = pendingConversationListRequestsRef.current;
        pendingConversationListRequestsRef.current = [];
        pending.forEach(({ request, timeoutId }) => {
          window.clearTimeout(timeoutId);
          handleConversationListRequest(request);
        });
      }
    },
    [handleConversationListRequest],
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
        return;
      }
      if (
        CONVERSATION_LIST_REQUEST_TYPES.has(data.type as OverlayRequestType)
      ) {
        if (!isTrustedHostOrigin(event.origin)) {
          return;
        }
        handleConversationListRequest(data);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    handleSetOverlayOptions,
    handleActiveConversationRequest,
    handleConversationListRequest,
    isTrustedHostOrigin,
  ]);

  useEffect(() => clearAllPendingRequests, [clearAllPendingRequests]);

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
      registerConversationListBridge,
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
      registerConversationListBridge,
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
