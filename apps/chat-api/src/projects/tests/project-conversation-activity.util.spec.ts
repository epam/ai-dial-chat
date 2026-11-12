import { describe, expect, it } from 'vitest';
import { getLastMessageTime } from '../utils/project-conversation-activity.util';

describe('getLastMessageTime', () => {
  it('returns the newest message time whatever the message order', () => {
    expect(
      getLastMessageTime({
        messages: [
          { timestamp: '2026-11-11T10:00:00.000Z' },
          { timestamp: '2026-11-11T12:00:00.000Z' },
          { timestamp: '2026-11-11T11:00:00.000Z' },
        ],
      }),
    ).toBe(Date.parse('2026-11-11T12:00:00.000Z'));
  });

  it('ignores a message without a valid timestamp', () => {
    expect(
      getLastMessageTime({
        messages: [{ timestamp: 'not a date' }, {}, { timestamp: '' }],
      }),
    ).toBeUndefined();
    expect(
      getLastMessageTime({
        messages: [
          { timestamp: 'nope' },
          { timestamp: '2026-11-11T10:00:00Z' },
        ],
      }),
    ).toBe(Date.parse('2026-11-11T10:00:00Z'));
  });

  it('returns undefined for a conversation without messages', () => {
    expect(getLastMessageTime({})).toBeUndefined();
    expect(getLastMessageTime({ messages: [] })).toBeUndefined();
  });
});
