import {
  type ChatOverlayOptions,
  type CreateConversationPayload,
  type CreateConversationResponse,
  type CreateLocalConversationResponse,
  type DeleteConversationPayload,
  type DeleteConversationResponse,
  type GetConversationsResponse,
  type GetMessagesResponse,
  type GetSelectedConversationsResponse,
  type OverlayMessageEvent,
  type OverlayMessageRequest,
  type OverlayMessageResponse,
  type OverlayRequestError,
  OverlayEventType,
  OverlayFeature,
  OverlayRequestType,
  type RenameConversationPayload,
  type RenameConversationResponse,
  type SelectConversationPayload,
  type SelectConversationResponse,
  type SendMessagePayload,
  type SendMessageResponse,
  type SetInputContentPayload,
  type SetOverlayOptionsPayload,
  type SetOverlayOptionsResponse,
  type SetSystemPromptPayload,
  type SetSystemPromptResponse,
  type SetTemperaturePayload,
  type SetTemperatureResponse,
  isOverlayMessageEvent,
  isOverlayMessageResponse,
} from '@epam/ai-dial-chat-shared';
import { DEFAULT_LOADER_INNER_HTML } from './internal/default-loader';
import { DeferredRequest } from './internal/deferred-request';
import { setStyles } from './internal/dom-styles';
import { Task } from './internal/task';

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const LOADER_ATTRIBUTE = 'data-dial-overlay-loader';

/** Error returned by the embedded chat for a well-formed overlay request. */
export class ChatOverlayRequestError extends Error {
  /** Stable embedded-chat error code. */
  readonly code: OverlayRequestError['code'];
  /** Request type that failed. */
  readonly requestType: string;

  constructor(requestType: string, error: OverlayRequestError) {
    super(
      `ChatOverlay: request "${requestType}" failed [${error.code}]: ${error.message}`,
    );
    this.name = 'ChatOverlayRequestError';
    this.code = error.code;
    this.requestType = requestType;
  }
}

const resolveRoot = (root: HTMLElement | string): HTMLElement => {
  if (typeof root !== 'string') {
    return root;
  }
  const element = document.querySelector<HTMLElement>(root);
  if (!element) {
    throw new Error(`ChatOverlay: no element matches selector "${root}"`);
  }
  return element;
};

const createIframe = (options: ChatOverlayOptions): HTMLIFrameElement => {
  const iframe = document.createElement('iframe');
  iframe.src = options.domain;
  iframe.name = 'overlay';
  iframe.setAttribute('aria-label', 'DIAL Chat');
  iframe.setAttribute(
    'sandbox',
    'allow-same-origin allow-scripts allow-modals allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox',
  );
  const allowedPermissions = ['clipboard-write'];
  if (options.enabledFeatures?.includes(OverlayFeature.VoiceInput)) {
    allowedPermissions.push('microphone');
  }
  iframe.setAttribute('allow', allowedPermissions.join('; '));
  setStyles(iframe, {
    border: 'none',
    display: 'block',
    width: '100%',
    height: '100%',
  });
  return iframe;
};

const createLoader = (options: ChatOverlayOptions): HTMLElement => {
  const loader = document.createElement('div');
  loader.setAttribute(LOADER_ATTRIBUTE, '');
  loader.innerHTML = options.loaderInnerHTML ?? DEFAULT_LOADER_INNER_HTML;
  setStyles(loader, {
    position: 'absolute',
    inset: '0',
    zIndex: '2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#2764d9',
  });
  if (options.loaderClass) {
    loader.className = options.loaderClass;
  }
  if (options.loaderStyles) {
    setStyles(loader, options.loaderStyles);
  }
  return loader;
};

/**
 * A single embedded DIAL Chat iframe controlled over the `@DIAL_OVERLAY`
 * `postMessage` protocol. Construct with a root element (or selector) and
 * `ChatOverlayOptions`; call `ready()` before issuing chat requests.
 */
