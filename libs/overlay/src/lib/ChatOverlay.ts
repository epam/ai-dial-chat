import {
  ChatOverlayOptions,
  CreateConversationRequest,
  CreateConversationResponse,
  CreateLocalConversationResponse,
  CreatePlaybackConversationRequest,
  CreatePlaybackConversationResponse,
  DeferredRequest,
  DeleteMessageRequest,
  DeleteMessageResponse,
  ExportConversationRequest,
  ExportConversationResponse,
  GetConversationsResponse,
  GetMessagesResponse,
  GetSelectedConversationsResponse,
  ImportConversationRequest,
  ImportConversationResponse,
  LatestExportConversationsFormat,
  OverlayEvents,
  OverlayRequest,
  OverlayRequests,
  RenameConversationRequest,
  RenameConversationResponse,
  SelectConversationRequest,
  SelectConversationResponse,
  SendMessageRequest,
  SendMessageResponse,
  SetInputContentRequest,
  SetSystemPromptRequest,
  SetSystemPromptResponse,
  StopSelectedPlaybackConversationResponse,
  Styles,
  Task,
  overlayAppName,
  overlayLibName,
  setStyles,
} from '@epam/ai-dial-shared';

const defaultLoaderSVG = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M24 39V46.5" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.4" d="M9 24H1.5" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.5" d="M8.0918 8.0918L13.3994 13.3994" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.6" d="M24 1.5V9" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.7" d="M39.9121 8.08594L37.2607 10.7373L34.6094 13.3887" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.8" d="M46.5 24H39" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.9" d="M34.6055 34.6055L39.9082 39.9082" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<path opacity="0.3" d="M13.3936 34.6055L8.08594 39.9131" stroke="#7F8792" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 0 0" to="360 0 0" dur="1s" repeatCount="indefinite" />
</svg>
`;

interface Subscription {
  eventType: string;
  callback: (payload: unknown) => void;
}
/**
 * Class which creates iframe with DIAL, allows to interact with it (send/receive messages)
 */
export class ChatOverlay {
  protected root: HTMLElement;
  protected iframe: HTMLIFrameElement;
  protected loader: HTMLElement;
  protected loaderDisplayCss = 'flex';

  protected iframeInteraction: Task;

  protected requests: DeferredRequest[];
  protected subscriptions: Subscription[];

  protected options: ChatOverlayOptions;

  /**
   * Creates a ChatOverlay
   * @param root {HTMLElement | string} reference or selector to parent container where the iframe should be placed
   * @param options {ChatOverlayOptions} overlay options (incl. domain, hostDomain, theme, modelId, etc.)
   */
  constructor(root: HTMLElement | string, options: ChatOverlayOptions) {
    this.options = options;

    this.root = this.getRoot(root);

    this.requests = [];
    this.subscriptions = [];

    this.iframeInteraction = new Task();

    this.iframe = this.initIframe();
    this.loader = this.initLoader(
      options?.loaderStyles || {},
      options?.loaderClass,
      options?.loaderInnerHTML,
    );

    this.root.appendChild(this.loader);
    this.root.appendChild(this.iframe);

    setStyles(this.root, { position: 'relative' });

    this.showLoader();

    window.addEventListener('message', this.process);
  }

  /**
   * Creates iframe add set initial options to it
   * @returns {HTMLIFrameElement} reference to iframe element
   */
  protected initIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');

    iframe.src = this.options.domain;
    iframe.allow = 'clipboard-write';
    iframe.name = 'overlay';
    iframe.ariaLabel = 'Chat overlay';

    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-modals');
    iframe.sandbox.add('allow-forms');
    iframe.sandbox.add('allow-popups');
    iframe.sandbox.add('allow-downloads');
    iframe.sandbox.add('allow-popups-to-escape-sandbox');

    iframe.style.height = '100%';
    iframe.style.width = '100%';
    iframe.style.border = 'none';

    return iframe;
  }

  /**
   * Creates loader and add styles
   * @returns {HTMLElement} reference to loader element
   */
  protected initLoader(
    styles: Styles,
    className?: string,
    loaderInnerHTML?: string,
  ): HTMLElement {
    const loader = document.createElement('div');

    loader.innerHTML = loaderInnerHTML ?? defaultLoaderSVG;

    if (className) {
      loader.className = className;
    }

    if (styles?.display) {
      this.loaderDisplayCss = styles.display;
    }

    setStyles(loader, {
      position: 'absolute',
      background: 'white',
      display: this.loaderDisplayCss,
      alignItems: 'center',
      justifyContent: 'center',
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      zIndex: '2',
      ...styles,
    });

    return loader;
  }
  /**
   * Shows loader
   */
  private showLoader() {
    setStyles(this.loader, {
      display: this.loaderDisplayCss,
    });
  }
  /**
   * Hides loader
   */
  private hideLoader() {
    setStyles(this.loader, {
      display: 'none',
    });
  }

  /**
   * Displays if iframe ready to interact
   * @returns {Promise<boolean>} if the promise resolved -> iframe ready to interact
   */
  public async ready(): Promise<boolean> {
    return this.iframeInteraction.ready();
  }

  /**
   * If user provides reference to container ? returns the container : query the selector and return reference to container
   * @param {HTMLElement | string} root reference to parent container or selector where iframe should be placed
   * @returns {HTMLElement} reference to container where iframe would be placed
   */
  protected getRoot(root: HTMLElement | string): HTMLElement {
    if (typeof root === 'string') {
      const element = document.querySelector(root);

      if (!element) {
        throw new Error(
          `[${overlayLibName}] There is no element with selector ${root} to append iframe`,
        );
      }

      return element as HTMLElement;
    }

    return root;
  }

  /**
   * Allows iframe to be in fullscreen mode
   */
  public allowFullscreen(): void {
    this.iframe.allowFullscreen = true;
  }

  /**
   * Opens iframe in fullscreen mode
   */
  public openFullscreen(): void {
    if (!this.iframe.requestFullscreen) {
      throw new Error(
        `[${overlayLibName}] Fullscreen is not allowed. Allow it first`,
      );
    }

    this.iframe.requestFullscreen();
  }

  /**
   * Callback to post message event, contains mapping event to this.requests, mapping event to this.subscriptions
   * @param event {MessageEvent} post message event
   */
  protected process = (event: MessageEvent<OverlayRequest>): void => {
    if (event.data.type === `${overlayAppName}/${OverlayEvents.initReady}`) {
      this.showLoader();

      if (this.options.loaderHideEvent === OverlayEvents.initReady) {
        this.hideLoader();
      }

      return;
    }
    if (event.data.type === `${overlayAppName}/${OverlayEvents.ready}`) {
      this.setOverlayOptions(this.options);

      if (
        !this.options.loaderHideEvent ||
        this.options.loaderHideEvent === OverlayEvents.ready
      ) {
        this.hideLoader();
      }

      return;
    }
    if (
      event.data.type === `${overlayAppName}/${OverlayEvents.readyToInteract}`
    ) {
      if (this.options.loaderHideEvent === OverlayEvents.readyToInteract) {
        this.hideLoader();
      }

      this.iframeInteraction.complete();
      return;
    }

    if (!event.data?.type) return;

    // Try to map event, because type doesn't have requestId
    if (!event.data?.requestId) {
      if (this.options.loaderHideEvent === event.data.type) {
        this.hideLoader();
      }

      this.processEvent(event.data.type, event.data?.payload);

      return;
    }

    for (const request of this.requests) {
      if (request.match(event.data.type, event.data.requestId)) {
        request.reply(event.data?.payload);
        break;
      }
    }

    // if request was replied -> should delete it from this.requests
    this.requests = this.requests.filter((request) => !request.isReplied);
  };

  /**
   * Going through all event callbacks and call it if eventType is the same as in subscription
   * @param eventType {string} Name of event that DIAL send
   * @param payload {unknown} Payload of event
   */
  protected processEvent(eventType: string, payload?: unknown): void {
    for (const subscription of this.subscriptions) {
      if (subscription.eventType === eventType) {
        subscription.callback(payload);
      }
    }
  }

  /**
   * Creates DeferredRequests, put into the this.requests
   * We don't put something into the this.requests until `this.ready()`
   * @param type Request name
   * @param payload Request payload
   * @param waitForReady Is this request should wait for overlay ready (default: true)
   * @returns {Promise<unknown>} Return promise with response payload when resolved
   */
  public async send(
    type: OverlayRequests,
    payload?: unknown,
    waitForReady = true,
  ): Promise<unknown> {
    if (waitForReady) {
      await this.iframeInteraction.ready();
    }

    if (!this.iframe.contentWindow) {
      throw new Error(
        `[${overlayLibName}] There is no content window to send requests`,
      );
    }

    const request = new DeferredRequest(
      `${overlayAppName}/${type}`,
      {
        payload,
        timeout: this.options?.requestTimeout,
      },
      overlayLibName,
    );
    this.requests.push(request);

    this.iframe.contentWindow.postMessage(request.toPostMessage(), '*');

    return request.promise;
  }

  /**
   * Add callback with eventType to this.subscriptions
   * @param eventType Event type
   * @param callback Callback which should associated to the event type
   * @returns {() => void} Callback which removes event callback from the this.requests
   */
  public subscribe(
    eventType: string,
    callback: (payload: unknown) => void,
  ): () => void {
    this.subscriptions.push({ eventType, callback });

    return () => {
      this.subscriptions = this.subscriptions.filter(
        (sub) => sub.callback !== callback,
      );
    };
  }

  /**
   * Get messages from first selected conversation
   */
  public async getMessages(): Promise<GetMessagesResponse> {
    return this.send(
      OverlayRequests.getMessages,
    ) as Promise<GetMessagesResponse>;
  }

  /**
   * Get all listing conversations
   * @returns {OverlayConversation[]} all conversations visible in chat
   */
  public async getConversations(): Promise<GetConversationsResponse> {
    return this.send(
      OverlayRequests.getConversations,
    ) as Promise<GetConversationsResponse>;
  }

  /**
   * Get all selected conversations
   * @returns {OverlayConversation[]} all selected conversations visible in chat
   */
  public async getSelectedConversations(): Promise<GetSelectedConversationsResponse> {
    return this.send(
      OverlayRequests.getSelectedConversations,
    ) as Promise<GetSelectedConversationsResponse>;
  }

  /**
   * Select conversation
   * @param {string} id - id of conversation to select
   * @returns Returns selected conversation info
   */
  public async selectConversation(
    id: string,
  ): Promise<SelectConversationResponse> {
    const request: SelectConversationRequest = {
      id,
    };

    return this.send(
      OverlayRequests.selectConversation,
      request,
    ) as Promise<SelectConversationResponse>;
  }

  /**
   * Delete conversation
   * @param {string} id - id of conversation to delete
   */
  public async deleteConversation(id: string): Promise<void> {
    const request: SelectConversationRequest = {
      id,
    };

    return this.send(
      OverlayRequests.deleteConversation,
      request,
    ) as Promise<void>;
  }

  /**
   * Rename conversation
   * @param {string} id - id of conversation to rename
   * @param {string} newName - new name of conversation
   * @returns Returns renamed conversation info
   */
  public async renameConversation(
    id: string,
    newName: string,
  ): Promise<RenameConversationResponse> {
    const request: RenameConversationRequest = {
      id,
      newName,
    };

    return this.send(
      OverlayRequests.renameConversation,
      request,
    ) as Promise<RenameConversationResponse>;
  }

  /**
   * Create playback conversation
   * @param {string} id - id of conversation from create playback
   * @returns Returns newly created playback conversation info
   */
  public async createPlaybackConversation(
    id: string,
  ): Promise<CreatePlaybackConversationResponse> {
    const request: CreatePlaybackConversationRequest = {
      id,
    };

    return this.send(
      OverlayRequests.createPlaybackConversation,
      request,
    ) as Promise<CreatePlaybackConversationResponse>;
  }

  /**
   * Stop selected playback conversation
   * @returns Returns normal conversation after stopping playback
   */
  public async stopSelectedPlaybackConversation(): Promise<StopSelectedPlaybackConversationResponse> {
    return this.send(
      OverlayRequests.stopSelectedPlaybackConversation,
    ) as Promise<StopSelectedPlaybackConversationResponse>;
  }

  /**
   * Export conversation
   * @param {string} id - id of conversation to export
   * @returns Returns exported conversation object
   */
  public async exportConversation(
    id: string,
  ): Promise<ExportConversationResponse> {
    const request: ExportConversationRequest = {
      id,
    };

    return this.send(
      OverlayRequests.exportConversation,
      request,
    ) as Promise<ExportConversationResponse>;
  }

  /**
   * Import conversation
   * @param {LatestExportConversationsFormat} importedConversation - conversation object to import
   * @returns Returns imported conversation info
   */
  public async importConversation(
    importedConversation: LatestExportConversationsFormat,
  ): Promise<ImportConversationResponse> {
    const request: ImportConversationRequest = {
      importConversation: importedConversation,
    };

    return this.send(
      OverlayRequests.importConversation,
      request,
    ) as Promise<ImportConversationResponse>;
  }

  /**
   * Create conversation
   * @param {string} parentPath - path to create conversation in. If not defined or null conversation will be created in user Root
   * @returns Returns created conversation info
   */
  public async createConversation(
    parentPath?: string | null,
    local?: boolean | null,
  ): Promise<CreateConversationResponse> {
    const request: CreateConversationRequest = {
      parentPath,
      local,
    };

    return this.send(
      OverlayRequests.createConversation,
      request,
    ) as Promise<CreateConversationResponse>;
  }

  /**
   * Create local conversation which will be not visible before first assistant message
   *
   * Note: after first assistant message local conversation will be saved in `newConversationsFolderId` option path, or in user Root if it's not defined or null
   * @returns Returns created local conversation info
   */
  public async createLocalConversation(): Promise<CreateLocalConversationResponse> {
    return this.send(
      OverlayRequests.createLocalConversation,
    ) as Promise<CreateLocalConversationResponse>;
  }

  /**
   * Send message into the first selected conversation
   * @param content {string} text of message that should be sent to the chat
   */
  public async sendMessage(content: string): Promise<SendMessageResponse> {
    const request: SendMessageRequest = {
      content,
    };

    return this.send(
      OverlayRequests.sendMessage,
      request,
    ) as Promise<SendMessageResponse>;
  }

  /**
   * Delete message in current selected conversation by index
   * @param index {number} index of message in conversation
   * NOTE: if message on index is user message it will also remove answer from assistant
   */
  public async deleteMessage(index: number): Promise<DeleteMessageResponse> {
    const request: DeleteMessageRequest = {
      index,
    };

    return this.send(
      OverlayRequests.deleteMessage,
      request,
    ) as Promise<DeleteMessageResponse>;
  }

  /**
   * Set input content
   * @param content {string} content to set in chat input
   */
  public async setInputContent(content: string): Promise<void> {
    const request: SetInputContentRequest = {
      content,
    };

    return this.send(OverlayRequests.setInputContent, request) as Promise<void>;
  }

  /**
   * Set systemPrompt into the first selected conversation
   * @param systemPrompt {string} text content of system prompt
   */
  public async setSystemPrompt(
    systemPrompt: string,
  ): Promise<SetSystemPromptResponse> {
    const request: SetSystemPromptRequest = {
      systemPrompt,
    };

    return this.send(
      OverlayRequests.setSystemPrompt,
      request,
    ) as Promise<SetSystemPromptResponse>;
  }

  /**
   * Send to DIAL overlay options (modelId, hostDomain, etc.)
   * @param options {ChatOverlayOptions} Options that should be set into the DIAL
   */
  public async setOverlayOptions(options: ChatOverlayOptions) {
    await this.send(OverlayRequests.setOverlayOptions, options, false);
  }

  /**
   * Destroys ChatOverlay
   */
  destroy() {
    window.removeEventListener('message', this.process);
    this.iframeInteraction.fail('Chat Overlay destroyed');
    this.root.removeChild(this.iframe);

    this.root.removeChild(this.loader);
  }
}
