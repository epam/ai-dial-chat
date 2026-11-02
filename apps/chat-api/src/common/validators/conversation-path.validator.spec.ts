import { describe, expect, it } from 'vitest';
import { isConversationPath } from './conversation-path.validator';

describe('isConversationPath', () => {
  it.each([
    'gpt-4o__My Conversation__cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
    'gpt-4o__!... hi__cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
    'gpt-4o__a..b',
    'gpt-4o__Wait...',
    'applications/bucket/dial-loop__1.0.0__Hi... there__uuid',
    'folder/gpt-4o__...x',
    'gpt-4o__100%',
  ])('accepts the conversation path %s', (value) => {
    expect(isConversationPath(value)).toBe(true);
  });

  it.each([
    '',
    '.',
    '..',
    'bucket/../secret',
    'bucket/./secret',
    '../secret',
    'bucket/..',
    'bucket/%2e%2e/secret',
    'bucket/%2E%2E/secret',
    'bucket%2F..%2Fsecret',
  ])('rejects the traversal path %s', (value) => {
    expect(isConversationPath(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}])(
    'rejects the non-string value %s',
    (value) => {
      expect(isConversationPath(value)).toBe(false);
    },
  );
});