export class ChatOverlay {
  private readonly root: HTMLElement;
  private readonly iframe: HTMLIFrameElement;
  private readonly loader: HTMLElement;
  private readonly options: ChatOverlayOptions;
  private readonly targetOrigin: string;
  private readonly readyGate = new Task<boolean>();
  private readonly pendingRequests = new Map<
    string,
    DeferredRequest<unknown>
  >();
  private readonly eventSubscribers = new Map<
    OverlayEventType,
    Set<(payload: unknown) => void>
  >();
  private readonly messageListener = (event: MessageEvent): void => {
    this.handleMessage(event);
  };
  private isDestroyed = false;

  constructor(root: HTMLElement | string, options: ChatOverlayOptions) {
    this.root = resolveRoot(root);
    this.options = { ...options };
    this.targetOrigin = new URL(options.domain).origin;
    this.iframe = createIframe(this.options);
    this.loader = createLoader(this.options);
    const rootPosition = window.getComputedStyle(this.root).position;
    if (rootPosition === 'static' || rootPosition === '') {
      setStyles(this.root, { position: 'relative' });
    }
    this.root.appendChild(this.loader);
    this.root.appendChild(this.iframe);
    window.addEventListener('message', this.messageListener);
    // Guarantees the gate is always "handled" even if destroy() rejects it
    // before a caller ever calls ready(); callers still observe rejection
    // independently through their own ready().then/.catch.
    this.readyGate.promise.catch(() => undefined);
  }

  /** Resolves once the handshake reaches `READY_TO_INTERACT`. */
  ready(): Promise<boolean> {
    return this.readyGate.promise;
  }

  /** Fetches the active conversation's messages. */
  getMessages(): Promise<GetMessagesResponse> {
    return this.send<GetMessagesResponse>(OverlayRequestType.GetMessages);
  }

  /** Sends a new message in the active conversation. */
  sendMessage(content: string): Promise<SendMessageResponse> {
    const payload: SendMessagePayload = { content };
    return this.send<SendMessageResponse>(
      OverlayRequestType.SendMessage,
      payload,
    );
  }

  /** Sets the current text content of the message input. */
  setInputContent(content: string): Promise<void> {
    const payload: SetInputContentPayload = { content };
    return this.send<void>(OverlayRequestType.SetInputContent, payload);
  }

  /** Sets the active conversation's system prompt. */
  setSystemPrompt(systemPrompt: string): Promise<SetSystemPromptResponse> {
    const payload: SetSystemPromptPayload = { systemPrompt };
    return this.send<SetSystemPromptResponse>(
      OverlayRequestType.SetSystemPrompt,
      payload,
    );
  }

  /** Sets the active conversation's temperature. */
  setTemperature(temperature: number): Promise<SetTemperatureResponse> {
    const payload: SetTemperaturePayload = { temperature };
    return this.send<SetTemperatureResponse>(
      OverlayRequestType.SetTemperature,
      payload,
    );
  }

  /** Fetches the current user's conversation list. */
  getConversations(): Promise<GetConversationsResponse> {
    return this.send<GetConversationsResponse>(
      OverlayRequestType.GetConversations,
    );
  }

  /** Fetches the currently displayed (active) conversation(s). */
  getSelectedConversations(): Promise<GetSelectedConversationsResponse> {
    return this.send<GetSelectedConversationsResponse>(
      OverlayRequestType.GetSelectedConversations,
    );
  }

  /** Navigates to and loads the conversation matching `id`. */
  selectConversation(id: string): Promise<SelectConversationResponse> {
    const payload: SelectConversationPayload = { id };
    return this.send<SelectConversationResponse>(
      OverlayRequestType.SelectConversation,
      payload,
    );
  }

