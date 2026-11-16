import type {
  CelebrationCatalogDto,
  CelebrationPackDto,
} from '@epam/ai-dial-chat-api-client';
import { celebrationsApi } from './api-client';
import { ApiEndpoints } from './base';

/*
 * No `If-None-Match` is sent: the browser HTTP cache revalidates the catalog
 * with its ETag, and pack versions and assets are immutable.
 */

/** Fetches the validated celebration index; rejects on any non-2xx response. */
export const getCelebrationCatalog = (
  signal?: AbortSignal,
): Promise<CelebrationCatalogDto> =>
  celebrationsApi.getCelebrationCatalog({ signal });

/** Fetches one validated, immutable pack version the current index lists. */
export const getCelebrationPack = (
  packId: string,
  version: string,
  signal?: AbortSignal,
): Promise<CelebrationPackDto> =>
  celebrationsApi.getCelebrationPack({ packId, version }, { signal });

/** Fetches a declared JSON asset (a Lottie clip) and parses it. */
export const loadCelebrationAssetJson = async (
  assetId: string,
  signal?: AbortSignal,
): Promise<unknown> => {
  const response = await celebrationsApi.getCelebrationAssetRaw(
    { assetId },
    { signal },
  );
  return JSON.parse(await response.raw.text()) as unknown;
};

/** Returns the URL an `<img>` loads a declared image asset from. */
export const getCelebrationAssetUrl = (assetId: string): string =>
  `${ApiEndpoints.CELEBRATION_ASSETS}/${encodeURIComponent(assetId)}`;
