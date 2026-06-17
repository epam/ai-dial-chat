import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { CatalogEntityType } from '../../types/CatalogEntityType';
import styles from './EntityTypeBadge.module.scss';

/** CSS module class names keyed by `CatalogEntityType`. */
const ENTITY_TYPE_CLASS_NAME: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: styles.model,
  [CatalogEntityType.Toolset]: styles.toolset,
  [CatalogEntityType.Mcp]: styles.mcp,
  [CatalogEntityType.Guardrail]: styles.guardrail,
};

/** Props for EntityTypeBadge. */
export interface EntityTypeBadgeProps {
  /** The entity type to display. */
  type: CatalogEntityType;
  /** CSS class for the badge text. Default: 'dial-caption-text'. */
  className?: string;
}

/** Small uppercase badge showing the entity category with its accent color. */
export const EntityTypeBadge: FC<EntityTypeBadgeProps> = ({
  type,
  className = 'dial-caption-text',
}) => {
  const typeClassName = ENTITY_TYPE_CLASS_NAME[type] ?? styles.fallback;

  return (
    <span
      className={mergeClasses(
        'uppercase tracking-[0.04em]',
        className,
        typeClassName,
      )}
    >
      {type}
    </span>
  );
};