  /**
   * Creates a new conversation. With a non-blank `firstMessage`, persists
   * immediately and returns its projection. Without one, opens the composer
   * and resolves with `{ conversation: null }` — identical to
   * `createLocalConversation()`.
   */
  createConversation(options?: {
    deploymentId?: string;
    firstMessage?: string;
  }): Promise<CreateConversationResponse> {
    const payload: CreateConversationPayload = { ...options };
    return this.send<CreateConversationResponse>(
      OverlayRequestType.CreateConversation,
      payload,
    );
  }

  /** Opens the composer without persisting anything. */
  createLocalConversation(): Promise<CreateLocalConversationResponse> {
    return this.send<CreateLocalConversationResponse>(
      OverlayRequestType.CreateLocalConversation,
    );
  }

  /** Deletes the conversation matching `id`. */
  deleteConversation(id: string): Promise<DeleteConversationResponse> {
    const payload: DeleteConversationPayload = { id };
    return this.send<DeleteConversationResponse>(
      OverlayRequestType.DeleteConversation,
      payload,
    );
  }

  /** Renames the conversation matching `id` to `newName`. */
  renameConversation(
    id: string,
    newName: string,
  ): Promise<RenameConversationResponse> {
    const payload: RenameConversationPayload = { id, newName };
    return this.send<RenameConversationResponse>(
      OverlayRequestType.RenameConversation,
      payload,
    );
  }

  /**
   * Updates theme/model/conversation options and re-sends them to the
   * embedded app. Bypasses the readiness gate — it is also how the initial
   * handshake options exchange happens, before `ready()` resolves.
   */
  setOverlayOptions(
    options: Partial<
      Pick<
        ChatOverlayOptions,
        | 'theme'
        | 'modelId'
        | 'overlayConversationId'
        | 'enabledFeatures'
        | 'auth'
      >
    >,
  ): Promise<SetOverlayOptionsResponse> {
    this.options.theme = options.theme ?? this.options.theme;
    this.options.modelId = options.modelId ?? this.options.modelId;
    this.options.overlayConversationId =
      options.overlayConversationId ?? this.options.overlayConversationId;
    this.options.enabledFeatures =
      options.enabledFeatures ?? this.options.enabledFeatures;
    if (Object.hasOwn(options, 'auth')) {
      this.options.auth = options.auth;
    }
    return this.sendCurrentOverlayOptions();
  }

  /** Registers `callback` to be invoked with each `eventType` event's payload. */
  subscribe<T = unknown>(
    eventType: OverlayEventType,
    callback: (payload: T) => void,
  ): () => void {
    const callbacks =
      this.eventSubscribers.get(eventType) ??
      new Set<(payload: unknown) => void>();
    const typedCallback = callback as (payload: unknown) => void;
    callbacks.add(typedCallback);
    this.eventSubscribers.set(eventType, callbacks);
    return () => {
      callbacks.delete(typedCallback);
    };
  }

  /** Grants the iframe permission to enter fullscreen. */
  allowFullscreen(): void {
    this.iframe.setAttribute('allowfullscreen', 'true');
    const allow = this.iframe.getAttribute('allow') ?? '';
    if (!allow.includes('fullscreen')) {
      this.iframe.setAttribute(
        'allow',
        [allow, 'fullscreen'].filter(Boolean).join('; '),
      );
    }
  }

  /** Requests fullscreen on the iframe element. */
  async openFullscreen(): Promise<void> {
    if (typeof this.iframe.requestFullscreen === 'function') {
      await this.iframe.requestFullscreen();
    }
  }

