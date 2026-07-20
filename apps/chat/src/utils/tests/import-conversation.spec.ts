import type { Conversation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  formatQuotedNameList,
  getFolderBreadcrumb,
  parseImportEnvelope,
  rebaseConversationId,
  rewriteAttachmentUrls,
  UnsupportedImportFormatError,
} from '../import-conversation';

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

describe('parseImportEnvelope', () => {
  it('parses a valid envelope', () => {
    const conversation = makeConversation();
    const envelope = parseImportEnvelope(
      JSON.stringify({ version: 5, history: [conversation], folders: [] }),
    );
    expect(envelope).toEqual({
      version: 5,
      history: [conversation],
      folders: [],
    });
  });

  it('defaults folders to an empty array when absent', () => {
    const conversation = makeConversation();
    const envelope = parseImportEnvelope(
      JSON.stringify({ version: 5, history: [conversation] }),
    );
    expect(envelope.folders).toEqual([]);
  });

  it('parses an envelope carrying a real old-chat-shaped conversation (missing lastActivityDate/assistantModelId/selectedAddons and message id/timestamp, plus old-chat-only fields)', () => {
    const legacyConversation = {
      id: 'conversations/old-bucket/echo__Legacy Chat',
      folderId: 'conversations/old-bucket',
      name: 'Legacy Chat',
      model: { id: 'echo' },
      prompt: '',
      temperature: 1,
      updatedAt: 2000,
      // Old-chat-only fields the current model doesn't declare.
      reference: 'F1B2yfr_wIwLODhwP6l5D',
      status: 'LOADED',
      isMessageStreaming: false,
      messages: [
        {
          role: 'user' as Conversation['messages'][number]['role'],
          content: 'test',
          custom_content: {},
          templateMapping: [],
          model: { id: 'echo' },
          settings: { prompt: '', temperature: 1 },
        },
      ],
    } as unknown as Conversation;
    const envelope = parseImportEnvelope(
      JSON.stringify({
        version: 5,
        history: [legacyConversation],
        folders: [],
      }),
    );
    expect(envelope.version).toBe(5);
    expect(envelope.history).toEqual([legacyConversation]);
  });

  it('rejects a wrong version', () => {
    expect(() =>
      parseImportEnvelope(JSON.stringify({ version: 4, history: [] })),
    ).toThrow(UnsupportedImportFormatError);
    expect(() =>
      parseImportEnvelope(JSON.stringify({ version: 6, history: [] })),
    ).toThrow(UnsupportedImportFormatError);
  });

  it('rejects a missing version', () => {
    expect(() => parseImportEnvelope(JSON.stringify({ history: [] }))).toThrow(
      UnsupportedImportFormatError,
    );
  });

  it('rejects a non-array history', () => {
    expect(() =>
      parseImportEnvelope(JSON.stringify({ version: 5, history: {} })),
    ).toThrow(UnsupportedImportFormatError);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseImportEnvelope('{not json')).toThrow(
      UnsupportedImportFormatError,
    );
  });
});

