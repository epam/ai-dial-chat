import type { Conversation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { getConversationPath, getFolderBreadcrumb } from '../conversation-path';

describe('getConversationPath', () => {
  it('strips the bucket without decoding resource path segments', () => {
    expect(
      getConversationPath(
        'bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
      ),
    ).toBe('applications/catalog/Team%2FApp%20One__0.0.1__title');
  });

  it('keeps a path without a bucket unchanged', () => {
    expect(getConversationPath('conversation__title')).toBe(
      'conversation__title',
    );
  });
});

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id: 'bucket-a/gpt-4o__My Chat',
  folderId: 'bucket-a',
  name: 'My Chat',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 0.5,
  messages: [],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
  ...overrides,
});

describe('getFolderBreadcrumb', () => {
  it('returns undefined for a root conversation', () => {
    const conversation = makeConversation({ folderId: 'bucket-a' });
    expect(getFolderBreadcrumb(conversation)).toBeUndefined();
  });

  it('joins nested folder segments with " / "', () => {
    const conversation = makeConversation({
      folderId: 'bucket-a/Folder 1/Folder 2',
    });
    expect(getFolderBreadcrumb(conversation)).toBe('Folder 1 / Folder 2');
  });

  it('returns a single segment unchanged', () => {
    const conversation = makeConversation({ folderId: 'bucket-a/Folder 1' });
    expect(getFolderBreadcrumb(conversation)).toBe('Folder 1');
  });

  it('returns undefined for an old-chat root conversation with the raw "conversations/" prefix', () => {
    const conversation = makeConversation({
      folderId:
        'conversations/59CAnBu6LZrtfagTrHaP2rJhuMLT3rYQS7UkWevuqKXu1dB4gL6cYw6Msobg7Kqs9j',
    });
    expect(getFolderBreadcrumb(conversation)).toBeUndefined();
  });
});
