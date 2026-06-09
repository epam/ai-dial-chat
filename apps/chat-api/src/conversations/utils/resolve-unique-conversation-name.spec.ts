import { describe, expect, it } from 'vitest';
import { resolveUniqueConversationName } from './resolve-unique-conversation-name';

describe('resolveUniqueConversationName', () => {
  it('returns base unchanged when the set is empty', () => {
    expect(resolveUniqueConversationName('New chat', new Set())).toBe(
      'New chat',
    );
  });

  it('returns base unchanged when base is not in the existing set', () => {
    expect(
      resolveUniqueConversationName('My query', new Set(['Other topic'])),
    ).toBe('My query');
  });

  it('returns "base 1" when base is taken but "base 1" is free', () => {
    expect(
      resolveUniqueConversationName('New chat', new Set(['New chat'])),
    ).toBe('New chat 1');
  });

  it('returns "base 2" when base and "base 1" are both taken', () => {
    expect(
      resolveUniqueConversationName(
        'New chat',
        new Set(['New chat', 'New chat 1']),
      ),
    ).toBe('New chat 2');
  });

  it('returns the first gap when indices are non-contiguous', () => {
    expect(
      resolveUniqueConversationName(
        'New chat',
        new Set(['New chat', 'New chat 1', 'New chat 3']),
      ),
    ).toBe('New chat 2');
  });
});
