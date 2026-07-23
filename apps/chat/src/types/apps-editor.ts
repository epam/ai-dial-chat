import type { CatalogItemCredentials } from '@epam/ai-dial-catalog';
import type { ToolsetCredentialsLevel } from './toolsets';

export enum AppsEditorQuery {
  Step = 'step',
  Schema = 'schema',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
  AppId = 'appId',
}

export enum AppsEditorStep {
  General = 'general',
  Settings = 'settings',
}

export enum AppsEditorEvent {
  /** Sent once the embedded QuickApps iframe's UI has rendered. Controls only the loading-spinner overlay — it does NOT indicate the iframe's data model is loaded/safe to save; see `ReadyToSave`. */
  ReadyToInteract = 'readyToInteract',
  /**
   * Sent by the embedded QuickApps iframe once its session has resolved and
   * the user is not authenticated (or the session errored). In this case the
   * iframe never becomes safe to save (`ReadyToSave` will not arrive), so the
   * host treats this as an expected non-ready state rather than a failure —
   * see the "Settings step readiness gates Save and Preview" requirement in
   * the `quick-app-authoring` spec.
   */
  LoggedOut = 'loggedOut',
  /**
   * Sent by the embedded QuickApps iframe once its own internal application
   * model has finished loading and validating, and it is safe for the host
   * to send `TriggerSave`. Distinct from `ReadyToInteract` (UI rendered) —
   * gates the Save/Preview buttons. May be sent more than once (e.g. after
   * an internal reload); the host takes the latest occurrence at face value.
   */
  ReadyToSave = 'readyToSave',
  UpdatedSuccess = 'updatedApplicationSuccess',
  TriggerSave = 'TRIGGER_SAVE',
  SaveSuccess = 'SAVE_SUCCESS',
  SaveError = 'SAVE_ERROR',
  /** Sent by the embedded QuickApps iframe to request a toolset OAuth login, carrying `{ toolsetId: string }`. */
  RequestToolsetLogin = 'REQUEST_TOOLSET_LOGIN',
  /** Sent back to the iframe with the outcome of a `RequestToolsetLogin`. */
  ToolsetLoginResult = 'TOOLSET_LOGIN_RESULT',
  /** Sent by the embedded QuickApps iframe to request a toolset logout, carrying `{ toolsetId: string }`. */
  RequestToolsetLogout = 'REQUEST_TOOLSET_LOGOUT',
  /** Sent back to the iframe with the outcome of a `RequestToolsetLogout`. */
  ToolsetLogoutResult = 'TOOLSET_LOGOUT_RESULT',
}

/**
 * Refreshed toolset credentials/status, fetched via the same
 * `/api/v1/deployments/{id}/details` endpoint Catalog's Details panel uses
 * to refresh after login/logout. Present only when the refetch succeeds;
 * absent (not a hard failure) if it errors, since the `success` flag
 * carried alongside it is already authoritative on its own.
 */
type RefreshedToolsetCredentials = CatalogItemCredentials | undefined;

/** Payload of a `ToolsetLoginResult` message posted back to the QuickApps iframe. */
export interface ToolsetLoginResultPayload {
  type: AppsEditorEvent.ToolsetLoginResult;
  toolsetId: string;
  success: boolean;
  credentialsLevel?: ToolsetCredentialsLevel;
  reason?: string;
  credentials?: RefreshedToolsetCredentials;
}

/** Payload of a `ToolsetLogoutResult` message posted back to the QuickApps iframe. */
export interface ToolsetLogoutResultPayload {
  type: AppsEditorEvent.ToolsetLogoutResult;
  toolsetId: string;
  success: boolean;
  credentialsLevel?: ToolsetCredentialsLevel;
  reason?: string;
  credentials?: RefreshedToolsetCredentials;
}

/**
 * Current General-step values carried on a `TriggerSave` message so the embedded
 * QuickApps editor can merge them into the single save it already performs, instead of
 * the host persisting them separately. Deliberately excludes `version` — Settings-step
 * save must not alter the application's version.
 */
export interface TriggerSaveGeneralPayload {
  name: string;
  description?: string;
  iconUrl?: string;
  topics?: string[];
  intro?: string;
}

/** Payload of a `TriggerSave` message posted to the embedded QuickApps iframe. */
export interface TriggerSaveMessage {
  type: AppsEditorEvent.TriggerSave;
  general?: TriggerSaveGeneralPayload;
}

/**
 * Payload of a `SaveSuccess` message posted by the embedded QuickApps iframe once a
 * `TriggerSave` completes successfully. `hasChanges` reflects whether any user-editable
 * field (Settings-step configuration or a forwarded `general` field) actually changed as
 * part of that save, excluding server-managed metadata such as `updatedAt`. Absent on
 * embedded editors that predate this contract — treat as `false` in that case.
 */
export interface SaveSuccessMessage {
  type: AppsEditorEvent.SaveSuccess;
  hasChanges?: boolean;
}
