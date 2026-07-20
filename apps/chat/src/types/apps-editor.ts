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
  ReadyToInteract = 'readyToInteract',
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
