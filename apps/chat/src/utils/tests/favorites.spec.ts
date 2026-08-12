import { CatalogEntityType } from '@epam/ai-dial-catalog';
import { describe, expect, it } from 'vitest';
import { FavoriteEntityType } from '../../context/FavoriteApplicationsContext';
import { resolveFavoriteEntityType } from '../favorites';

describe('resolveFavoriteEntityType', () => {
  it('maps a prompt to the prompts config section', () => {
    expect(resolveFavoriteEntityType(CatalogEntityType.Prompt)).toBe(
      FavoriteEntityType.Prompt,
    );
  });

  it('maps a toolset to the toolsets config section', () => {
    expect(resolveFavoriteEntityType(CatalogEntityType.Toolset)).toBe(
      FavoriteEntityType.Toolset,
    );
  });

  it('falls back to deployments for model and agent types', () => {
    expect(resolveFavoriteEntityType(CatalogEntityType.Model)).toBe(
      FavoriteEntityType.Deployment,
    );
    expect(resolveFavoriteEntityType(CatalogEntityType.Agent)).toBe(
      FavoriteEntityType.Deployment,
    );
  });

  it('falls back to deployments when the type is unknown', () => {
    expect(resolveFavoriteEntityType(undefined)).toBe(
      FavoriteEntityType.Deployment,
    );
  });
});
