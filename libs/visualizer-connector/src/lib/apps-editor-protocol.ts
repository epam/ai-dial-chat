import type {
  AppsEditorClientMessage,
  AppsEditorHostMessage,
} from '../models/apps-editor';
import {
  AppsEditorEvents,
  AppsEditorMessages,
} from '../types/visualizer-connector';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Returns an exact, non-opaque origin or throws for an invalid target. */
export const normalizeAppsEditorOrigin = (value: string): string => {
  const origin = new URL(value).origin;
  if (origin === 'null') {
    throw new Error('An application editor requires a non-opaque origin');
  }
  return origin;
};

/** Validates editor-to-host wire messages and normalizes supported legacy field placements. */
export const parseAppsEditorClientMessage = (
  data: unknown,
  applicationName: string,
): AppsEditorClientMessage | null => {
  if (!isRecord(data)) return null;
  const payload = isRecord(data.payload) ? data.payload : undefined;

  switch (data.type) {
    case `${applicationName}/${AppsEditorEvents.ReadyToInteract}`:
      return { type: AppsEditorEvents.ReadyToInteract };
    case `${applicationName}/${AppsEditorEvents.ReadyToSave}`:
      return { type: AppsEditorEvents.ReadyToSave };
    case `${applicationName}/${AppsEditorEvents.LoggedOut}`:
      return { type: AppsEditorEvents.LoggedOut };
    case `${applicationName}/${AppsEditorEvents.UpdatedApplicationSuccess}`:
      return {
        type: AppsEditorEvents.UpdatedApplicationSuccess,
        ...(payload ? { payload: { application: payload.application } } : {}),
      };
    case AppsEditorMessages.SaveSuccess:
      return {
        type: AppsEditorMessages.SaveSuccess,
        hasChanges: data.hasChanges === true,
      };
    case AppsEditorMessages.SaveError: {
      const error = data.error ?? payload?.error ?? '';
      return typeof error === 'string'
        ? { type: AppsEditorMessages.SaveError, error }
        : null;
    }
    case AppsEditorMessages.ValidityState:
      return typeof payload?.isValid === 'boolean'
        ? {
            type: AppsEditorMessages.ValidityState,
            payload: { isValid: payload.isValid },
          }
        : null;
    case AppsEditorMessages.DirtyState: {
      const isDirty = payload?.isDirty ?? data.isDirty;
      return typeof isDirty === 'boolean'
        ? { type: AppsEditorMessages.DirtyState, payload: { isDirty } }
        : null;
    }
    case AppsEditorMessages.RequestToolsetLogin:
    case AppsEditorMessages.RequestToolsetLogout:
      return isIdentifier(data.toolsetId)
        ? { type: data.type, toolsetId: data.toolsetId }
        : null;
    case AppsEditorMessages.RequestApplicationCredentials:
      return isIdentifier(data.appId)
        ? { type: data.type, appId: data.appId }
        : null;
    case AppsEditorMessages.RequestExternalServiceLogin:
      return isIdentifier(data.appId) &&
        isIdentifier(data.serviceId) &&
        typeof data.offlineUsageConsent === 'boolean'
        ? {
            type: data.type,
            appId: data.appId,
            serviceId: data.serviceId,
            offlineUsageConsent: data.offlineUsageConsent,
          }
        : null;
    default:
      return null;
  }
};

/** Validates host-to-editor protocol fields; General values and credential status remain opaque. */
export const parseAppsEditorHostMessage = (
  data: unknown,
): AppsEditorHostMessage | null => {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case AppsEditorMessages.TriggerSave:
      return { type: data.type, general: data.general };
    case AppsEditorMessages.ToolsetLoginResult:
    case AppsEditorMessages.ToolsetLogoutResult: {
      const { toolsetId, success, credentialsLevel, reason, credentials } =
        data;
      if (
        !isIdentifier(toolsetId) ||
        typeof success !== 'boolean' ||
        (credentialsLevel !== undefined &&
          typeof credentialsLevel !== 'string') ||
        (reason !== undefined && typeof reason !== 'string')
      ) {
        return null;
      }
      return {
        type: data.type,
        toolsetId,
        success,
        credentialsLevel,
        reason,
        credentials,
      };
    }
    case AppsEditorMessages.ExternalServiceLoginResult: {
      const { appId, serviceId, success, reason } = data;
      if (
        !isIdentifier(appId) ||
        !isIdentifier(serviceId) ||
        typeof success !== 'boolean' ||
        (reason !== undefined && typeof reason !== 'string')
      ) {
        return null;
      }
      return { type: data.type, appId, serviceId, success, reason };
    }
    default:
      return null;
  }
};

/** Serializes normalized editor messages using the existing namespaced lifecycle wire format. */
export const serializeAppsEditorClientMessage = (
  message: AppsEditorClientMessage,
  applicationName: string,
): { type: string } => {
  switch (message.type) {
    case AppsEditorEvents.ReadyToInteract:
    case AppsEditorEvents.ReadyToSave:
    case AppsEditorEvents.LoggedOut:
    case AppsEditorEvents.UpdatedApplicationSuccess:
      return { ...message, type: `${applicationName}/${message.type}` };
    default:
      return message;
  }
};
