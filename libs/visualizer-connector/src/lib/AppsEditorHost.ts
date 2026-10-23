import type {
  AppsEditorClientMessage,
  AppsEditorHostMessage,
} from '../models/apps-editor';
import {
  normalizeAppsEditorOrigin,
  parseAppsEditorClientMessage,
} from './apps-editor-protocol';

/** Endpoint and callbacks for an application editor hosted in an existing iframe. */
export interface AppsEditorHostOptions {
  /** The editor iframe's content window. */
  targetWindow: Window;
  /** The editor's absolute origin or URL; wildcard and opaque origins are rejected. */
  targetOrigin: string;
  /** Namespace shared with the editor for lifecycle events. */
  applicationName: string;
  /** Receives validated editor messages with unprefixed lifecycle event types. */
  onMessage: (message: AppsEditorClientMessage) => void;
  /** Receives any message from the configured window and origin, including unknown messages. */
  onActivity?: () => void;
}

/** Exchanges typed editor messages with an existing iframe without managing its DOM or readiness. */
export class AppsEditorHost<TGeneral = unknown, TCredentials = unknown> {
  private readonly targetWindow: Window;
  private readonly targetOrigin: string;
  private readonly applicationName: string;
  private readonly onMessage: AppsEditorHostOptions['onMessage'];
  private readonly onActivity: AppsEditorHostOptions['onActivity'];
  private isDestroyed = false;

  /** Starts listening for messages from the configured editor endpoint. */
  constructor(options: AppsEditorHostOptions) {
    this.targetWindow = options.targetWindow;
    this.targetOrigin = normalizeAppsEditorOrigin(options.targetOrigin);
    this.applicationName = options.applicationName;
    this.onMessage = options.onMessage;
    this.onActivity = options.onActivity;
    window.addEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent<unknown>): void => {
    if (
      this.isDestroyed ||
      event.source !== this.targetWindow ||
      event.origin !== this.targetOrigin
    ) {
      return;
    }

    this.onActivity?.();
    if (this.isDestroyed) return;
    const message = parseAppsEditorClientMessage(
      event.data,
      this.applicationName,
    );
    if (message) this.onMessage(message);
  };

  /** Posts a host message to the editor; does nothing after destroy(). */
  send(message: AppsEditorHostMessage<TGeneral, TCredentials>): void {
    if (this.isDestroyed) return;
    this.targetWindow.postMessage(message, this.targetOrigin);
  }

  /** Stops receiving and sending messages; repeated calls are harmless. */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    window.removeEventListener('message', this.handleMessage);
  }
}
