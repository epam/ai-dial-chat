import type {
  AppsEditorMessage,
  ChatVisualizerCallbacks,
  VisualizerAttachmentData,
  VisualizerConnectorRequest,
  VisualizerGroupedAttachmentsData,
} from '../models/visualizer-connector';
import {
  AppsEditorEvents,
  AppsEditorMessages,
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '../types/visualizer-connector';

const WILDCARD_HOST = '*';

const EDITOR_MESSAGE_TYPES = new Set<unknown>(
  Object.values(AppsEditorMessages),
);

const RESPONSE_SUFFIX = '/RESPONSE';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasKeys = (value: Record<string, unknown>, keys: string[]): boolean =>
  keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

/* `https://chat.example.com/` and `https://chat.example.com` name the same origin; `event.origin` never ends in `/`. */
const normalizeHost = (host: string): string => {
  /* Linear trailing-slash trim; `/\/+$/` backtracks polynomially on many `/`. */
  let end = host.length;
  while (end > 0 && host[end - 1] === '/') {
    end--;
  }
  return host.slice(0, end);
};

/** Event types `ChatVisualizerConnector.send()` posts, each prefixed `${appName}/`. */
export type ChatVisualizerEventType =
  VisualizerConnectorEvents | AppsEditorEvents;

/**
 * The iframe half of the visualizer protocol: runs inside a visualizer or application-editor iframe
 * and exchanges namespaced messages with DIAL Chat.
 */
export class ChatVisualizerConnector {
  /** Allowed and target hosts: outgoing messages go to each; incoming ones must come from one. */
  protected dialHosts: string[];
  /** The first of `dialHosts`, kept for callers written against npm `0.49.0`. */
  protected dialHost: string;
  protected appName: string;
  protected callbacks: ChatVisualizerCallbacks;

  /**
   * Starts listening for host messages. It announces nothing: call `sendReady()` and
   * `sendReadyToInteract()` once the iframe can take them.
   *
   * @param dialHost DIAL Chat origin(s); `'*'` as the first entry accepts any origin.
   * @param appName Protocol namespace; must equal the host's visualizer `title` or editor application name.
   * @param callbacks An `onData` callback, or an object with `onData` / `onGroupedData`.
   */
  constructor(
    dialHost: string | string[],
    appName: string,
    callbacks:
      ((data: VisualizerAttachmentData) => void) | ChatVisualizerCallbacks,
  ) {
    const hosts = (Array.isArray(dialHost) ? dialHost : [dialHost]).map(
      normalizeHost,
    );
    if (!hosts.length) {
      throw new Error('[ChatVisualizerConnector] No dial host(s) provided');
    }
    this.dialHosts = hosts;
    this.dialHost = hosts[0];
    this.appName = appName;
    this.callbacks =
      typeof callbacks === 'function' ? { onData: callbacks } : callbacks;
    window.addEventListener('message', this.postMessageListener, false);
  }

  /** Posts `${appName}/${type}` to every configured host, or only to `dialHost` when given. */
  send({
    type,
    payload,
    dialHost,
  }: {
    type: ChatVisualizerEventType;
    payload?: unknown;
    dialHost?: string;
  }): void {
    if (!window?.parent) {
      throw new Error(
        `[${this.appName}] There is no parent window to send requests`,
      );
    }
    const targets = dialHost ? [dialHost] : this.dialHosts;
    targets.forEach((target) => {
      window.parent.postMessage(
        { type: `${this.appName}/${type}`, payload },
        target,
      );
    });
  }

  /**
   * Posts an application-editor message as is — no `${appName}/` prefix — to every configured host,
   * or only to `dialHost` when given. Fields go where the host reads them (see `AppsEditorMessages`).
   * @deprecated Use `AppsEditorClient` for direction-safe messages and validated incoming requests.
   */
  sendEditorMessage(
    message: { type: AppsEditorMessages } & Record<string, unknown>,
    dialHost?: string,
  ): void {
    if (!window?.parent) {
      throw new Error(
        `[${this.appName}] There is no parent window to send requests`,
      );
    }
    const targets = dialHost ? [dialHost] : this.dialHosts;
    targets.forEach((target) => window.parent.postMessage(message, target));
  }

  /** Acknowledges a host request: posts `${type}/RESPONSE` with its `requestId` back to `dialHost`. */
  sendPMResponse({
    type,
    requestId,
    payload,
    dialHost,
  }: VisualizerConnectorRequest & { dialHost: string }): void {
    window?.parent.postMessage(
      { type: `${type}${RESPONSE_SUFFIX}`, requestId, payload },
      dialHost,
    );
  }

  /** Handles one inbound `message`; bound, so it can be added and removed as a listener. */
  postMessageListener = (
    event: MessageEvent<VisualizerConnectorRequest>,
  ): void => {
    /*
     * Outside a frame `window.parent` is `window`, so every message this connector posts comes back
     * here; without this an editor would hear its own SAVE_SUCCESS as a host message.
     */
    if (event.source === window) return;
    if (!this.isAllowedOrigin(event.origin)) return;
    const { data } = event;
    if (!isObject(data) || typeof data.type !== 'string') return;

    // Checked before the payload test: TRIGGER_SAVE may carry no `payload` at all.
    if (EDITOR_MESSAGE_TYPES.has(data.type)) {
      this.callbacks.onEditorMessage?.(
        data as unknown as AppsEditorMessage,
        event.origin,
      );
      return;
    }

    if (
      !data.type.startsWith(`${this.appName}/`) ||
      data.type.endsWith(RESPONSE_SUFFIX)
    )
      return;
    const payload = isObject(data.payload) ? data.payload : null;

    switch (data.type.slice(this.appName.length + 1)) {
      case VisualizerConnectorRequests.SendVisualizeData:
        /* `mimeType` is not required: Chat 0.x's application editor sends `{ visualizerData: { layout } }`
           alone, and npm 0.49.0 dropped that layout while still acknowledging it. */
        if (payload && hasKeys(payload, ['visualizerData'])) {
          this.callbacks.onData?.(
            payload as unknown as VisualizerAttachmentData,
          );
        }
        break;
      case VisualizerConnectorRequests.SendGroupedVisualizeData:
        if (payload && hasKeys(payload, ['attachments', 'layout'])) {
          this.callbacks.onGroupedData?.(
            payload as unknown as VisualizerGroupedAttachmentsData,
          );
        }
        break;
      default:
        /* Any other request still gets its `/RESPONSE`, or the host's send() waits out its timeout.
           Unsolicited messages carry no `requestId` and need no answer. */
        if (data.requestId === undefined) return;
    }

    this.sendPMResponse({
      type: data.type,
      requestId: data.requestId,
      dialHost: event.origin,
    });
  };

  /** Posts `${appName}/READY`: the iframe has loaded. */
  sendReady(): void {
    this.send({ type: VisualizerConnectorEvents.Ready });
  }

  /** Posts `${appName}/READY_TO_INTERACT`: the iframe can take data. */
  sendReadyToInteract(): void {
    this.send({ type: VisualizerConnectorEvents.ReadyToInteract });
  }

  /** Posts `${appName}/readyToSave`: an application editor's model is loaded and safe to save. */
  sendReadyToSave(): void {
    this.send({ type: AppsEditorEvents.ReadyToSave });
  }

  /** Posts `${appName}/loggedOut`: an application editor's session resolved signed out. */
  sendLoggedOut(): void {
    this.send({ type: AppsEditorEvents.LoggedOut });
  }

  /** Posts `${appName}/SEND_MESSAGE` with `{ message: content }` into the selected conversations. */
  async sendMessage(content: string): Promise<void> {
    this.send({
      type: VisualizerConnectorEvents.SendMessage,
      payload: { message: content },
    });
  }

  /** Stops listening for host messages. A second call is a no-op. */
  destroy(): void {
    window.removeEventListener('message', this.postMessageListener);
  }

  /*
   * Exact origin match. npm 0.49.0 compared with `allowedHost.startsWith(event.origin)`, which let
   * `https://chat.example.co` through for a configured `https://chat.example.com`.
   */
  private isAllowedOrigin(origin: string): boolean {
    return (
      this.dialHosts[0] === WILDCARD_HOST || this.dialHosts.includes(origin)
    );
  }
}
