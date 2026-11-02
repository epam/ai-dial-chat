import type {
  AppsEditorClientMessage,
  AppsEditorHostMessage,
} from '../models/apps-editor';
import {
  AppsEditorEvents,
  AppsEditorMessages,
} from '../types/visualizer-connector';
import {
  normalizeAppsEditorOrigin,
  parseAppsEditorHostMessage,
  serializeAppsEditorClientMessage,
} from './apps-editor-protocol';

/** Endpoint and callbacks for the application running inside an editor iframe. */
export interface AppsEditorClientOptions {
  /** The hosting window. Defaults to window.parent. */
  hostWindow?: Window;
  /** The host's absolute origin or URL; wildcard and opaque origins are rejected. */
  hostOrigin: string;
  /** Namespace shared with the host for lifecycle events. */
  applicationName: string;
  /** Receives validated host messages; application-specific general and credentials remain unknown. */
  onMessage?: (message: AppsEditorHostMessage) => void;
}

/** Sends editor lifecycle events and receives host messages without announcing readiness automatically. */
export class AppsEditorClient {
  private readonly hostWindow: Window;
  private readonly hostOrigin: string;
  private readonly applicationName: string;
  private readonly onMessage: AppsEditorClientOptions['onMessage'];
  private isDestroyed = false;

  /** Starts listening for messages from the configured host endpoint. */
  constructor(options: AppsEditorClientOptions) {
    this.hostWindow = options.hostWindow ?? window.parent;
    this.hostOrigin = normalizeAppsEditorOrigin(options.hostOrigin);
    this.applicationName = options.applicationName;
    this.onMessage = options.onMessage;
    window.addEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent<unknown>): void => {
    if (
      this.isDestroyed ||
      event.source !== this.hostWindow ||
      event.origin !== this.hostOrigin
    ) {
      return;
    }

    const message = parseAppsEditorHostMessage(event.data);
    if (message) this.onMessage?.(message);
  };

  /** Posts an editor message using the shared wire format; does nothing after destroy(). */
  send(message: AppsEditorClientMessage): void {
    if (this.isDestroyed) return;
    this.hostWindow.postMessage(
      serializeAppsEditorClientMessage(message, this.applicationName),
      this.hostOrigin,
    );
  }

  /** Reports that the editor's interface has rendered. */
  sendReadyToInteract(): void {
    this.send({ type: AppsEditorEvents.ReadyToInteract });
  }

  /** Reports that the editor's application model is loaded and safe to save. */
  sendReadyToSave(): void {
    this.send({ type: AppsEditorEvents.ReadyToSave });
  }

  /** Reports that the editor's session is signed out. */
  sendLoggedOut(): void {
    this.send({ type: AppsEditorEvents.LoggedOut });
  }

  /** Reports an intermediate application update, with optional application data. */
  sendUpdatedApplication(application?: unknown): void {
    this.send({
      type: AppsEditorEvents.UpdatedApplicationSuccess,
      payload: { application },
    });
  }

  /** Reports a successful save; hasChanges defaults to false. */
  sendSaveSuccess(hasChanges = false): void {
    this.send({ type: AppsEditorMessages.SaveSuccess, hasChanges });
  }

  /** Reports a failed save with an application-provided explanation. */
  sendSaveError(error: string): void {
    this.send({ type: AppsEditorMessages.SaveError, error });
  }

  /** Reports whether the editor's current form values are valid. */
  sendValidityState(isValid: boolean): void {
    this.send({ type: AppsEditorMessages.ValidityState, payload: { isValid } });
  }

  /** Reports whether the editor has unsaved changes. */
  sendDirtyState(isDirty: boolean): void {
    this.send({ type: AppsEditorMessages.DirtyState, payload: { isDirty } });
  }

  /** Requests host-managed authentication for a toolset. */
  requestToolsetLogin(toolsetId: string): void {
    this.send({ type: AppsEditorMessages.RequestToolsetLogin, toolsetId });
  }

  /** Requests host-managed logout for a toolset. */
  requestToolsetLogout(toolsetId: string): void {
    this.send({ type: AppsEditorMessages.RequestToolsetLogout, toolsetId });
  }

  /** Requests the host's credential form for an application. */
  requestApplicationCredentials(appId: string): void {
    this.send({
      type: AppsEditorMessages.RequestApplicationCredentials,
      appId,
    });
  }

  /**
   * Requests a host-run, user-level sign-in to one external service of an application. `offlineUsageConsent`
   * is the person's choice collected by the editor; the host answers with `ExternalServiceLoginResult`.
   */
  requestExternalServiceLogin(
    appId: string,
    serviceId: string,
    options: { offlineUsageConsent: boolean },
  ): void {
    this.send({
      type: AppsEditorMessages.RequestExternalServiceLogin,
      appId,
      serviceId,
      offlineUsageConsent: options.offlineUsageConsent,
    });
  }

  /** Stops receiving and sending messages; repeated calls are harmless. */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    window.removeEventListener('message', this.handleMessage);
  }
}
