import type { Conversation } from '@epam/ai-dial-chat-shared';
import { MessageRole, StageStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { isAwaitingGenerationResume } from '../generation-resume';

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
        role: MessageRole.User,
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
      {
        role: MessageRole.Assistant,
        content: '',
        timestamp: new Date().toISOString(),
      },
    ],
    lastActivityDate: Date.now(),
    updatedAt: Date.now(),
    selectedAddons: [],
    assistantModelId: 'gpt-4o',
    ...overrides,
  }) as Conversation;

describe('isAwaitingGenerationResume', () => {
  it('returns true when the last message is an empty assistant placeholder', () => {
    expect(isAwaitingGenerationResume(makeConversation())).toBe(true);
  });

  it('returns false when the last assistant message has content', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: 'Hi there',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the placeholder has a streamErrorMessage (empty string — error with no specific text)', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              streamErrorMessage: '',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the placeholder has a streamErrorMessage', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              streamErrorMessage: 'Generation failed',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the placeholder is flagged wasStoppedByUser', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              wasStoppedByUser: true,
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the last assistant message has only attachments (image generation produces no text)', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              custom_content: {
                attachments: [
                  { title: 'cat.png', type: 'image/png', url: 'files/cat.png' },
                ],
              },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the last assistant message has only stages', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              custom_content: {
                stages: [
                  {
                    index: 0,
                    name: 'Generating image',
                    status: StageStatus.Completed,
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the last assistant message carries a responseId but no text', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              responseId: 'resp-1',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns true when the placeholder carries an empty custom_content', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Draw a cat',
              timestamp: new Date().toISOString(),
            },
            {
              role: MessageRole.Assistant,
              content: '',
              timestamp: new Date().toISOString(),
              custom_content: { attachments: [], stages: [] },
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('returns false when last message is from the user', () => {
    expect(
      isAwaitingGenerationResume(
        makeConversation({
          messages: [
            {
              role: MessageRole.User,
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when there are no messages', () => {
    expect(isAwaitingGenerationResume(makeConversation({ messages: [] }))).toBe(
      false,
    );
  });
});
