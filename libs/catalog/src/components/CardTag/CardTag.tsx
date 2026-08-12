import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import styles from './CardTag.module.scss';

/** Color overrides for `CardTag`, applied as CSS custom properties. */
export interface CardTagColors {
  /** Tag background color. Fallback: `--bg-layer-sunken`. */
  background?: string;
  /** Tag text color. Fallback: `--text-secondary`. */
  text?: string;
  /** Tag border color. Fallback: `--stroke-tertiary`. */
  border?: string;
}

/** Props for `CardTag`. */
export interface CardTagProps {
  /** Text displayed inside the tag. */
  label: string;
  /** CSS class for layout/spacing of the tag itself (e.g. margins). */
  className?: string;
  /** Typography class for the tag label. Default: `'dial-tiny-text'`. */
  badgeClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: CardTagColors;
}

/** Compact tag used on catalog cards and rows for topics and status badges. */
export const CardTag: FC<CardTagProps> = ({
  label,
  className,
  badgeClassName = 'dial-tiny-text',
  colors,
}) => (
  <div
    style={buildCssVars({
      '--cat-card-tag-bg': colors?.background,
      '--cat-card-tag-text': colors?.text,
      '--cat-card-tag-border': colors?.border,
    })}
    className={mergeClasses(
      'flex h-6 w-fit items-center justify-center whitespace-nowrap rounded-md border px-2',
      styles.tag,
      badgeClassName,
      className,
    )}
  >
    {label}
  </div>
);
