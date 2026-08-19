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
  /** CSS class controlling the label's type scale. Defaults to `'dial-small-text'`. */
  textClassName?: string;
}

/** Full-width tappable row used by every page of the navigation bottom sheet. */
export const SheetRow: FC<SheetRowProps> = memo(
  ({ label, onClick, icon, trailing, textClassName = 'dial-small-text' }) => (
    <li>
      <button
        type="button"
        className={mergeClasses(
          styles.row,
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
