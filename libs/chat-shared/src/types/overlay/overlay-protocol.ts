/**
 * Namespace prefix shared by every `@DIAL_OVERLAY` postMessage type string
 * exchanged between a `ChatOverlay`/`ChatOverlayManager` host page and an
 * embedded chat app instance.
 */
export const DIAL_OVERLAY_NAMESPACE = '@DIAL_OVERLAY';

/**
 * Request message types the host (library) can send to the embedded app.
 * Each value is the full wire `type` string sent over `postMessage`.
 */
export enum OverlayRequestType {
  /** Fetch the active conversation's messages. */
  GetMessages = '@DIAL_OVERLAY/GET_MESSAGES',
  /** Send a new message in the active conversation. */
  SendMessage = '@DIAL_OVERLAY/SEND_MESSAGE',
  /** Set the current text content of the message input. */
  SetInputContent = '@DIAL_OVERLAY/SET_INPUT_CONTENT',
  /** Set the active conversation's system prompt. */
  SetSystemPrompt = '@DIAL_OVERLAY/SET_SYSTEM_PROMPT',
  /** Set the active conversation's temperature. */
  SetTemperature = '@DIAL_OVERLAY/SET_TEMPERATURE',
  /** Set host-provided options (theme, model, conversation, host domain). */
  SetOverlayOptions = '@DIAL_OVERLAY/SET_OVERLAY_OPTIONS',
}

/**
 * Event message types the embedded app can send to the host (library),
 * without an accompanying request. Each value is the full wire `type`
 * string sent over `postMessage`.
 */
export enum OverlayEventType {
  /** Sent once, immediately, before any host identity is known. */
  InitReady = '@DIAL_OVERLAY/INIT_READY',
  /** Sent once, after auth/model-load state resolves. */
  Ready = '@DIAL_OVERLAY/READY',
  /** Sent once, after the active conversation has been selected/loaded for the first time. */
  ReadyToInteract = '@DIAL_OVERLAY/READY_TO_INTERACT',
  /** Sent whenever the app finishes loading a conversation (initial load or navigation). */
  SelectedConversationLoaded = '@DIAL_OVERLAY/SELECTED_CONVERSATION_LOADED',
  /** Sent when a generation starts for the active conversation. */
  GptStartGenerating = '@DIAL_OVERLAY/GPT_START_GENERATING',
  /** Sent when a generation completes for the active conversation. */
  GptEndGenerating = '@DIAL_OVERLAY/GPT_END_GENERATING',
  /** Sent when a user (or host) stops an in-flight generation. */
  StopGenerating = '@DIAL_OVERLAY/STOP_GENERATING',
  /** Sent whenever the app's conversation list changes. */
  ConversationsUpdated = '@DIAL_OVERLAY/CONVERSATIONS_UPDATED',
}

/**
 * Optional embed-time features a host can opt into via
 * `ChatOverlayOptions.enabledFeatures`.
 */
export enum OverlayFeature {
  /** Enables the `microphone` permission on the iframe's `allow` attribute for voice input. */
  VoiceInput = 'voice-input',
}

/**
 * Minimal message shape carried in overlay protocol payloads. A narrowed
 * projection of the app's full message model, kept local to this module so
 * the overlay protocol has no dependency on `libs/chat-shared`'s domain models.
 */
export interface OverlayChatMessage {
  /** Message id. */
  id: string;
  /** Author role, e.g. `'user'`, `'assistant'`, or `'system'`. */
  role: string;
  /** Message text content. */
  content: string;
}

/**
 * Options a host page passes to `ChatOverlay`'s constructor, and the subset
 * of them re-sent to the embedded app via `SET_OVERLAY_OPTIONS`.
 */
export interface ChatOverlayOptions {
  /** Full URL of the chat app instance to embed (origin + optional path). */
  domain: string;
  /** Milliseconds to wait for a request's response before rejecting. Defaults to `10000`. */
  requestTimeout?: number;
  /** Inline CSS properties applied to the loader element while it is visible. */
  loaderStyles?: Record<string, string>;
  /** CSS class applied to the loader element. */
  loaderClass?: string;
  /** Custom HTML rendered inside the loader element, replacing the default spinner. */
  loaderInnerHTML?: string;
  /** Event whose receipt hides the loader. Defaults to `OverlayEventType.Ready`. */
  loaderHideEvent?: OverlayEventType;
  /** Embed-time features to enable, e.g. microphone access for voice input. */
  enabledFeatures?: OverlayFeature[];
  /** Theme name applied to the embedded app. */
  theme?: string;
  /** Deployment/model id to select in the embedded app. */
  modelId?: string;
  /** Conversation id the embedded app should load and display. */
  overlayConversationId?: string;
}

