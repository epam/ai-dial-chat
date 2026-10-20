import type {
  VisualizerConnectorLoaderStyles,
  VisualizerConnectorOptions,
  VisualizerConnectorRequest,
} from '../models/visualizer-connector';
import {
  VisualizerConnectorEvents,
  type VisualizerConnectorRequests,
} from '../types/visualizer-connector';
import { defaultLoaderSVG } from './internal/default-loader';
import { DeferredRequest } from './internal/deferred-request';
import { setStyles } from './internal/set-styles';
import { Task } from './internal/task';

const LIB_NAME = 'VisualizerConnector';

/* Wire-visible rejection reason of `ready()` after `destroy()`; kept verbatim from npm 0.48.0. */
const DESTROYED_REASON = 'Chat Visualizer destroyed';

const SANDBOX_TOKENS = [
  'allow-same-origin',
  'allow-scripts',
  'allow-modals',
  'allow-forms',
  'allow-downloads',
  'allow-popups',
  'allow-presentation',
];

const IFRAME_ALLOW =
  'clipboard-write *; fullscreen *; accelerometer *; gyroscope *; autoplay *; web-share *; encrypted-media *';

interface Subscription {
  eventType: string;
  callback: (payload: unknown) => void;
}

/** Mounts a custom visualizer iframe into a host container and exchanges protocol messages with it. */
export class VisualizerConnector {
  protected root: HTMLElement;
  protected subscriptions: Subscription[] = [];
  protected iframe: HTMLIFrameElement;
  protected loader: HTMLElement;
  protected loaderDisplayCss = 'flex';
  protected iframeInteraction = new Task();
  protected requests: DeferredRequest[] = [];
  protected options: VisualizerConnectorOptions;
  private isDestroyed = false;

  /** Mounts the loader and iframe into `root` (an element or a selector) and starts listening for messages. */
  constructor(root: HTMLElement | string, options: VisualizerConnectorOptions) {
    this.options = options;
    this.root = this.getRoot(root);
    this.iframe = this.initIframe();
    this.loader = this.initLoader(
      options.loaderStyles ?? {},
      options.loaderClass,
      options.loaderInnerHTML,
    );
    this.root.appendChild(this.loader);
    this.root.appendChild(this.iframe);
    setStyles(this.root, { position: 'relative' });
    this.showLoader();
    window.addEventListener('message', this.process);
  }

  /** Resolves with `true` once the iframe posts `READY_TO_INTERACT`; rejects on `destroy()`. Never times out. */
  async ready(): Promise<boolean> {
    return this.iframeInteraction.ready();
  }

  /**
   * Posts `${visualizerName}/${type}` and resolves with the `/RESPONSE` payload.
   * Rejects with a string when `requestTimeout` elapses; resolves `undefined`
   * when the connector is destroyed before the handshake completes.
   */
  async send(
    type: VisualizerConnectorRequests,
    payload?: unknown,
    waitForReady = true,
  ): Promise<unknown> {
    if (waitForReady) {
      try {
        await this.iframeInteraction.ready();
      } catch (error) {
        if (error === DESTROYED_REASON) {
          return undefined;
        }
        throw error;
      }
    }

    const target = this.iframe.contentWindow;
    if (!this.iframe.isConnected || !target) {
      return undefined;
    }

    const request = new DeferredRequest(
      `${this.options.visualizerName}/${type}`,
      payload,
      this.options.requestTimeout,
      LIB_NAME,
    );
    this.requests.push(request);
    target.postMessage(request.toPostMessage(), this.options.domain);

    return request.promise;
  }

  /** Calls `callback` for every unsolicited message of `eventType`; returns an unsubscribe function. */
  subscribe(
    eventType: string,
    callback: (payload: unknown) => void,
  ): () => void {
    this.subscriptions.push({ eventType, callback });
    return () => {
      this.subscriptions = this.subscriptions.filter(
        (subscription) => subscription.callback !== callback,
      );
    };
  }

  /** Replaces the stored options. */
  setVisualizerConnectorOptions(options: VisualizerConnectorOptions): void {
    this.options = options;
  }

  /** Removes the iframe and loader, rejects `ready()`, and stops listening. A second call is a no-op. */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;

    window.removeEventListener('message', this.process);
    /* Mark the connector's own handshake promise as handled so failing it
     * never surfaces as an unhandled rejection when nothing awaited
     * `ready()` (e.g. React Strict Mode's mount/unmount). Callers that did
     * await it still observe the rejection. */
    void this.iframeInteraction.ready().catch(() => undefined);
    this.iframeInteraction.fail(DESTROYED_REASON);
    this.iframe.remove();
    this.loader.remove();
  }

  /** Creates the sandboxed iframe pointing at `options.domain`. */
  protected initIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.src = this.options.domain;
    /* Set as an attribute: equivalent to `sandbox.add` in browsers, and also
     * works where `HTMLIFrameElement.sandbox` is not implemented (jsdom). */
    iframe.setAttribute('sandbox', SANDBOX_TOKENS.join(' '));
    iframe.setAttribute('allow', IFRAME_ALLOW);
    iframe.style.height = '100%';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.loading = 'lazy';
    return iframe;
  }

  /** Creates the loader overlay shown until the iframe posts `READY` or `READY_TO_INTERACT`. */
  protected initLoader(
    styles: VisualizerConnectorLoaderStyles,
    className?: string,
    loaderInnerHTML?: string,
  ): HTMLElement {
    const loader = document.createElement('div');
    loader.innerHTML = loaderInnerHTML ?? defaultLoaderSVG;
    if (className) {
      loader.className = className;
    }
    if (styles.display) {
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

  /** Resolves `root` to an element; throws when a selector matches nothing. */
  protected getRoot(root: HTMLElement | string): HTMLElement {
    if (typeof root !== 'string') {
      return root;
    }
    const element = document.querySelector<HTMLElement>(root);
    if (!element) {
      throw new Error(
        `[${LIB_NAME}] There is no element with selector ${root} to append iframe`,
      );
    }
    return element;
  }

  /** Dispatches a message from this connector's iframe to the handshake, a pending request, or subscribers. */
  protected process = (event: MessageEvent<VisualizerConnectorRequest>) => {
    if (event.source !== this.iframe.contentWindow) {
      return;
    }

    const type = event.data?.type;
    const prefix = `${this.options.visualizerName}/`;
    if (typeof type !== 'string' || !type.startsWith(prefix)) {
      return;
    }

    if (type === `${prefix}${VisualizerConnectorEvents.Ready}`) {
      this.hideLoader();
      return;
    }

    if (type === `${prefix}${VisualizerConnectorEvents.ReadyToInteract}`) {
      this.hideLoader();
      this.iframeInteraction.complete();
      return;
    }

    const { requestId, payload } = event.data;
    if (!requestId) {
      this.processEvent(type, payload);
      return;
    }

    this.requests
      .find((request) => request.match(type, requestId))
      ?.reply(payload);
    this.requests = this.requests.filter((request) => !request.isReplied);
  };

  /** Invokes every subscription registered for `eventType`. */
  protected processEvent(eventType: string, payload?: unknown): void {
    for (const subscription of this.subscriptions) {
      if (subscription.eventType === eventType) {
        subscription.callback(payload);
      }
    }
  }

  private showLoader(): void {
    setStyles(this.loader, { display: this.loaderDisplayCss });
  }

  private hideLoader(): void {
    setStyles(this.loader, { display: 'none' });
  }
}
