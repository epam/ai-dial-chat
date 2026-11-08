import {
  type GetSelectedConversationsResponse,
  type OverlayConversation,
  type OverlayMessageEvent,
  type OverlayMessageRequest,
  type OverlayMessageResponse,
  OverlayEventType,
  OverlayFeature,
  OverlayRequestErrorCode,
  OverlayRequestType,
  type SelectConversationResponse,
  type SetOverlayOptionsResponse,
  isOverlayMessageRequest,
} from '@epam/ai-dial-chat-overlay';
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
import { useNavigate } from 'react-router';
import { getConversationRoute } from '../../constants/routes';
import { AuthStatus } from '../../types/auth-status';
import { UserConfigStatus } from '../../types/user-config-status';
import { conversationIdsMatch } from '../../utils/conversation-id-match';
import { matchesAllowedOrigin } from '../../utils/overlay-origin';
import { useAppConfig } from '../AppConfigContext';
import { useUser } from '../auth/UserContext';
import { useTheme } from '../ThemeContext';
import { useUiFeatures } from '../UiFeaturesContext';
import type {
  ActiveConversationBridge,
  ConversationListBridge,
} from './bridges';
import {
  ACTIVE_CONVERSATION_HANDLERS,
  type BridgeRequestHandler,
  CONVERSATION_LIST_HANDLERS,
} from './handlers/bridge-request-handlers';
import {
  getAuthAutoSignInProvider,
  getAuthProviderUiModes,
  hasSelectConversationPayload,
  hasSetOverlayOptionsPayload,
} from './handlers/payload-guards';
import {
  clearPendingRequests,
  getRequestExpiresAt,
  isRequestExpired,
  type PendingBridgeRequest,
  queuePendingRequest,
} from './handlers/pending-requests';
import {
  getOverlayRequestRoute,
  OverlayRequestRoute,
  type OverlayRequestTypeRoutedTo,
} from './handlers/request-routes';

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
  /**
   * The most recent deployment id the host sent via `SET_OVERLAY_OPTIONS`.
   * Unlike `pendingModelId` it is never cleared, so it keeps serving as the
   * overlay's default for every new chat in the session, not just the first.
   */
  modelId: string | null;
  /** Trusted per-provider authentication UI modes received from the host. */
  authProviderUiModes: Record<string, string> | undefined;
  /** Trusted provider id the host asked to sign in with automatically. */
  authAutoSignInProvider: string | undefined;
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

const KNOWN_OVERLAY_FEATURES = new Set<string>(Object.values(OverlayFeature));

type ActiveConversationRequestType =
  OverlayRequestTypeRoutedTo<OverlayRequestRoute.ActiveConversation>;

type ConversationListRequestType =
  OverlayRequestTypeRoutedTo<OverlayRequestRoute.ConversationList>;

interface PendingConversationSelection {
  requestId: string;
  requestType: OverlayRequestType;
  targetId: string;
  timeoutId: number;
}

