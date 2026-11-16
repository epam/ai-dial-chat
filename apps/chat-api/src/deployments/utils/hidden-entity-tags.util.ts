import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';

/**
 * Reads `HIDDEN_ENTITY_TAGS` once into a set. Env values are fixed at boot,
 * so callers read it in their constructor and keep the set.
 */
export const readHiddenEntityTags = (
  configService: ConfigService<EnvironmentVariables>,
): ReadonlySet<string> =>
  new Set(configService.get('HIDDEN_ENTITY_TAGS', { infer: true }) ?? []);

/**
 * Whether a DIAL Core entity's `description_keywords` carries one of the
 * `HIDDEN_ENTITY_TAGS`. This is the one match behind both the deployments
 * `isHidden` flag and the model routes' filtering, so the Chat Catalog and
 * every consumer of `/models` and `/model-catalog` agree on what is hidden.
 * The match is exact and case-sensitive. A value that is not an array is
 * never hidden, so a malformed Core entry cannot break a listing.
 */
export const hasHiddenEntityTag = (
  keywords: unknown,
  hiddenTags: ReadonlySet<string>,
): boolean =>
  hiddenTags.size > 0 &&
  Array.isArray(keywords) &&
  keywords.some((tag) => typeof tag === 'string' && hiddenTags.has(tag));