describe('rebaseConversationId', () => {
  it('rebases a root conversation to the new bucket with a fresh uuid', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__My Chat',
      folderId: 'old-bucket',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.folderId).toBe('new-bucket');
    expect(result.id).toMatch(/^new-bucket\/gpt-4o__My Chat__[0-9a-f-]{36}$/);
    expect(subPath).toMatch(/^gpt-4o__My Chat__[0-9a-f-]{36}$/);
  });

  it('preserves folder path segments when rebasing', () => {
    const conversation = makeConversation({
      id: 'old-bucket/Folder 1/Folder 2/gpt-4o__My Chat',
      folderId: 'old-bucket/Folder 1/Folder 2',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.folderId).toBe('new-bucket/Folder 1/Folder 2');
    expect(result.id).toMatch(
      /^new-bucket\/Folder 1\/Folder 2\/gpt-4o__My Chat__[0-9a-f-]{36}$/,
    );
    expect(subPath).toMatch(
      /^Folder 1\/Folder 2\/gpt-4o__My Chat__[0-9a-f-]{36}$/,
    );
  });

  it('adds a fresh uuid to an old-chat conversation whose name has none', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__My Chat',
      folderId: 'old-bucket',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.id).toMatch(/^new-bucket\/gpt-4o__My Chat__[0-9a-f-]{36}$/);
    expect(subPath).toMatch(/^gpt-4o__My Chat__[0-9a-f-]{36}$/);
  });

  it('strips an existing trailing uuid before regenerating', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__My Chat__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket',
    });
    const { conversation: result } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.id).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(result.id).toMatch(/^new-bucket\/gpt-4o__My Chat__[0-9a-f-]{36}$/);
  });

  it('produces a unique id on repeated calls', () => {
    const conversation = makeConversation();
    const first = rebaseConversationId(conversation, 'new-bucket');
    const second = rebaseConversationId(conversation, 'new-bucket');
    expect(first.conversation.id).not.toBe(second.conversation.id);
  });

  it('strips old chat\'s raw "conversations/" resource prefix before rebasing', () => {
    const conversation = makeConversation({
      id: 'conversations/59CAnBu6LZrtfagTrHaP2rJhuMLT3rYQS7UkWevuqKXu1dB4gL6cYw6Msobg7Kqs9j/chathub-claude4__requirements.txt',
      folderId:
        'conversations/59CAnBu6LZrtfagTrHaP2rJhuMLT3rYQS7UkWevuqKXu1dB4gL6cYw6Msobg7Kqs9j',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.folderId).toBe('new-bucket');
    expect(result.id).toMatch(
      /^new-bucket\/chathub-claude4__requirements\.txt__[0-9a-f-]{36}$/,
    );
    expect(subPath).toMatch(
      /^chathub-claude4__requirements\.txt__[0-9a-f-]{36}$/,
    );
  });
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

describe('formatQuotedNameList', () => {
  it('quotes and joins multiple names', () => {
    expect(formatQuotedNameList(['A', 'B', 'C'])).toBe('"A", "B", "C"');
  });

  it('quotes a single name', () => {
    expect(formatQuotedNameList(['Only One'])).toBe('"Only One"');
  });

  it('returns an empty string for an empty list', () => {
    expect(formatQuotedNameList([])).toBe('');
  });
});

describe('rewriteAttachmentUrls', () => {
  it('rewrites a matched url and reference_url without mutating the input', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            attachments: [
              {
                title: 'q1.pdf',
                url: 'files/old-bucket/reports/q1.pdf',
                reference_url: 'files/old-bucket/reports/q1.pdf#page=2',
              },
            ],
          },
        },
      ],
    });
    const urlMap = new Map([
      [
        'files/old-bucket/reports/q1.pdf',
        'files/new-bucket/uploads/2026-07-17/q1.pdf',
      ],
      [
        'files/old-bucket/reports/q1.pdf#page=2',
        'files/new-bucket/uploads/2026-07-17/q1.pdf#page=2',
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, urlMap);

    expect(result.messages[0].custom_content?.attachments?.[0]).toMatchObject({
      url: 'files/new-bucket/uploads/2026-07-17/q1.pdf',
      reference_url: 'files/new-bucket/uploads/2026-07-17/q1.pdf#page=2',
    });
    expect(conversation.messages[0].custom_content?.attachments?.[0].url).toBe(
      'files/old-bucket/reports/q1.pdf',
    );
  });

  it('leaves unmatched attachment references untouched', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            attachments: [{ title: 'x', url: 'files/bucket/unmapped.png' }],
          },
        },
      ],
    });

    const result = rewriteAttachmentUrls(conversation, new Map());

    expect(result.messages[0].custom_content?.attachments?.[0].url).toBe(
      'files/bucket/unmapped.png',
    );
  });

  it('leaves messages without attachments untouched', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'user' as Conversation['messages'][number]['role'],
          content: 'hello',
          timestamp: '2026-07-10T00:00:00.000Z',
        },
      ],
    });

    const result = rewriteAttachmentUrls(conversation, new Map());

    expect(result.messages[0]).toEqual(conversation.messages[0]);
  });
});
