import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { ENTITY_TYPE_COLOR } from '../../constants/entity-colors';
import { CatalogEntityType } from '../../types/entity-type';
import styles from './EntityTypeLabel.module.scss';

/** Props for EntityTypeLabel. */
export interface EntityTypeLabelProps {
  /** Entity category — resolves the label's color via ENTITY_TYPE_COLOR. */
  type: CatalogEntityType;
  /** CSS class for the label text. Default: 'dial-caption-semi-text'. */
  className?: string;
}

/**
 * Entity type label rendered as plain uppercase text — no pill, no background.
 * Shared by the card grid (via AppIdentity) and the list view, so both
 * densities of the catalog use the same type treatment.
 */
export const EntityTypeLabel: FC<EntityTypeLabelProps> = ({
  type,
  className = 'dial-caption-semi-text',
}) => (
  <span
    className={mergeClasses(
      'uppercase tracking-[0.06em]',
      styles.typeLabel,
      className,
    )}
    style={buildCssVars({ '--entity-color': ENTITY_TYPE_COLOR[type] })}
  >
    {type}
  </span>
);
