import { CatalogEntityType } from '../types/entity-type';

/** Text color per entity type — used for the type label, featured chip, and drop shadow. */
export const ENTITY_TYPE_COLOR: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: 'var(--text-accent, #1D4ED8)',
  [CatalogEntityType.Agent]: 'var(--text-visual-green-1, #059669)',
  [CatalogEntityType.Skill]: 'var(--text-visual-violet-1, #7C3AED)',
  [CatalogEntityType.Toolset]: 'var(--text-visual-brown-2, #B45309)',
  [CatalogEntityType.Prompt]: 'var(--text-visual-violet-2, #3730B7)',
};

/** Background color per entity type — used for the featured chip surface. */
export const ENTITY_TYPE_BG_COLOR: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: 'var(--bg-visual-blue, #D6EDF9)',
  [CatalogEntityType.Agent]: 'var(--bg-visual-green-2, #D1F0DC)',
  [CatalogEntityType.Skill]: 'var(--bg-visual-violet-2, #F1E9FF)',
  [CatalogEntityType.Toolset]: 'var(--bg-visual-brown, #FDE8D8)',
  [CatalogEntityType.Prompt]: 'var(--bg-visual-violet-1, #DDE3F9)',
};
