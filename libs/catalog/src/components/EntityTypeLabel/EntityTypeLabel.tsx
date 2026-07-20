import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { ENTITY_TYPE_COLOR } from '../../constants/entity-colors';
import { CatalogEntityType } from '../../types/entity-type';

/** Props for EntityTypeLabel. */
export interface EntityTypeLabelProps {
  /** Entity category — resolves the label's color via ENTITY_TYPE_COLOR. */
  type: CatalogEntityType;
  /** CSS class for the label text. Default: 'dial-caption-text font-semibold'. */
  className?: string;
}

/**
 * Entity type label rendered as plain uppercase text — no pill, no background.
 * Shared by the card grid (via AppIdentity) and the list view, so both
 * densities of the catalog use the same type treatment.
 */
export const EntityTypeLabel: FC<EntityTypeLabelProps> = ({
  type,
  className = 'dial-caption-text font-semibold',
}) => (
  <span
    className={mergeClasses('uppercase tracking-[0.06em]', className)}
    style={{ color: ENTITY_TYPE_COLOR[type] }}
  >
    {type}
  </span>
);
