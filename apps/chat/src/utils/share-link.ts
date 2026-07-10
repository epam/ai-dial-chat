import { ShareLinkAccess, ShareLinkData } from '../types/share';

const MOCK_NETWORK_DELAY_MS = 400;
const MOCK_EXPIRES_IN_DAYS = 3;

/**
 * Resolves share-link data for a catalog entity.
 *
 * Mock implementation — swap the body for a real API call (e.g. a new
 * `server-api/share.api.ts` module) without changing the signature; callers
 * (`useShareLink`) only depend on this function's shape.
 */
export const getShareLink = (itemId: string): Promise<ShareLinkData> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        url: `https://chat.dialx.ai/marketplace/share/${itemId}`,
        expiresInDays: MOCK_EXPIRES_IN_DAYS,
        access: ShareLinkAccess.View,
      });
    }, MOCK_NETWORK_DELAY_MS);
  });
