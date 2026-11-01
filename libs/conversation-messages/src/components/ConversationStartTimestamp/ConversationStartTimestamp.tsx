import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { ConversationStartTimestampProps } from '../../models/conversation-start';
import { ConversationStartKind } from '../../types/conversation-start-kind';
import { formatConversationStart, parseTimestamp } from '../../utils/date-time';
import styles from './ConversationStartTimestamp.module.scss';

const DEFAULT_TODAY_LABEL = (time: string) => `Today ${time}`;
const DEFAULT_YESTERDAY_LABEL = (time: string) => `Yesterday ${time}`;

/** Centered "Today 11:51 AM" / "Yesterday 3:24 PM" / full-date label for when a conversation started. */
export const ConversationStartTimestamp: FC<
  ConversationStartTimestampProps
> = ({ timestamp, locale, labels, className = 'dial-small-text', colors }) => {
  const start = parseTimestamp(timestamp);
  if (start == null) return null;

  const { kind, text } = formatConversationStart(start, new Date(), locale);

  let label = text;
  if (kind === ConversationStartKind.Today) {
    label = (labels?.today ?? DEFAULT_TODAY_LABEL)(text);
  } else if (kind === ConversationStartKind.Yesterday) {
    label = (labels?.yesterday ?? DEFAULT_YESTERDAY_LABEL)(text);
  }

  return (
    <time
      dateTime={timestamp}
      className={mergeClasses(
        'self-center text-center',
        styles.label,
        className,
      )}
      style={buildCssVars({ '--cst-text': colors?.text })}
    >
      {label}
    </time>
  );
};
