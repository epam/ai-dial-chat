import type { Conversation } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import { describe, expect, it } from 'vitest';
import { shouldWatchForDisplayNameUpdate } from '../display-name-watch';

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation =>
  ({
    id: 'bucket/gpt-4o__Hello',
    folderId: 'bucket',
    name: 'Hello',
    model: { id: 'gpt-4o' },
    prompt: '',
    temperature: 1,
    messages: [
      {
        id: 'user-1',
        role: MessageRole.User,
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'assistant-1',
        role: MessageRole.Assistant,
        content: 'Hi',
        timestamp: new Date().toISOString(),
      },
    ],
    lastActivityDate: Date.now(),
    updatedAt: Date.now(),
    selectedAddons: [],
    assistantModelId: 'gpt-4o',
    ...overrides,
  }) as Conversation;

describe('shouldWatchForDisplayNameUpdate', () => {
  it('returns true after the first exchange when LLM naming is not done', () => {
    expect(shouldWatchForDisplayNameUpdate(makeConversation())).toBe(true);
  });

  it('returns false when llmNamingDone is true', () => {
    expect(
      shouldWatchForDisplayNameUpdate({
        ...makeConversation(),
        llmNamingDone: true,
      } as ConversationResponseDto & Conversation),
    ).toBe(false);
  });

  it('returns false when fewer than two non-status messages exist', () => {
    expect(
      shouldWatchForDisplayNameUpdate(
        makeConversation({
          messages: [
            {
              id: 'user-1',
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
