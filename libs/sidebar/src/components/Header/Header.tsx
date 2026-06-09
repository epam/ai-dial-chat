import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo, type ReactNode } from 'react';
import styles from '../SidebarPanel/SidebarPanel.module.scss';

/** Props for the `Header` component. */
export interface HeaderProps {
  /**
   * Title text rendered between the two action groups.
   * Truncated with an ellipsis when the panel is too narrow.
   */
  title?: ReactNode;
  /**
   * Typography class applied to the title element.
   * Defaults to `'dial-body-semi-bold-text'`.
   */
  titleClassName?: string;
  /** Content rendered in the start (left) group of the header bar. */
  leftActions?: ReactNode;
  /** Content rendered in the end (right) group of the header bar. */
  rightActions?: ReactNode;
}

/** 48 px header bar with a title and optional start/end action slots. */
export const Header: FC<HeaderProps> = memo(
  ({
    title,
    titleClassName = 'dial-body-semi-bold-text',
    leftActions,
    rightActions,
  }) => (
    <div
      className={mergeClasses(
        styles.header,
        'flex min-h-[49px] shrink-0 items-center border-b px-2',
      )}
    >
      <div className="flex items-center gap-1">{leftActions}</div>

      <span
        className={mergeClasses('min-w-0 flex-1 truncate px-2', titleClassName)}
      >
        {title}
      </span>

      <div className="flex items-center gap-1">{rightActions}</div>
    </div>
  ),
);
