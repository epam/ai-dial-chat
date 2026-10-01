import { Badge, BadgeVariant } from '@epam/ai-dial-ui-kit';
import { CSSProperties, FC } from 'react';
import { CatalogEntityType } from '../../types/entity-type';
import { getEntityTypeBadgeColor } from '../../utils/entity-type';

/** Props for `FeaturedChip`. */
export interface FeaturedChipProps {
  /** Label text shown inside the chip. */
  label: string;
  /** Typography class for the label. Defaults to the kit badge's `'dial-caption-lead-semi-text'`. */
  className?: string;
  /** Entity category — picks the chip's default colours. */
  type: CatalogEntityType;
  /** Style overrides merged over the chip's default per-entity-type colors, e.g. `{ backgroundColor, color, border }`. */
  style?: CSSProperties;
}

/** Featured badge rendered on a catalog card when `item.isFeatured` is true. */
export const FeaturedChip: FC<FeaturedChipProps> = ({
  label,
  className,
  type,
  style,
}) => (
  /* An inline `style` outranks the badge's colour classes, so a host override
     still wins over the per-entity-type default. */
  <Badge
    label={label}
    variant={BadgeVariant.Filled}
    color={getEntityTypeBadgeColor(type)}
    textClassName={className}
    style={style}
  />
);
