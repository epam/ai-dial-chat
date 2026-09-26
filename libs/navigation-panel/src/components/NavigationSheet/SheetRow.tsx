import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { MenuItem, MenuItemMark } from '@epam/ai-dial-ui-kit';
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
      {/* No `role`, so the kit row stays a plain button inside the list. The
          geometry classes keep the sheet's full-bleed row instead of the
          kit's inset menu row. */}
      <MenuItem
        label={label}
        labelClassName={textClassName}
        icon={icon && <span className={styles.rowIcon}>{icon}</span>}
        trailing={trailing}
        mark={MenuItemMark.Highlight}
        selected={isHighlighted}
        aria-current={isCurrent ? 'true' : undefined}
        className={mergeClasses(
          'h-auto gap-3 rounded-none px-4 py-[10px]',
          styles.row,
          isHighlighted && styles.rowActive,
        )}
        onClick={onClick}
      />
    </li>
  ),
);