/** Payload of a `SET_OVERLAY_OPTIONS` request. */
export interface SetOverlayOptionsPayload {
  /** Origin of the host page, used by the app to target responses/events. */
  hostDomain: string;
  /** Theme name to apply, if provided. */
  theme?: string;
  /** Deployment/model id to select, if provided. */
  modelId?: string;
  /** Conversation id to navigate to and load, if provided. */
  overlayConversationId?: string;
}

/** Payload of a `SEND_MESSAGE` request. */
export interface SendMessagePayload {
  /** Text content of the message to send. */
  content: string;
}

/** Payload of a `SET_INPUT_CONTENT` request. */
export interface SetInputContentPayload {
  /** Text content to set in the message input. */
  content: string;
}

/** Payload of a `SET_SYSTEM_PROMPT` request. */
export interface SetSystemPromptPayload {
  /** System prompt to persist on the active conversation. */
  systemPrompt: string;
}

/** Payload of a `SET_TEMPERATURE` request. */
export interface SetTemperaturePayload {
  /** Temperature value to persist on the active conversation. */
  temperature: number;
}

/** Response payload of a `GET_MESSAGES` request. */
export interface GetMessagesResponse {
  /** Messages in the active conversation. */
  messages: OverlayChatMessage[];
}

/** Response payload of a `SEND_MESSAGE` request. */
export interface SendMessageResponse {
  /** Messages in the active conversation after the send. */
  messages: OverlayChatMessage[];
}

/** Response payload of a `SET_SYSTEM_PROMPT` request. */
export interface SetSystemPromptResponse {
  /** System prompt value that was persisted. */
  systemPrompt: string;
}

/** Response payload of a `SET_TEMPERATURE` request. */
export interface SetTemperatureResponse {
  /** Temperature value that was persisted. */
  temperature: number;
}

/** Response payload of a `SET_OVERLAY_OPTIONS` request. */
export interface SetOverlayOptionsResponse {
  /** Whether the supplied options were applied (`false` only signals a fallback, never a thrown error). */
  applied: boolean;
}

/**
 * A request message sent from the host (library) to the embedded app.
 * `type` is always `'${OverlayRequestType}'`.
 */
export interface OverlayMessageRequest<TPayload = unknown> {
  /** Full wire type string, one of the `OverlayRequestType` values. */
  type: `${OverlayRequestType}`;
  /** Unique id used to match this request to its response. */
  requestId: string;
  /**
   * Epoch milliseconds after which the embedded app must stop waiting for
   * prerequisites (such as an active conversation bridge) and drop the request.
   */
  expiresAt?: number;
  /** Request-specific payload. */
  payload?: TPayload;
}

/**
 * A response message sent from the embedded app to the host (library),
 * answering a specific request by `requestId`.
 */
export interface OverlayMessageResponse<TPayload = unknown> {
  /** Full wire type string, always `'${OverlayRequestType}/RESPONSE'`. */
  type: `${OverlayRequestType}/RESPONSE`;
  /** `requestId` of the request this message answers. */
  requestId: string;
  /** Response-specific payload. */
  payload?: TPayload;
}

/**
 * An event message sent from the embedded app to the host (library),
 * with no associated request (no `requestId` field).
 */
export interface OverlayMessageEvent<TPayload = unknown> {
  /** Full wire type string, one of the `OverlayEventType` values. */
  type: `${OverlayEventType}`;
  /** Event-specific payload. */
  payload?: TPayload;
}

/** Narrows an arbitrary value to a well-formed `OverlayMessageRequest`. */
export const isOverlayMessageRequest = (
  data: unknown,
): data is OverlayMessageRequest => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    (Object.values(OverlayRequestType) as string[]).includes(candidate.type) &&
    typeof candidate.requestId === 'string' &&
    (!('expiresAt' in candidate) ||
      (typeof candidate.expiresAt === 'number' &&
        Number.isFinite(candidate.expiresAt)))
  );
};

/** Narrows an arbitrary value to a well-formed `OverlayMessageResponse`. */
export const isOverlayMessageResponse = (
  data: unknown,
): data is OverlayMessageResponse => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  if (
    typeof candidate.type !== 'string' ||
    typeof candidate.requestId !== 'string'
  ) {
    return false;
  }
  return (Object.values(OverlayRequestType) as string[]).some(
    (requestType) => candidate.type === `${requestType}/RESPONSE`,
  );
};

/** Narrows an arbitrary value to a well-formed `OverlayMessageEvent`. */
export const isOverlayMessageEvent = (
  data: unknown,
): data is OverlayMessageEvent => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    (Object.values(OverlayEventType) as string[]).includes(candidate.type) &&
    !('requestId' in candidate)
  );
};
