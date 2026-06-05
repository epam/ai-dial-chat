import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo } from 'react';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

/** Props for `EmptyState`. */
export interface EmptyStateProps {
  /** Message to display when no conversations are available. */
  label: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/** Full-height centered empty-state message for the conversation list. */
export const EmptyState: FC<EmptyStateProps> = memo(
  ({ label, labelClassName = 'dial-small-text' }) => (
    <p
      className={mergeClasses(
        'flex h-full items-center justify-center px-4 py-6 text-center',
        labelClassName,
        styles.itemDate,
      )}
    >
      {label}
    </p>
  ),
);
