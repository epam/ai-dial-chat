import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Tooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { useNow } from '../../hooks/useNow/useNow';
import type { MessageTimestampProps } from '../../models/conversation-start';
import {
  formatAbsoluteDateTime,
  formatRelativeTime,
  parseTimestamp,
} from '../../utils/date-time';
import styles from './MessageTimestamp.module.scss';

const REFRESH_INTERVAL_MS = 60_000;

/*
 * Hidden until the enclosing bubble (`group/message`) is hovered or holds
 * keyboard focus; always shown on devices without hover. Opacity (not
 * `hidden`) keeps the time in the accessibility tree and its tooltip
 * reachable by keyboard.
 */
const VISIBILITY_CLASS_NAME =
  'opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 [@media(hover:none)]:opacity-100';

/** Relative send time ("3 hours ago") with the full date and time in a tooltip. */
export const MessageTimestamp: FC<MessageTimestampProps> = ({
  timestamp,
  locale,
  className = 'dial-small-text',
}) => {
  const now = useNow(REFRESH_INTERVAL_MS);
  const date = parseTimestamp(timestamp);
  if (date == null) return null;

  return (
    <Tooltip tooltip={formatAbsoluteDateTime(date, locale)} asChild>
      <time
        dateTime={timestamp}
        tabIndex={0}
        className={mergeClasses(
          'px-1 whitespace-nowrap',
          styles.time,
          className,
          VISIBILITY_CLASS_NAME,
        )}
      >
        {formatRelativeTime(date, now, locale)}
      </time>
    </Tooltip>
  );
};
