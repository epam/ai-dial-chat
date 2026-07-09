import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { handleDialFetchError } from '../common/dial/dial-error.mapper';

export interface CachedDialRequestOptions<T> {
  cacheManager: Cache;
  cacheKey: string;
  ttlMs?: number;
  context: string;
  logger: Logger;
  fetch: () => Promise<T>;
  transform?: (data: T) => T;
}

export const withCachedDialRequest = async <T>(
  options: CachedDialRequestOptions<T>,
): Promise<T> => {
  const {
    cacheManager,
    cacheKey,
    ttlMs = 30_000,
    context,
    logger,
    fetch,
    transform,
  } = options;

  const cached = await cacheManager.get<T>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for ${context} (key: ${cacheKey})`);
    return cached;
  }

  try {
    const result = await fetch();
    const data = transform ? transform(result) : result;
    await cacheManager.set(cacheKey, data, ttlMs);
    return data;
  } catch (err) {
    return handleDialFetchError(err, context, logger, 0);
  }
};
