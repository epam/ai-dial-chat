import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
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
   * CSS class applied to the title element.
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
    titleClassName = 'dial-body-semi-text',
    leftActions,
    rightActions,
  }) => (
    <div
      className={mergeClasses(
        'flex h-12 shrink-0 items-center gap-2 px-4',
        styles.header,
      )}
    >
      {leftActions && (
        <div className="flex items-center gap-1">{leftActions}</div>
      )}

      <DialEllipsisTooltip
        text={title}
        className={mergeClasses('min-w-0 flex-1 truncate', titleClassName)}
      />

      {rightActions && (
        <div className="flex items-center gap-1">{rightActions}</div>
      )}
    </div>
  ),
);
