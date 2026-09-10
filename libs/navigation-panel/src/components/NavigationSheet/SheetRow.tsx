import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC, type ReactNode } from 'react';
import styles from './NavigationSheet.module.scss';

/** Props for `SheetRow`. */
export interface SheetRowProps {
  /** Translated row label. */
  label: string;
  /** Activates the row. */
  onClick: () => void;
  /** Leading icon, rendered in the muted icon color. */
  icon?: ReactNode;
  /** Trailing content such as a chevron or a check mark. */
  trailing?: ReactNode;
  /**
   * Whether the row is the current one of its set — the open destination, or
   * the applied value of a settings group. Marks the row `aria-current="true"`.
   * Defaults to `false`.
   */
  isCurrent?: boolean;
  /**
   * Whether to draw the accent in-navigation highlight. Set it alongside
   * `isCurrent` for a navigation destination; leave it off for a value list,
   * where the design marks the choice with a trailing check instead of a tint.
   * Defaults to `false`.
   */
  isHighlighted?: boolean;
  /** CSS class controlling the label's type scale. Defaults to `'dial-small-text'`. */
  textClassName?: string;
}

/** Full-width tappable row used by every page of the navigation bottom sheet. */
export const SheetRow: FC<SheetRowProps> = memo(
  ({
    label,
    onClick,
    icon,
    trailing,
    isCurrent = false,
    isHighlighted = false,
    textClassName = 'dial-small-text',
  }) => (
    <li>
      <button
        type="button"
        aria-current={isCurrent ? 'true' : undefined}
        className={mergeClasses(
          styles.row,
          isHighlighted && styles.rowActive,
          'flex w-full items-center gap-3 px-4 py-[10px] text-start',
        )}
        onClick={onClick}
      >
        {icon && <span className={styles.rowIcon}>{icon}</span>}
        <span className={mergeClasses(textClassName, 'flex-1')}>{label}</span>
        {trailing}
      </button>
    </li>
  ),
);
