import {
  type AttachmentData,
  type GroupedAttachmentsData,
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-chat-shared';

interface RequestParams {
  /** Full wire type string, e.g. `${appName}/SEND_VISUALIZE_DATA`. */
  type: string;
  requestId: string;
  payload?: unknown;
}

/** Parameters for a `/RESPONSE` reply posted back to the host. */
export interface PostMessageRequestParams extends RequestParams {
  /** Origin to post the response to (the host origin the original request arrived from). */
  dialHost: string;
}

/** Callback options for `ChatVisualizerConnector`. */
export interface ChatVisualizerCallbacks {
  /** Invoked with the attachment payload delivered via `SEND_VISUALIZE_DATA`. */
  onData?: (visualizerData: AttachmentData) => void;
  /** Invoked with the grouped attachments payload delivered via `SEND_GROUPED_VISUALIZE_DATA`. */
  onGroupedData?: (groupedData: GroupedAttachmentsData) => void;
}

/**
 * Iframe-side counterpart to `@epam/ai-dial-visualizer-connector`'s
 * `VisualizerConnector`. Third-party visualizer applications construct this
 * class to receive attachment data from the host over `postMessage`.
 *
 * `appName` MUST equal the `title` of the corresponding `CUSTOM_VISUALIZERS`
 * entry configured on the host. A mismatch is a silent failure: this
 * instance will never see any message from the host, because every inbound
 * message is namespaced `${appName}/…` and the host only prefixes messages
 * with the `title` it was configured with.
 */
export class ChatVisualizerConnector {
  protected dialHost: string;

  /**
   * List of allowed/target hosts. All outgoing messages (without an explicit
   * `dialHost`) are sent to each of them. All incoming messages must
   * originate from one of them.
   */
  protected dialHosts: string[];

  protected appName: string;
  protected dataCallback: (visualizerData: AttachmentData) => void;
  protected groupedDataCallback?: (groupedData: GroupedAttachmentsData) => void;

  /**
   * @param dialHost DIAL Chat host(s) this visualizer is allowed to exchange messages with.
   * @param appName Protocol namespace — must equal the `title` of the host's `CUSTOM_VISUALIZERS` entry.
   * @param dataCallback Callback (or `{ onData, onGroupedData }`) invoked with each attachment payload.
   */
  constructor(
    dialHost: string | string[],
    appName: string,
    dataCallback:
      | ((visualizerData: AttachmentData) => void)
      | ChatVisualizerCallbacks,
  ) {
    const hosts = Array.isArray(dialHost) ? dialHost : [dialHost];

    if (!hosts.length) {
      throw new Error('[ChatVisualizerConnector] No dial host(s) provided');
    }

    this.dialHosts = hosts;
    this.dialHost = hosts[0];

    this.appName = appName;

    if (typeof dataCallback === 'function') {
      this.dataCallback = dataCallback;
    } else {
      this.dataCallback =
        dataCallback.onData ??
        (() => {
          console.warn('[ChatVisualizerConnector] No data callback provided');
        });
      this.groupedDataCallback = dataCallback.onGroupedData;
    }

    this.postMessageListener = this.postMessageListener.bind(this);

    window.addEventListener('message', this.postMessageListener, false);
  }

  /**
   * Posts an event message to every configured host (or a single explicit
   * `dialHost`), prefixed `${appName}/${type}`.
   */
  public send({
    type,
    payload,
    dialHost,
  }: {
    type: VisualizerConnectorEvents;
    payload?: unknown;
    dialHost?: string;
  }): void {
    if (!window?.parent) {
      throw new Error(
        `[${this.appName}] There is no parent window to send requests`,
      );
    }

    const targets = dialHost ? [dialHost] : this.dialHosts;

    for (const target of targets) {
      window.parent.postMessage(
        {
          type: `${this.appName}/${type}`,
          payload,
        },
        target,
      );
    }
  }

  /** Posts a `/RESPONSE` reply for a request received from the host. */
  sendPMResponse(requestParams: PostMessageRequestParams): void {
    const { type, requestId, dialHost, payload } = requestParams;

    window?.parent.postMessage(
      {
        type: `${type}/RESPONSE`,
        requestId,
        payload,
      },
      dialHost,
    );
  }

  postMessageListener(event: MessageEvent<RequestParams>): void {
    /* Accept messages only from a configured host (or any host, when '*'). */
    if (
      this.dialHosts[0] !== '*' &&
      !this.dialHosts.some((allowedHost) =>
        allowedHost.startsWith(event.origin),
      )
    ) {
      return;
    }

    if (typeof event.data.payload !== 'object' || event.data.payload === null) {
      return;
    }

    /* Handle single attachment data (CUSTOM_VISUALIZERS) */
    if (
      event.data.type ===
      `${this.appName}/${VisualizerConnectorRequests.SendVisualizeData}`
    ) {
      const payload =
        Object.prototype.hasOwnProperty.call(
          event.data.payload,
          'visualizerData',
        ) &&
        Object.prototype.hasOwnProperty.call(event.data.payload, 'mimeType') &&
        (event.data.payload as AttachmentData);

      if (payload) {
        this.dataCallback(payload);
      }

      this.sendPMResponse({
        type: event.data.type,
        dialHost: event.origin,
        requestId: event.data.requestId,
      });
    }

    /* Handle grouped attachments data (APPLICATION_VISUALIZERS) */
    if (
      event.data.type ===
      `${this.appName}/${VisualizerConnectorRequests.SendGroupedVisualizeData}`
    ) {
      const payload =
        Object.prototype.hasOwnProperty.call(
          event.data.payload,
          'attachments',
        ) &&
        Object.prototype.hasOwnProperty.call(event.data.payload, 'layout') &&
        (event.data.payload as GroupedAttachmentsData);

      if (payload && this.groupedDataCallback) {
        this.groupedDataCallback(payload);
      }

      this.sendPMResponse({
        type: event.data.type,
        dialHost: event.origin,
        requestId: event.data.requestId,
      });
    }
  }

  /** Posts `READY` to notify the host that the visualizer has loaded. */
  public sendReady(): void {
    this.send({ type: VisualizerConnectorEvents.Ready });
  }

  /** Posts `READY_TO_INTERACT` to notify the host that the visualizer can receive data. */
  public sendReadyToInteract(): void {
    this.send({ type: VisualizerConnectorEvents.ReadyToInteract });
  }

  /** Sends a text message into the active conversation via the host. */
  public async sendMessage(content: string): Promise<void> {
    this.send({
      type: VisualizerConnectorEvents.SendMessage,
      payload: { message: content },
    });
  }

  /** Detaches the `message` listener. */
  destroy(): void {
    window.removeEventListener('message', this.postMessageListener);
  }
}
