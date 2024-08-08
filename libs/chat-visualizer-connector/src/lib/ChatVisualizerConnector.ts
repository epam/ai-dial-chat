import {
  AttachmentData,
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';

interface RequestParams {
  type: VisualizerConnectorRequests;
  requestId: string;
  payload?: unknown;
}
export interface PostMessageRequestParams extends RequestParams {
  dialHost: string;
}

/**
 * Class which creates connector with DIAL CHAT, allows to interact with it (send/receive data via post messages)
 */
export class ChatVisualizerConnector {
  protected dialHost: string;
  protected appName: string;
  protected dataCallback: (visualizerData: AttachmentData) => void;

  /**
   * Creates a ChatVisualizerConnector
   * @param dialHost {string} DIAL CHAT host
   * @param appName {string} name of the Visualizer same as in config
   * @param dataCallback {(visualizerData: AttachmentData) => void} callback to get data that will be used in the Visualizer
   */
  constructor(
    dialHost: string,
    appName: string,
    dataCallback: (visualizerData: AttachmentData) => void,
  ) {
    this.dialHost = dialHost;
    this.appName = appName;
    this.dataCallback = dataCallback;
    this.postMessageListener = this.postMessageListener.bind(this);

    window.addEventListener('message', this.postMessageListener, false);
  }

  /**
   * Sends the post message to the DIAL Chat
   * @param type Visualizer Event name
   * @param payload Event payload
   * @param dialHost host of the DIAL Chat
   */
  public send({
    type,
    payload,
    dialHost = this.dialHost,
  }: {
    type: VisualizerConnectorEvents;
    payload?: unknown;
    dialHost?: string;
  }) {
    if (!window?.parent) {
      throw new Error(
        `[${this.appName}] There is no parent window to send requests`,
      );
    }

    window.parent.postMessage(
      {
        type: `${this.appName}/${type}`,
        payload,
      },
      dialHost,
    );
  }

  /**
   * Sends response via postMessage to the DIAL CHAT to notify it data received
   * @param requestParams {PostMessageRequestParams}
   */
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
    if (event.origin !== this.dialHost) return;

    //check if there is a payload
    if (typeof event.data.payload !== 'object' || event.data.payload === null)
      return;

    if (
      event.data.type ===
      `${this.appName}/${VisualizerConnectorRequests.sendVisualizeData}`
    ) {
      const payload =
        Object.prototype.hasOwnProperty.call(
          event.data.payload,
          'visualizerData',
        ) &&
        Object.prototype.hasOwnProperty.call(event.data.payload, 'mimeType') &&
        (event.data.payload as AttachmentData);

      payload && this.dataCallback(payload);

      this.sendPMResponse({
        type: event.data.type,
        dialHost: event.origin,
        requestId: event.data.requestId,
      });
    }
  }

  /**
   * Sends 'READY' event via postMessage to the DIAL CHAT to notify that Visualizer loaded
   */
  public sendReady() {
    this.send({ type: VisualizerConnectorEvents.ready });
  }

  /**
   * Sends 'READY_TO_INTERACT' event via postMessage to the DIAL CHAT to notify that Visualizer ready to get data
   */
  public sendReadyToInteract() {
    this.send({ type: VisualizerConnectorEvents.readyToInteract });
  }

  /**
   * Send message into the selected conversations
   * @param content {string} text of message that should be sent to the chat
   */
  public async sendMessage(content: string) {
    this.send({
      type: VisualizerConnectorEvents.sendMessage,
      payload: { message: content },
    });
  }

  /**
   * Destroys ChatVisualizerConnector
   */
  destroy() {
    window.removeEventListener('message', this.postMessageListener);
  }
}
