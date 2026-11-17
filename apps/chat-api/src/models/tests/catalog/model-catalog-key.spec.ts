import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { resolveModelCatalogApiKey } from '../../catalog/model-catalog-key';

const makeConfig = (value: string | undefined) =>
  ({
    get: (key: string) => (key === 'MODEL_CATALOG_API_KEY' ? value : undefined),
  }) as unknown as ConfigService<EnvironmentVariables>;

describe('resolveModelCatalogApiKey', () => {
  it('returns undefined when the key is unset', () => {
    expect(resolveModelCatalogApiKey(makeConfig(undefined))).toBeUndefined();
  });

  it('returns undefined when the key is empty', () => {
    expect(resolveModelCatalogApiKey(makeConfig(''))).toBeUndefined();
  });

  it('returns undefined when the key is whitespace-only', () => {
    expect(resolveModelCatalogApiKey(makeConfig('  \t '))).toBeUndefined();
  });

  it('returns the trimmed key when it is padded', () => {
    expect(resolveModelCatalogApiKey(makeConfig(' catalog-key '))).toBe(
      'catalog-key',
    );
  });
});
