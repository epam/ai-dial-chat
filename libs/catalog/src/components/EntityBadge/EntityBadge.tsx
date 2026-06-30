import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { CatalogEntityType } from '../../types/entity-type';
import styles from './EntityBadge.module.scss';

/** CSS module class names keyed by `CatalogEntityType`. */
const ENTITY_TYPE_CLASS_NAME: Record<CatalogEntityType, string> = {
  [CatalogEntityType.Model]: styles.model,
  [CatalogEntityType.Application]: styles.application,
  [CatalogEntityType.Agent]: styles.agent,
  [CatalogEntityType.Toolset]: styles.toolset,
  [CatalogEntityType.Guardrail]: styles.guardrail,
  [CatalogEntityType.Skill]: styles.skill,
  [CatalogEntityType.Mcp]: styles.mcp,
};

/** Props for EntityTypeBadge. */
export interface EntityBadgeProps {
  /** The entity type to display. */
  type: CatalogEntityType;
  /** CSS class for the badge text. Default: 'dial-caption-text'. */
  className?: string;
}

/** Small uppercase badge showing the entity category with its accent color. */
export const EntityBadge: FC<EntityBadgeProps> = ({
  type,
  className = 'dial-caption-text',
}) => {
  const typeClassName = ENTITY_TYPE_CLASS_NAME[type] ?? styles.fallback;

  return (
    <span
      className={mergeClasses(
        'uppercase tracking-[0.06em]',
        className,
        styles.pill,
        typeClassName,
      )}
    >
      {type}
    </span>
  );
};
