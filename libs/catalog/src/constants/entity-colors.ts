import { CatalogEntityType } from '../types/entity-type';

/** Hex color per entity type — used for the type label, featured card border, and drop shadow. */
export const ENTITY_TYPE_COLOR: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: '#2764D9',
  [CatalogEntityType.Agent]: '#059669',
  [CatalogEntityType.Skill]: '#0E7490',
  [CatalogEntityType.Toolset]: '#B45309',
};

/** Low-opacity (12%) rgba version of each entity type color — used for featured card glow shadow. */
export const ENTITY_TYPE_SHADOW: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: 'rgba(39, 100, 217, 0.12)',
  [CatalogEntityType.Agent]: 'rgba(5, 150, 105, 0.12)',
  [CatalogEntityType.Skill]: 'rgba(14, 116, 144, 0.12)',
  [CatalogEntityType.Toolset]: 'rgba(180, 83, 9, 0.12)',
};
