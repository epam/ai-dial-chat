import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import styles from './PricingTag.module.scss';

/** Props for PricingTag. */
export interface PricingTagProps {
  /** Text to display inside the tag, e.g. 'Free' or 'Pay-as-you-go'. */
  label: string;
  /** CSS class for the tag text. Default: 'dial-tiny-text'. */
  className?: string;
}

/**
 * Subtle outlined tag for pricing tier labels.
 * DialTag's default variant adds a visible background; this uses a custom element instead.
 */
export const PricingTag: FC<PricingTagProps> = ({
  label,
  className = 'dial-tiny-text',
}) => (
  <span
    className={mergeClasses(
      'inline-flex items-center rounded border px-1.5 py-0.5',
      className,
      styles.tag,
    )}
  >
    {label}
  </span>
);
