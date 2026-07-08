import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './FeaturedChip.module.scss';

/** Props for `FeaturedChip`. */
export interface FeaturedChipProps {
  /** Label text shown inside the chip. */
  label: string;
  /** Additional CSS class for typography overrides. */
  className?: string;
}

/** Featured badge rendered on a catalog card when `item.isFeatured` is true. */
export const FeaturedChip: FC<FeaturedChipProps> = ({ label, className }) => (
  <DialTag
    label={label}
    className={mergeClasses(
      'rounded-2xl border-none text-[10px] font-semibold uppercase tracking-[0.06em]',
      className,
      styles.featuredChip,
    )}
  />
);
