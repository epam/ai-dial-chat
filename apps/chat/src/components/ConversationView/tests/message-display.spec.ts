import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { getInputMessageHistory } from '../utils/message-display';

const MESSAGES: Message[] = [
  {
    role: MessageRole.User,
    content: 'first question',
    timestamp: '2024-01-01T00:00:00Z',
  },
  {
    role: MessageRole.Assistant,
    content: 'first answer',
    timestamp: '2024-01-01T00:00:01Z',
  },
  {
    role: MessageRole.User,
    content: 'second question',
    timestamp: '2024-01-01T00:00:02Z',
  },
];

describe('getInputMessageHistory', () => {
  it('returns the sent user messages in order when navigation is enabled', () => {
    expect(getInputMessageHistory(MESSAGES, false)).toEqual([
      'first question',
      'second question',
    ]);
  });

  /* disable-input-history-navigation: with no history the input's Up/Down
     handler has nothing to recall (covered by useInputHistoryNavigation.spec). */
  it('returns undefined when navigation is disabled, even with sent messages', () => {
    expect(getInputMessageHistory(MESSAGES, true)).toBeUndefined();
  });
});
