import type { CatalogItemCredentials } from '@epam/ai-dial-catalog';
import type { LocaleTextEntryDto } from '@epam/ai-dial-chat-api-client';
import { type ToolsetCredentialsLevel } from '@epam/ai-dial-chat-hooks';
import {
  AppsEditorEvents,
  AppsEditorMessages,
} from '@epam/ai-dial-visualizer-connector';

export enum AppsEditorQuery {
  Schema = 'schema',
  AppId = 'appId',
}

/** Query params the host sends to the embedded QuickApps iframe URL. */
export enum AppsEditorIframeQuery {
  AuthProvider = 'authProvider',
  Id = 'id',
  Theme = 'theme',
  ApplicationCredentials = 'applicationCredentials',
  ApplicationName = 'applicationName',
  ExternalServiceLogin = 'externalServiceLogin',
}

/** Shared editor wire values, retaining the app's existing event names. */
export const AppsEditorEvent = {
  ...AppsEditorEvents,
  ...AppsEditorMessages,
  UpdatedSuccess: AppsEditorEvents.UpdatedApplicationSuccess,
} as const;

export type AppsEditorEvent =
  (typeof AppsEditorEvent)[keyof typeof AppsEditorEvent];

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
  type: AppsEditorMessages.ToolsetLoginResult;
  toolsetId: string;
  success: boolean;
  credentialsLevel?: ToolsetCredentialsLevel;
  reason?: string;
  credentials?: RefreshedToolsetCredentials;
}

/** Payload of a `ToolsetLogoutResult` message posted back to the QuickApps iframe. */
export interface ToolsetLogoutResultPayload {
  type: AppsEditorMessages.ToolsetLogoutResult;
  toolsetId: string;
  success: boolean;
  credentialsLevel?: ToolsetCredentialsLevel;
  reason?: string;
  credentials?: RefreshedToolsetCredentials;
}

/** Why an external-service login requested by the embedded editor did not complete. */
export enum ExternalServiceLoginFailureReason {
  PopupBlocked = 'popup-blocked',
  NotFound = 'not-found',
  UnsupportedAuthType = 'unsupported-auth-type',
  Cancelled = 'cancelled',
  AdminConsentRequired = 'admin-consent-required',
  OfflineUnavailable = 'offline-unavailable',
  Failure = 'failure',
}

/** Payload of an `ExternalServiceLoginResult` message posted back to the embedded editor. */
export interface ExternalServiceLoginResultPayload {
  type: AppsEditorMessages.ExternalServiceLoginResult;
  /** The application id exactly as the editor sent it. */
  appId: string;
  /** The external-service id exactly as the editor sent it. */
  serviceId: string;
  success: boolean;
  reason?: ExternalServiceLoginFailureReason;
}

/**
 * Current General-step values carried on a `TriggerSave` message so the embedded
 * QuickApps editor can merge them into the single save it already performs, instead of
 * the host persisting them separately. Includes `display_version` (the human-readable
 * version label). Deliberately excludes the backend `version` field — Settings-step save
 * must not alter the application's internal version.
 */
export interface TriggerSaveGeneralPayload {
  name: string;
  description?: string;
  iconUrl?: string;
  topics?: string[];
  display_version?: string;
  /** Additional-locale name/description entries, keyed by locale code. Omitted when no additional locales are configured — see {@link composeLocalePayload}. */
  locales?: LocaleTextEntryDto[];
  /** The content locale `name`/`description` are authored in. Set only alongside `locales`, mirroring {@link composeLocalePayload}'s pairing with `PRIMARY_LOCALE`. */
  primaryLocale?: string;
}

/** Payload of a `TriggerSave` message posted to the embedded QuickApps iframe. */
export interface TriggerSaveMessage {
  type: AppsEditorMessages.TriggerSave;
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
  type: AppsEditorMessages.SaveSuccess;
  hasChanges?: boolean;
}
