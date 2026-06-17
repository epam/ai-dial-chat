import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './FeaturedTag.module.scss';

/** Props for FeaturedTag. */
export interface FeaturedTagProps {
  /** Label text. Default: 'Featured'. */
  label?: string;
  /** CSS class for the tag text. Default: 'dial-tiny-text'. */
  className?: string;
}

/**
 * Accent-colored tag indicating a featured item.
 * DialTag's default variant lacks a color prop, so this uses a custom element.
 */
export const FeaturedTag: FC<FeaturedTagProps> = ({
  label = 'Featured',
  className,
}) => (
  <DialTag
    label={label}
    className={mergeClasses('px-[6px]', className, styles.featuredTag)}
  />
);
