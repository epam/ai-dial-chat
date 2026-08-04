/*
 * An `external-service/signin` event's `params.url` is shaped
 * `applications/{bucket}/{app}/external_services/{name}`. `{name}` is a real,
 * distinct identifier — it keys the application's own `external_services`
 * map (each entry has its own `display_name`/`auth_settings`), and DIAL Core
 * requires the *full* url (not just the `appId` prefix) as the `url` field
 * for `externalServiceSignIn`/`externalServiceSignOut` — confirmed by Core
 * rejecting a bare application id with "Invalid external service scope id".
 */
const EXTERNAL_SERVICE_URL_SEGMENT = '/external_services/';

export interface ParsedExternalServiceUrl {
  /** The application's own resource id — used for `GET /api/v1/deployments/{appId}/details`. */
  appId: string;
  /** Key into `applicationDetails.externalServices` for this specific dependency. */
  serviceName: string;
}

export const parseExternalServiceUrl = (
  url: string,
): ParsedExternalServiceUrl | null => {
  const index = url.indexOf(EXTERNAL_SERVICE_URL_SEGMENT);
  if (index === -1) return null;

  const appId = url.slice(0, index);
  const serviceName = url.slice(index + EXTERNAL_SERVICE_URL_SEGMENT.length);
  if (!appId || !serviceName) return null;

  return { appId, serviceName };
};

/** Reconstructs the exact scope id Core expects as `ResourceSignInRequest`/`ResourceSignOutRequest`'s `url` field. */
export const buildExternalServiceScopeId = (
  appId: string,
  serviceName: string,
): string => `${appId}${EXTERNAL_SERVICE_URL_SEGMENT}${serviceName}`;

/**
 * Derives a human-readable fallback label from an external service's raw
 * `serviceName` when metadata hasn't resolved yet — mirrors
 * `getToolsetFallbackName`'s percent-decoding behavior.
 */
export const getExternalServiceFallbackName = (serviceName: string): string => {
  try {
    return decodeURIComponent(serviceName);
  } catch {
    return serviceName;
  }
};
