import { CatalogEntityType } from '../types/entity-type';

/** Hex color per entity type — used for the type label, featured card border, and drop shadow. */
export const ENTITY_TYPE_COLOR: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: '#2764D9',
  [CatalogEntityType.Agent]: '#059669',
  [CatalogEntityType.Skill]: '#0E7490',
  [CatalogEntityType.Toolset]: '#B45309',
  // [CatalogEntityType.Prompt]: '#3730B7',
};
