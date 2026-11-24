import { describe, expect, it } from 'vitest';
import {
  getConversationActivityTime,
  getLastMessageTime,
} from '../utils/project-conversation-activity.util';

describe('getConversationActivityTime', () => {
  const at = (time: number) => ({ timestamp: new Date(time).toISOString() });

  it('returns the body updatedAt when it is later than the last message', () => {
    expect(
      getConversationActivityTime({ updatedAt: 900, messages: [at(100)] }),
    ).toBe(900);
  });

  it('returns the last message when the body updatedAt is its creation time', () => {
    expect(
      getConversationActivityTime({ updatedAt: 50, messages: [at(300)] }),
    ).toBe(300);
  });

  it('falls back to the other value when one is missing or invalid', () => {
    expect(getConversationActivityTime({ updatedAt: 400 })).toBe(400);
    expect(
      getConversationActivityTime({ updatedAt: 'x', messages: [at(300)] }),
    ).toBe(300);
    expect(
      getConversationActivityTime({ updatedAt: Number.NaN, messages: [] }),
    ).toBeUndefined();
  });
});

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
