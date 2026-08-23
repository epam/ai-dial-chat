import { FC } from 'react';
import {
  ENTITY_TYPE_BG_COLOR,
  ENTITY_TYPE_COLOR,
} from '../../constants/entity-colors';
import { CatalogEntityType } from '../../types/entity-type';
import { mergeClasses } from '../../utils/merge-class';

/** Props for `FeaturedChip`. */
export interface FeaturedChipProps {
  /** Label text shown inside the chip. */
  label: string;
  /** Additional CSS class for typography overrides. */
  className?: string;
  /** Entity category — resolves the label's color via ENTITY_TYPE_COLOR. */
  type: CatalogEntityType;
}

/** Featured badge rendered on a catalog card when `item.isFeatured` is true. */
export const FeaturedChip: FC<FeaturedChipProps> = ({
  label,
  className,
  type,
}) => {
  const bgColor = ENTITY_TYPE_BG_COLOR[type];
  const color = ENTITY_TYPE_COLOR[type];

  return (
    <div
      className={mergeClasses(
        'h-[24px] gap-1 rounded-2xl border-none px-2',
        'flex items-center justify-center',
        className ?? 'dial-caption-lead-semi-text',
      )}
      style={{ backgroundColor: bgColor, color: color }}
    >
      {label}
    </div>
  );
};
