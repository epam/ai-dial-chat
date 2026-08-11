import { ShareLinkResponseDtoAccessEnum } from '@epam/ai-dial-chat-api-client';
import { ShareLinkAccess, ShareLinkData } from '@epam/ai-dial-share';
import { createShareLink as createShareLinkRequest } from '../server-api/share.api';

const toShareLinkAccess = (
  access: ShareLinkResponseDtoAccessEnum[],
): ShareLinkAccess[] =>
  access.map((level) =>
    level === ShareLinkResponseDtoAccessEnum.Edit
      ? ShareLinkAccess.Edit
      : ShareLinkAccess.View,
  );

/*
 * The backend resolves `url` against its own configured host
 * (`AUTH_CALLBACK_BASE_URL`), which does not always match the origin the
 * frontend is actually being served from (e.g. local dev runs chat-api and
 * the SPA on different ports). Re-anchoring the path to `window.location.origin`
 * keeps the displayed/copied link pointing at the host the user is on.
 */
const withCurrentOrigin = (url: string, origin: string): string => {
  const resolved = new URL(url, origin);
  return `${origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
};

/**
 * Resolves share-link data for a catalog entity by calling the backend
 * `POST /api/v1/share` endpoint through the generated API client.
 */
export const getShareLink = async (
  itemId: string,
  access: ShareLinkAccess[] = [ShareLinkAccess.View],
  origin: string = window.location.origin,
): Promise<ShareLinkData> => {
  const response = await createShareLinkRequest({ itemId, access });
  return {
    url: withCurrentOrigin(response.url, origin),
    expiresInDays: response.expiresInDays,
    access: toShareLinkAccess(response.access),
  };
};
