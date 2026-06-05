import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo } from 'react';
import styles from '../ConversationPanel.module.scss';

/** Props for `Header`. */
export interface HeaderProps {
  /** Panel heading text shown in the top bar. */
  title: string;
  /** Optional typography utility class applied to the title text. */
  titleClassName?: string;
}

/** Top bar section containing the panel title. */
export const Header: FC<HeaderProps> = memo(({ title, titleClassName }) => (
  <div
    className={mergeClasses(
      'flex h-12 shrink-0 items-center justify-between border-b px-5',
      styles.header,
    )}
  >
    <span
      className={mergeClasses('truncate', styles.headerTitle, titleClassName)}
    >
      {title}
    </span>
  </div>
));