const logOverlayWarning = (message: string, error?: unknown): void => {
  if (error) {
    console.warn(`Overlay: ${message}`, error);
    return;
  }
  console.warn(`Overlay: ${message}`);
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : String(error);

const logUnknownEnabledFeatures = (features: readonly string[]): void => {
  const warnedFeatures = new Set<string>();
  features.forEach((feature) => {
    if (KNOWN_OVERLAY_FEATURES.has(feature) || warnedFeatures.has(feature)) {
      return;
    }
    warnedFeatures.add(feature);
    logOverlayWarning(`ignored unknown enabledFeatures entry: "${feature}"`);
  });
};

/**
 * Detects whether overlay mode is reachable: the runtime config flag is on
 * and the app is actually framed. Does not validate the framing origin —
 * that happens server-side (CSP `frame-ancestors`) and again on the
 * `SET_OVERLAY_OPTIONS` handshake message.
 */
const isWindowFramed = (): boolean =>
  typeof window !== 'undefined' && window.self !== window.top;

export const isOverlayModeEligible = (overlayEnabled: boolean): boolean =>
  overlayEnabled && isWindowFramed();

export const shouldDeferOverlayModeUntilConfigReady = (
  status: UserConfigStatus,
  isFramed = isWindowFramed(),
): boolean => status === UserConfigStatus.Loading && isFramed;

/**
 * Owns overlay-mode state: the `window` `message` listener, the handshake
 * state machine, the validated `hostDomain`, and the active-conversation
 * bridge registry. Mounted only when overlay mode is eligible (see
 * `OverlayModeGate`) — never attaches a listener otherwise. Request routing
 * and per-request bridge calls live in `./handlers`.
 */
export const OverlayProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const {
    config: { overlayAllowedOrigins },
  } = useAppConfig();
  const { status: authStatus } = useUser();
  const { setTheme } = useTheme();
  const { applyOverlayOverride } = useUiFeatures();
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
  const [modelId, setModelId] = useState<string | null>(null);
  const [authProviderUiModes, setAuthProviderUiModes] = useState<
    Record<string, string> | undefined
  >();
  const [authAutoSignInProvider, setAuthAutoSignInProvider] = useState<
    string | undefined
  >();

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

  const postRequestError = useCallback(
    (
      request: OverlayMessageRequest,
      code: OverlayRequestErrorCode,
      message: string,
      cause?: unknown,
    ) => {
      logOverlayWarning(`${request.type} failed [${code}]: ${message}`, cause);
      postToHost({
        type: `${request.type}/RESPONSE`,
        requestId: request.requestId,
        error: { code, message },
      });
    },
    [postToHost],
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
      matchesAllowedOrigin(origin, overlayAllowedOrigins),
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

  /*
   * Runs a bridge handler and posts its result, or a structured error when the
   * payload breaks the contract, the handler throws, or its promise rejects.
   */
  const respondFromBridge = useCallback(
    <TBridge,>(
      request: OverlayMessageRequest,
      bridge: TBridge,
      handler: BridgeRequestHandler<TBridge>,
    ) => {
      let responsePromise: Promise<unknown> | null = null;
      try {
        responsePromise = handler(bridge, request.payload);
      } catch (error) {
        postRequestError(
          request,
          OverlayRequestErrorCode.RequestExecutionFailed,
          getErrorMessage(error),
          error,
        );
        return;
      }
      if (!responsePromise) {
        postRequestError(
          request,
          OverlayRequestErrorCode.InvalidPayload,
          `The request payload does not match the ${request.type} contract.`,
        );
        return;
      }
      void responsePromise
        .then((responsePayload) => {
          postToHost({
            type: `${request.type}/RESPONSE`,
            requestId: request.requestId,
            payload: responsePayload,
          });
        })
        .catch((error) => {
          postRequestError(
            request,
            OverlayRequestErrorCode.RequestExecutionFailed,
            getErrorMessage(error),
            error,
          );
        });
    },
    [postRequestError, postToHost],
  );

  const handleActiveConversationRequest = useCallback(
    (request: OverlayMessageRequest) => {
      if (isRequestExpired(request)) {
        return;
      }
      const bridge = activeBridgeRef.current;
      if (!bridge) {
        if (hasEmittedReadyToInteractRef.current) {
          postRequestError(
            request,
            OverlayRequestErrorCode.ActiveConversationUnavailable,
            'No active conversation is open. Open or create a conversation before calling this method.',
          );
          return;
        }
        queuePendingRequest(pendingBridgeRequestsRef, request);
        return;
      }
      respondFromBridge(
        request,
        bridge,
        ACTIVE_CONVERSATION_HANDLERS[
          request.type as ActiveConversationRequestType
        ],
      );
    },
    [postRequestError, respondFromBridge],
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

  const handleConversationListRequest = useCallback(
    (request: OverlayMessageRequest) => {
      if (isRequestExpired(request)) {
        return;
      }
      const requestType = request.type as OverlayRequestType;
      const route = getOverlayRequestRoute(requestType);

      if (route === OverlayRequestRoute.SelectedConversations) {
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

      if (route === OverlayRequestRoute.ConversationSelection) {
        if (!hasSelectConversationPayload(request.payload)) {
          postRequestError(
            request,
            OverlayRequestErrorCode.InvalidPayload,
            `The request payload does not match the ${requestType} contract.`,
          );
          return;
        }
        const bridge = conversationListBridgeRef.current;
        if (!bridge) {
          if (hasEmittedReadyToInteractRef.current) {
            postRequestError(
              request,
              OverlayRequestErrorCode.ConversationListUnavailable,
              'The conversation list is not available yet.',
            );
            return;
          }
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
        if (hasEmittedReadyToInteractRef.current) {
          postRequestError(
            request,
            OverlayRequestErrorCode.ConversationListUnavailable,
            'The conversation list is not available yet.',
          );
          return;
        }
        queuePendingRequest(pendingConversationListRequestsRef, request);
        return;
      }
      respondFromBridge(
        request,
        bridge,
        CONVERSATION_LIST_HANDLERS[requestType as ConversationListRequestType],
      );
    },
    [
      buildSelectedConversationProjection,
      postRequestError,
      postToHost,
      queueConversationSelectionWait,
      respondFromBridge,
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
      if (!matchesAllowedOrigin(origin, overlayAllowedOrigins)) {
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
        setModelId(payload.modelId);
        setPendingModelId(payload.modelId);
      }
      if (payload?.overlayConversationId) {
        navigate(getConversationRoute(payload.overlayConversationId));
      }
      if (payload?.enabledFeatures !== undefined) {
        const enabledFeatures = payload.enabledFeatures;
        if (enabledFeatures != null) {
          logUnknownEnabledFeatures(enabledFeatures);
        }
        applyOverlayOverride(enabledFeatures);
      }
      setAuthProviderUiModes(getAuthProviderUiModes(payload));
      setAuthAutoSignInProvider(getAuthAutoSignInProvider(payload));

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
      applyOverlayOverride,
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

      const route = getOverlayRequestRoute(data.type);
      if (route === OverlayRequestRoute.HostOptions) {
        handleSetOverlayOptions(event.origin, data);
        return;
      }
      if (!isTrustedHostOrigin(event.origin)) {
        return;
      }
      if (route === OverlayRequestRoute.ActiveConversation) {
        handleActiveConversationRequest(data);
        return;
      }
      handleConversationListRequest(data);
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
      modelId,
      authProviderUiModes,
      authAutoSignInProvider,
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
      modelId,
      authProviderUiModes,
      authAutoSignInProvider,
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
    status,
    config: { overlayEnabled },
  } = useAppConfig();

  if (shouldDeferOverlayModeUntilConfigReady(status)) {
    return null;
  }

  if (!isOverlayModeEligible(overlayEnabled)) {
    return children;
  }

  return <OverlayProvider>{children}</OverlayProvider>;
};