  /**
   * Removes the `message` listener, rejects all pending requests, and
   * removes the iframe/loader from `root`. Calling twice is a no-op.
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    window.removeEventListener('message', this.messageListener);
    this.pendingRequests.forEach((deferred) => {
      deferred.reject(new Error('ChatOverlay: instance was destroyed'));
    });
    this.pendingRequests.clear();
    this.readyGate.reject(new Error('ChatOverlay: instance was destroyed'));
    this.iframe.remove();
    this.loader.remove();
  }

  private sendCurrentOverlayOptions(): Promise<SetOverlayOptionsResponse> {
    const payload: SetOverlayOptionsPayload = {
      hostDomain: window.location.origin,
    };
    if (this.options.theme !== undefined) {
      payload.theme = this.options.theme;
    }
    if (this.options.modelId !== undefined) {
      payload.modelId = this.options.modelId;
    }
    if (this.options.overlayConversationId !== undefined) {
      payload.overlayConversationId = this.options.overlayConversationId;
    }
    if (this.options.enabledFeatures !== undefined) {
      payload.enabledFeatures = this.options.enabledFeatures;
    }
    const authProviderUiModes = this.options.auth?.providerUiModes;
    if (
      authProviderUiModes !== undefined &&
      Object.keys(authProviderUiModes).length > 0
    ) {
      payload.authProviderUiModes = authProviderUiModes;
    }
    return this.send<SetOverlayOptionsResponse>(
      OverlayRequestType.SetOverlayOptions,
      payload,
      { bypassReadyGate: true },
    );
  }

  private send<TResponse>(
    type: OverlayRequestType,
    payload?: unknown,
    sendOptions?: { bypassReadyGate?: boolean },
  ): Promise<TResponse> {
    if (this.isDestroyed) {
      return Promise.reject(new Error('ChatOverlay: instance was destroyed'));
    }

    if (sendOptions?.bypassReadyGate) {
      return this.dispatchRequest<TResponse>(type, payload);
    }

    return this.readyGate.promise.then(() =>
      this.dispatchRequest<TResponse>(type, payload),
    );
  }

  private dispatchRequest<TResponse>(
    type: OverlayRequestType,
    payload?: unknown,
  ): Promise<TResponse> {
    if (this.isDestroyed) {
      return Promise.reject(new Error('ChatOverlay: instance was destroyed'));
    }

    const timeoutMs = this.options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const deferred = new DeferredRequest<TResponse>(type, timeoutMs);
    this.pendingRequests.set(
      deferred.requestId,
      deferred as DeferredRequest<unknown>,
    );
    deferred.promise
      .finally(() => {
        this.pendingRequests.delete(deferred.requestId);
      })
      .catch(() => undefined);

    const message: OverlayMessageRequest = {
      type,
      requestId: deferred.requestId,
      expiresAt: Date.now() + timeoutMs,
      payload,
    };
    this.iframe.contentWindow?.postMessage(message, this.targetOrigin);

    return deferred.promise;
  }

  private handleMessage(event: MessageEvent): void {
    if (event.source !== this.iframe.contentWindow) {
      return;
    }
    const data = event.data;
    if (isOverlayMessageResponse(data)) {
      this.handleResponse(data);
      return;
    }
    if (isOverlayMessageEvent(data)) {
      this.handleEvent(data);
    }
  }

  private handleResponse(message: OverlayMessageResponse): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending || !pending.matches(message.type, message.requestId)) {
      return;
    }
    this.pendingRequests.delete(message.requestId);
    if (message.error) {
      pending.reject(
        new ChatOverlayRequestError(pending.requestType, message.error),
      );
      return;
    }
    pending.resolve(message.payload);
  }

  private handleEvent(message: OverlayMessageEvent): void {
    const eventType = message.type as OverlayEventType;

    if (eventType === OverlayEventType.Ready) {
      this.sendCurrentOverlayOptions().catch(() => undefined);
    }

    const hideEvent = this.options.loaderHideEvent ?? OverlayEventType.Ready;
    if (eventType === hideEvent) {
      this.hideLoader();
    }

    if (eventType === OverlayEventType.ReadyToInteract) {
      this.readyGate.resolve(true);
    }

    this.notifySubscribers(eventType, message.payload);
  }

  private hideLoader(): void {
    this.loader.style.display = 'none';
  }

  private notifySubscribers(
    eventType: OverlayEventType,
    payload: unknown,
  ): void {
    const callbacks = this.eventSubscribers.get(eventType);
    callbacks?.forEach((callback) => callback(payload));
  }
}
