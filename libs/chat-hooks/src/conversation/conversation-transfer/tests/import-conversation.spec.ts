import type { Conversation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { createUploadPathAllocator } from '../build-upload-path';
import {
  formatQuotedNameList,
  parseImportEnvelope,
  planAttachmentUploads,
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

  it('preserves multi-segment deployment id path components (e.g. anthropic/claude-3)', () => {
    const conversation = makeConversation({
      id: 'old-bucket/anthropic/claude-3__My Chat__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket',
      model: { id: 'anthropic/claude-3' },
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.folderId).toBe('new-bucket');
    expect(result.id).toMatch(
      /^new-bucket\/anthropic\/claude-3__My Chat__[0-9a-f-]{36}$/,
    );
    expect(subPath).toMatch(/^anthropic\/claude-3__My Chat__[0-9a-f-]{36}$/);
  });

  it('preserves multi-segment deployment id together with folder segments', () => {
    const conversation = makeConversation({
      id: 'old-bucket/Folder 1/anthropic/claude-3__My Chat__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket/Folder 1',
      model: { id: 'anthropic/claude-3' },
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.folderId).toBe('new-bucket/Folder 1');
    expect(result.id).toMatch(
      /^new-bucket\/Folder 1\/anthropic\/claude-3__My Chat__[0-9a-f-]{36}$/,
    );
    expect(subPath).toMatch(
      /^Folder 1\/anthropic\/claude-3__My Chat__[0-9a-f-]{36}$/,
    );
  });

  it('strips old chat\'s raw "conversations/" resource prefix before rebasing', () => {
    const conversation = makeConversation({
      id: 'conversations/59CAnBu6LZrtfagTrHaP2rJhuMLT3rYQS7UkWevuqKXu1dB4gL6cYw6Msobg7Kqs9j/chathub-claude4__requirements.txt',
      folderId:
        'conversations/59CAnBu6LZrtfagTrHaP2rJhuMLT3rYQS7UkWevuqKXu1dB4gL6cYw6Msobg7Kqs9j',
      name: 'requirements.txt',
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

  /*
   * Issue #8668: both chats export the *initial*, first-message-derived title
   * in the filename and keep the current one only in `name`. The list derives
   * a row's title from the filename for every item it does not read back, so
   * the filename has to carry the authoritative name.
   */
  it("writes the conversation's own name into the filename, replacing the exported first-message title", () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-5__analyze this document and generate a test__10a6e7c8-1896-4d65-89bc-c158e23a304e',
      folderId: 'old-bucket',
      name: 'Self-evaluation quiz for chapter 1 on numbers',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(subPath).toMatch(
      /^gpt-5__Self-evaluation quiz for chapter 1 on numbers__[0-9a-f-]{36}$/,
    );
    expect(result.id).toBe(`new-bucket/${subPath}`);
    expect(subPath).not.toContain('analyze this document');
  });

  it('replaces the title of an old-chat filename that carries no trailing uuid', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__hello',
      folderId: 'old-bucket',
      name: 'Greeting and assistance inquiry',
    });
    const { subPath } = rebaseConversationId(conversation, 'new-bucket');

    expect(subPath).toMatch(
      /^gpt-4o__Greeting and assistance inquiry__[0-9a-f-]{36}$/,
    );
  });

  it('keeps a title containing the __ separator intact', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__a__b__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket',
      name: 'left__right',
    });
    const { subPath } = rebaseConversationId(conversation, 'new-bucket');

    expect(subPath).toMatch(/^gpt-4o__left__right__[0-9a-f-]{36}$/);
  });

  it('preserves a versioned application deployment id and its version suffix', () => {
    const conversation = makeConversation({
      id: 'old-bucket/applications/app-bucket/my-app__1.0.0__what can you do?__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket',
      model: { id: 'applications/app-bucket/my-app__1.0.0' },
      name: 'Capabilities overview',
    });
    const { subPath } = rebaseConversationId(conversation, 'new-bucket');

    expect(subPath).toMatch(
      /^applications\/app-bucket\/my-app__1\.0\.0__Capabilities overview__[0-9a-f-]{36}$/,
    );
  });

  it('treats a numeric title outside an applications path as a title, not a version suffix', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__1.0__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket',
      name: 'Number sequence inquiry',
    });
    const { subPath } = rebaseConversationId(conversation, 'new-bucket');

    expect(subPath).toMatch(/^gpt-4o__Number sequence inquiry__[0-9a-f-]{36}$/);
  });

  it('strips characters DIAL Core rejects from the name and stores the sanitized one', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__hello',
      folderId: 'old-bucket',
      name: 'Q1: revenue/cost {draft}',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(subPath).toMatch(/^gpt-4o__Q1 revenuecost draft__[0-9a-f-]{36}$/);
    /* The stored name must equal the filename title, so the list renders the
     * same string whether or not it read the body back. */
    expect(result.name).toBe('Q1 revenuecost draft');
  });

  it('keeps only the first non-empty line of a multi-line name', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__hello',
      folderId: 'old-bucket',
      name: '\n  First line  \nSecond line',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(subPath).toMatch(/^gpt-4o__First line__[0-9a-f-]{36}$/);
    expect(result.name).toBe('First line');
  });

  it('truncates a name longer than 255 utf-8 bytes', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__hello',
      folderId: 'old-bucket',
      name: 'a'.repeat(300),
    });
    const { conversation: result } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(result.name).toBe('a'.repeat(255));
  });

  it('falls back to the exported filename title when the name sanitizes to nothing', () => {
    const conversation = makeConversation({
      id: 'old-bucket/gpt-4o__hello__550e8400-e29b-41d4-a716-446655440000',
      folderId: 'old-bucket',
      name: '///',
    });
    const { conversation: result, subPath } = rebaseConversationId(
      conversation,
      'new-bucket',
    );

    expect(subPath).toMatch(/^gpt-4o__hello__[0-9a-f-]{36}$/);
    /* Nothing usable to write back, so the source name is left untouched. */
    expect(result.name).toBe('///');
  });

  it('only re-suffixes a filename that has no __ separator at all', () => {
    const conversation = makeConversation({
      id: 'old-bucket/legacy-name',
      folderId: 'old-bucket',
      name: 'Some Name',
    });
    const { subPath } = rebaseConversationId(conversation, 'new-bucket');

    expect(subPath).toMatch(/^legacy-name__[0-9a-f-]{36}$/);
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

/** Builds a message carrying a single DIAL-file attachment referencing `fileId`. */
const makeAttachmentMessage = (
  fileId: string,
  title: string,
): Conversation['messages'][number] => ({
  role: 'assistant' as Conversation['messages'][number]['role'],
  content: '',
  timestamp: '2026-07-10T00:00:00.000Z',
  custom_content: { attachments: [{ title, url: fileId }] },
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
    const targetMap = new Map([
      [
        'files/old-bucket/reports/q1.pdf',
        { url: 'files/new-bucket/uploads/2026-07/q1.pdf' },
      ],
      [
        'files/old-bucket/reports/q1.pdf#page=2',
        { url: 'files/new-bucket/uploads/2026-07/q1.pdf#page=2' },
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, targetMap);

    expect(result.messages[0].custom_content?.attachments?.[0]).toMatchObject({
      url: 'files/new-bucket/uploads/2026-07/q1.pdf',
      reference_url: 'files/new-bucket/uploads/2026-07/q1.pdf#page=2',
    });
    expect(conversation.messages[0].custom_content?.attachments?.[0].url).toBe(
      'files/old-bucket/reports/q1.pdf',
    );
  });

  it('rewrites the title when the target carries a renamed title', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
      ],
    });
    const targetMap = new Map([
      [
        'files/old-bucket/reports/q1.pdf',
        {
          url: 'files/new-bucket/uploads/2026-07/q1 (1).pdf',
          title: 'q1 (1).pdf',
        },
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, targetMap);

    expect(result.messages[0].custom_content?.attachments?.[0].title).toBe(
      'q1 (1).pdf',
    );
  });

  it('leaves the title untouched when the target carries no title', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
      ],
    });
    const targetMap = new Map([
      [
        'files/old-bucket/reports/q1.pdf',
        { url: 'files/new-bucket/uploads/2026-07/q1.pdf' },
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, targetMap);

    expect(result.messages[0].custom_content?.attachments?.[0].title).toBe(
      'q1.pdf',
    );
  });

  it('does not carry an unparseable anchor onto the rewritten reference', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage(
          'files/old-bucket/reports/q1.pdf#"><script>',
          'q1.pdf',
        ),
      ],
    });
    const targetMap = new Map([
      [
        'files/old-bucket/reports/q1.pdf',
        { url: 'files/new-bucket/uploads/2026-07/q1.pdf' },
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, targetMap);

    expect(result.messages[0].custom_content?.attachments?.[0].url).toBe(
      'files/new-bucket/uploads/2026-07/q1.pdf',
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

  it('rewrites a file an agent produced inside an execution stage', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            stages: [
              {
                index: 0,
                name: 'Generate report',
                status: null,
                attachments: [
                  {
                    title: 'chart.png',
                    url: 'files/app-bucket/appdata/chart.png',
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    const targetMap = new Map([
      [
        'files/app-bucket/appdata/chart.png',
        { url: 'files/new-bucket/uploads/2026-07/chart.png' },
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, targetMap);

    expect(
      result.messages[0].custom_content?.stages?.[0].attachments?.[0].url,
    ).toBe('files/new-bucket/uploads/2026-07/chart.png');
  });

  it("rewrites a citation's source document and keeps its page anchor", () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            annotations: [
              {
                body: {
                  source: {
                    type: 'attachment' as const,
                    attachment: {
                      type: 'application/pdf',
                      url: 'files/old-bucket/sources/spec.pdf#page=7',
                      title: 'spec.pdf',
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    });
    const targetMap = new Map([
      [
        'files/old-bucket/sources/spec.pdf',
        {
          url: 'files/new-bucket/uploads/2026-07/spec (1).pdf',
          title: 'spec (1).pdf',
        },
      ],
    ]);

    const result = rewriteAttachmentUrls(conversation, targetMap);

    expect(
      result.messages[0].custom_content?.annotations?.[0].body?.source
        ?.attachment,
    ).toMatchObject({
      url: 'files/new-bucket/uploads/2026-07/spec (1).pdf#page=7',
      title: 'spec (1).pdf',
    });
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

describe('planAttachmentUploads', () => {
  const date = new Date(2026, 6, 17);

  it('allocates a plan item in collectAttachmentRefs order', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
        makeAttachmentMessage('files/old-bucket/2025/q2.pdf', 'q2.pdf'),
      ],
    });
    const attachmentBytes = new Map([
      ['reports/q1.pdf', new Uint8Array([1])],
      ['2025/q2.pdf', new Uint8Array([2])],
    ]);
    const allocator = createUploadPathAllocator({ date });

    const { plan, skippedNames } = planAttachmentUploads(
      conversation,
      attachmentBytes,
      allocator,
    );

    expect(skippedNames).toEqual([]);
    expect(plan.map((item) => item.allocated.fileName)).toEqual([
      'q1.pdf',
      'q2.pdf',
    ]);
  });

  it('suffixes the second of two different source paths sharing a basename', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
        makeAttachmentMessage('files/old-bucket/2025/q1.pdf', 'q1.pdf'),
      ],
    });
    const attachmentBytes = new Map([
      ['reports/q1.pdf', new Uint8Array([1])],
      ['2025/q1.pdf', new Uint8Array([2])],
    ]);
    const allocator = createUploadPathAllocator({ date });

    const { plan } = planAttachmentUploads(
      conversation,
      attachmentBytes,
      allocator,
    );

    expect(plan.map((item) => item.allocated.fileName)).toEqual([
      'q1.pdf',
      'q1 (1).pdf',
    ]);
  });

  it('skips a file id with no path segment without consuming an allocator index', () => {
    /* Starts with `files/` (passes isDialFileId) but has no `/` after the
     * bucket, so resolveDialFileBucketAndPath returns undefined. */
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage('files/only-bucket-no-path', 'missing'),
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
      ],
    });
    const attachmentBytes = new Map([['reports/q1.pdf', new Uint8Array([1])]]);
    const allocator = createUploadPathAllocator({ date });

    const { plan, skippedNames } = planAttachmentUploads(
      conversation,
      attachmentBytes,
      allocator,
    );

    expect(skippedNames).toEqual(['only-bucket-no-path']);
    expect(plan.map((item) => item.allocated.fileName)).toEqual(['q1.pdf']);
  });

  it('skips a reference with no bytes in the archive without consuming an allocator index', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage(
          'files/old-bucket/reports/missing.pdf',
          'missing.pdf',
        ),
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
      ],
    });
    const attachmentBytes = new Map([['reports/q1.pdf', new Uint8Array([1])]]);
    const allocator = createUploadPathAllocator({ date });

    const { plan, skippedNames } = planAttachmentUploads(
      conversation,
      attachmentBytes,
      allocator,
    );

    expect(skippedNames).toEqual(['missing.pdf']);
    expect(plan.map((item) => item.allocated.fileName)).toEqual(['q1.pdf']);
  });

  it('plans an upload for a file referenced only from an execution stage', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: '',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            stages: [
              {
                index: 0,
                name: 'Generate report',
                status: null,
                attachments: [
                  {
                    title: 'chart.png',
                    url: 'files/app-bucket/appdata/chart.png',
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    const attachmentBytes = new Map([
      ['appdata/chart.png', new Uint8Array([1])],
    ]);
    const allocator = createUploadPathAllocator({ date });

    const { plan, skippedNames } = planAttachmentUploads(
      conversation,
      attachmentBytes,
      allocator,
    );

    expect(skippedNames).toEqual([]);
    expect(plan.map((item) => item.allocated.fileName)).toEqual(['chart.png']);
  });

  it('suffixes a name already present in a pre-filled allocator', () => {
    const conversation = makeConversation({
      messages: [
        makeAttachmentMessage('files/old-bucket/reports/q1.pdf', 'q1.pdf'),
      ],
    });
    const attachmentBytes = new Map([['reports/q1.pdf', new Uint8Array([1])]]);
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['q1.pdf'],
    });

    const { plan } = planAttachmentUploads(
      conversation,
      attachmentBytes,
      allocator,
    );

    expect(plan[0].allocated.fileName).toBe('q1 (1).pdf');
  });
});
