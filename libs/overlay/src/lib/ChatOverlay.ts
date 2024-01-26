import { DeferredRequest } from './utils/DeferredRequest';
import { Task } from './utils/Task';
import { Styles, setStyles } from './utils/styleUtils';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { Feature } from 'shared';

export interface ChatOverlayOptions {
  domain: string;
  hostDomain: string;

  theme?: string;
  modelId?: string;

  enabledFeatures?: Feature;

  requestTimeout?: number;

  loaderStyles?: Styles;
  loaderClass?: string;
}

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
    );

    this.root.appendChild(this.loader);
    this.root.appendChild(this.iframe);

    setStyles(this.root, { position: 'relative' });

    /*
      After iframeInteraction is ready, that will send initial settings to application (incl. hostDomain, theme, etc.)
      send() depends of iframeInteraction, that wouldn't executed until iframeInteraction is ready
    */
    this.setOverlayOptions(options);

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

    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-modals');
    iframe.sandbox.add('allow-forms');
    iframe.sandbox.add('allow-popups');
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
  protected initLoader(styles: Styles, className?: string): HTMLElement {
    const loader = document.createElement('div');

    loader.innerHTML = 'Loading...';

    if (className) {
      loader.className = className;
    }

    setStyles(loader, {
      position: 'absolute',
      background: 'white',
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
      display: 'block',
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
          `[ChatOverlay] There is no element with selector ${root} to append iframe`,
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
        '[ChatOverlay] Fullscreen is not allowed. Allow it first',
      );
    }

    this.iframe.requestFullscreen();
  }

  /**
   * Callback to post message event, contains mapping event to this.requests, mapping event to this.subscriptions
   * If event.data.type === '@DIAL_OVERLAY/READY' means that DIAL ready to receive message -> this.iframeInteraction.complete()
   * @param event {MessageEvent} post message event
   */
  protected process = (event: MessageEvent): void => {
    if (event.data.type === '@DIAL_OVERLAY/READY') {
      this.iframeInteraction.complete();
      return;
    }

    if (!event.data?.type) return;

    // Try to map event, because type doesn't have requestId
    if (!event.data?.requestId) {
      this.processEvent(event.data.type, event.data?.payload);

      return;
    }

    for (const request of this.requests) {
      if (request.match(event.data.type, event.data.requestId)) {
        request.reply(event.data?.payload);
        break;
      }
    }

    // if request was replied -> should remove it from this.requests
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
   * @returns {Promise<unknown>} Return promise with response payload when resolved
   */
  public async send(type: string, payload?: unknown): Promise<unknown> {
    // TODO: Add typo to type when this logic will be at npm package

    // wait until iframe is ready to receive messages
    await this.iframeInteraction.ready();

    if (!this.iframe.contentWindow) {
      throw new Error(
        '[ChatOverlay] There is no content window to send requests',
      );
    }

    const request = new DeferredRequest(type, {
      payload,
      timeout: this.options?.requestTimeout,
    });
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
  public async getMessages() {
    const messages = await this.send('@DIAL_OVERLAY/GET_MESSAGES');

    return messages;
  }

  /**
   * Send message into the first selected conversation
   * @param content {string} text of message that should be sent to the chat
   */
  public async sendMessage(content: string) {
    await this.send('@DIAL_OVERLAY/SEND_MESSAGE', { content });
  }

  /**
   * Set systemPrompt into the first selected conversation
   * @param systemPrompt {string} text content of system prompt
   */
  public async setSystemPrompt(systemPrompt: string) {
    await this.send('@DIAL_OVERLAY/SET_SYSTEM_PROMPT', { systemPrompt });
  }

  /**
   * Send to DIAL overlay options (modelId, hostDomain, etc.)
   * @param options {ChatOverlayOptions} Options that should be set into the DIAL
   */
  public async setOverlayOptions(options: ChatOverlayOptions) {
    // while settings are updating showing loader
    this.showLoader();

    await this.send('@DIAL_OVERLAY/SET_OVERLAY_OPTIONS', options);

    // when settings are updated hiding loader
    this.hideLoader();
  }

  /**
   * Destroys ChatOverlay
   */
  destroy() {
    window.removeEventListener('message', this.process);
    this.iframeInteraction.fail('Chat Overlay destroyed');
    this.root.removeChild(this.iframe);
  }
}
