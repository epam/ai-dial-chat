import {
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

export interface AttachmentData {
  mimeType: string;
  visualizerData: Record<string, unknown>;
}

export class ChatVisualizerConnector {
  protected dialHost: string;
  protected appName: string;
  protected dataCallback: (visualizerData: AttachmentData) => void;

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

  public sendReady() {
    window?.parent.postMessage(
      { type: `${this.appName}/${VisualizerConnectorEvents.ready}` },
      this.dialHost,
    );
  }

  public sendReadyToInteract() {
    window?.parent.postMessage(
      { type: `${this.appName}/${VisualizerConnectorEvents.readyToInteract}` },
      this.dialHost,
    );
  }

  destroy() {
    window.removeEventListener('message', this.postMessageListener);
  }
}
