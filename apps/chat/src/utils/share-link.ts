import { ShareLinkAccess, ShareLinkData } from '@epam/ai-dial-share';
import { createShareLink as createShareLinkRequest } from '../server-api/share.api';

/*
 * The backend resolves `url` against its own configured host
 * (`AUTH_CALLBACK_BASE_URL`), which does not always match the origin the
 * frontend is actually being served from (e.g. local dev runs chat-api and
 * the SPA on different ports). Re-anchoring the path to `window.location.origin`
 * keeps the displayed/copied link pointing at the host the user is on.
 */
const withCurrentOrigin = (url: string): string => {
  const resolved = new URL(url, window.location.origin);
  return `${window.location.origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
};

/**
 * Resolves share-link data for a catalog entity by calling the backend
 * `POST /api/v1/share` endpoint through the generated API client.
 */
export const getShareLink = async (
  itemId: string,
  access: ShareLinkAccess = ShareLinkAccess.View,
): Promise<ShareLinkData> => {
  const response = await createShareLinkRequest({ itemId, access });
  return {
    url: withCurrentOrigin(response.url),
    expiresInDays: response.expiresInDays,
    access: response.access as ShareLinkAccess,
  };
};
