import { BadgeColor } from '@epam/ai-dial-ui-kit';
import { CatalogEntityType } from '../types/entity-type';

/*
 * A function rather than a lookup table on purpose: a module-level table would
 * read `BadgeColor` from the UI kit the moment this package is imported, and
 * break every consumer test that mocks the kit without it.
 */
/** Returns the kit badge colour for an entity type — the same visual tokens as `ENTITY_TYPE_COLOR`. */
export const getEntityTypeBadgeColor = (
  type: CatalogEntityType,
): BadgeColor => {
  switch (type) {
    case CatalogEntityType.Agent:
      return BadgeColor.Green;
    case CatalogEntityType.Skill:
      return BadgeColor.Violet;
    case CatalogEntityType.Toolset:
      return BadgeColor.Brown;
    case CatalogEntityType.Prompt:
      return BadgeColor.Indigo;
    case CatalogEntityType.Model:
    default:
      return BadgeColor.Blue;
  }
};
