import { ShareLinkAccess, ShareLinkData } from '@epam/ai-dial-share';
import { createShareLink as createShareLinkRequest } from '../server-api/share.api';

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
    url: response.url,
    expiresInDays: response.expiresInDays,
    access: response.access as ShareLinkAccess,
  };
};
