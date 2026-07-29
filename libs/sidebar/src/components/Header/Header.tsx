import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { type FC, memo, type ReactNode } from 'react';
import styles from '../SidebarPanel/SidebarPanel.module.scss';

/** Props for the `Header` component. */
export interface HeaderProps {
  /** Title rendered between the start and end action slots. */
  title?: ReactNode;
  /** CSS class applied to the title element. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to the root element. */
  className?: string;
  /** Content rendered in the start (left) group of the header bar. */
  leftActions?: ReactNode;
  /** Content rendered in the end (right) group of the header bar. */
  rightActions?: ReactNode;
}

/** 48 px header bar with a title and optional start/end action slots. */
export const Header: FC<HeaderProps> = memo(
  ({
    title,
    titleClassName = 'dial-h1-text',
    leftActions,
    className,
    rightActions,
  }) => (
    <div
      className={mergeClasses(
        'flex h-12 shrink-0 items-center gap-2 px-4',
        className,
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
