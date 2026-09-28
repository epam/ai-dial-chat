import type { DialToolsetAuthSettingsDto } from '@epam/ai-dial-chat-api-client';
import { PUBLIC_BUCKET } from '@epam/ai-dial-chat-shared';
import { ToolsetCredentialsLevel } from './types';

const TOOLSETS_ID_PREFIX = 'toolsets/';

/**
 * Percent-encodes each `/`-separated segment of a toolset id so it satisfies
 * the backend's `DEPLOYMENT_ID_PATTERN`/`TOOLSET_URL_PATTERN` (spaces and
 * other reserved characters must already be percent-encoded — e.g. `%20`,
 * not a real space — before this value is used against the toolsets API;
 * `/` stays a literal path separator). Externally-sourced ids — the raw,
 * human-readable id an embedded iframe sends over `postMessage`
 * (e.g. `toolsets/<bucket>/My Toolset__1.0`) — arrive unencoded, unlike the
 * already-encoded `id`/`toolset` field `listToolsets()`/`DialToolsetDto`
 * returns. Mirrors `encodeDeploymentId` (`deployment-id.ts`), which exists
 * for the identical reason on the applications side.
 */
export const encodeToolsetId = (id: string): string =>
  id
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

/**
 * Inverse of `encodeToolsetId` — decodes each `/`-separated segment back to
 * its raw, human-readable form. A segment that isn't valid percent-encoding
 * is passed through unchanged rather than throwing, since this decodes
 * externally-sourced ids (broadcast toolset-login events).
 */
export const decodeToolsetId = (id: string): string =>
  id
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');

/** Whether a toolset id belongs to the `public` bucket (shared with all users), mirroring the legacy `isEntityIdPublic` check. */
export const isPublicToolsetId = (toolsetId: string): boolean => {
  if (!toolsetId.startsWith(TOOLSETS_ID_PREFIX)) return false;
  const bucket = toolsetId.slice(TOOLSETS_ID_PREFIX.length).split('/')[0];
  return bucket === PUBLIC_BUCKET;
};

/**
 * Resolves which credentials level a toolset's login applies to, per DIAL
 * Core's public/private toolset convention: a `public`-bucket toolset is
 * shared credentials-wise at `User` level, while a private/workspace toolset
 * is scoped at `Global` level. Every surface that drives a toolset login
 * (the sign-in-interrupt dialog, the QuickApps editor iframe bridge,
 * `useToolsetLogin`) must resolve the level this way rather than assuming one.
 */
export const resolveToolsetCredentialsLevel = (
  toolsetId: string,
): ToolsetCredentialsLevel.User | ToolsetCredentialsLevel.Global =>
  isPublicToolsetId(toolsetId)
    ? ToolsetCredentialsLevel.User
    : ToolsetCredentialsLevel.Global;

/**
 * Picks the auth-status field matching one credentials level out of a
 * toolset's `authSettings` — DIAL Core reports `userLevelAuthStatus` and
 * `globalAuthStatus` as independent fields rather than one status keyed by
 * level.
 */
export const selectToolsetAuthStatus = (
  authSettings:
    | Pick<
        DialToolsetAuthSettingsDto,
        'userLevelAuthStatus' | 'globalAuthStatus'
      >
    | undefined,
  credentialsLevel: ToolsetCredentialsLevel,
): string | undefined =>
  credentialsLevel === ToolsetCredentialsLevel.User
    ? authSettings?.userLevelAuthStatus
    : authSettings?.globalAuthStatus;
