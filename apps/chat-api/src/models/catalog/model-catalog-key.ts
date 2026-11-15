import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';

/**
 * Returns the trimmed `MODEL_CATALOG_API_KEY`, or `undefined` when it is unset,
 * empty or whitespace-only. Shared by the catalog routes and the client-config
 * `modelCatalogAvailable` flag so the two can never disagree.
 */
export const resolveModelCatalogApiKey = (
  configService: ConfigService<EnvironmentVariables>,
): string | undefined => {
  const key = configService
    .get('MODEL_CATALOG_API_KEY', { infer: true })
    ?.trim();
  return key ? key : undefined;
};
