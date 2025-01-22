import {
  DeferredRequest,
  Styles,
  Task,
  VisualizerConnectorEvents,
  VisualizerConnectorOptions,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
  setStyles,
  visualizerConnectorLibName,
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

export class VisualizerConnector {
  protected root: HTMLElement;
  protected subscriptions: Subscription[];

  protected iframe: HTMLIFrameElement;
  protected loader: HTMLElement;
  protected loaderDisplayCss = 'flex';

  protected iframeInteraction: Task;

  protected requests: DeferredRequest[];

  protected options: VisualizerConnectorOptions;

  /**
   * Creates a VisualizerConnector
   * @param root {HTMLElement | string} reference or selector to parent container where the iframe should be placed
   * @param options {VisualizerConnectorOptions} visualizer connector options ( hostDomain, domain etc.) which will be used to create iframe
   */
  constructor(root: HTMLElement | string, options: VisualizerConnectorOptions) {
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

    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-modals');
    iframe.sandbox.add('allow-forms');
    iframe.sandbox.add('allow-downloads');
    iframe.sandbox.add('allow-popups');

    iframe.style.height = '100%';
    iframe.style.width = '100%';
    iframe.style.border = 'none';

    iframe.loading = 'lazy';

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
          `[${visualizerConnectorLibName}] There is no element with selector ${root} to append iframe`,
        );
      }

      return element as HTMLElement;
    }

    return root;
  }

  /**
   * Callback to post message event, contains mapping event to this.requests, mapping event to this.subscriptions
   * If event.data.type === '{visualizerName}/READY' means that Visualizer ready to receive message -> this.iframeInteraction.complete()
   * @param event {MessageEvent} post message event
   */
  protected process = (
    event: MessageEvent<VisualizerConnectorRequest>,
  ): void => {
    if (
      event.data.type ===
      `${this.options.visualizerName}/${VisualizerConnectorEvents.ready}`
    ) {
      this.hideLoader();
      return;
    }
    if (
      event.data.type ===
      `${this.options.visualizerName}/${VisualizerConnectorEvents.readyToInteract}`
    ) {
      this.hideLoader();
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
   * @param waitForReady Is this request should wait for Visualizer ready (default: true)
   * @returns {Promise<unknown>} Return promise with response payload when resolved
   */
  public async send(
    type: VisualizerConnectorRequests,
    payload?: unknown,
    waitForReady = true,
  ): Promise<unknown> {
    if (waitForReady) {
      await this.iframeInteraction.ready();
    }

    if (!this.iframe.contentWindow) {
      throw new Error(
        `[${visualizerConnectorLibName}] There is no content window to send requests`,
      );
    }

    const request = new DeferredRequest(
      `${this.options.visualizerName}/${type}`,
      {
        payload,
        timeout: this.options?.requestTimeout,
      },
      visualizerConnectorLibName,
    );
    this.requests.push(request);

    this.iframe.contentWindow.postMessage(
      request.toPostMessage(),
      this.options.domain,
    );

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
   * Sets Visualizer options (hostDomain,loaderStyles, etc.)
   * @param options {VisualizerConnectorOptions} Options that should be set into the Visualizer
   */
  public setVisualizerConnectorOptions(options: VisualizerConnectorOptions) {
    this.options = options;
  }

  /**
   * Destroys Visualizer
   */
  destroy() {
    window.removeEventListener('message', this.process);
    this.iframeInteraction.fail('Chat Visualizer destroyed');
    this.root.removeChild(this.iframe);

    this.root.removeChild(this.loader);
  }
}
