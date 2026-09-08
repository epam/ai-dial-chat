import { ResponseFormat, type Conversation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  buildExportEnvelope,
  buildExportFileName,
  serializeExportEnvelope,
  stripConversationAttachments,
} from '../export-conversation';
import { ExportFileNameKind } from '../types';

const readBlobAsText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const makeConversation = (
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id: 'conv-1',
  folderId: 'root',
  name: 'My Chat',
  model: { id: 'gpt-4o' },
  prompt: 'Be helpful',
  temperature: 0.5,
  messages: [
    {
      role: 'user' as Conversation['messages'][number]['role'],
      content: 'Hello',
      timestamp: '2026-07-10T00:00:00.000Z',
      custom_content: {
        attachments: [{ title: 'file.png', url: 'files/bucket/file.png' }],
      },
    },
  ],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
  ...overrides,
});

describe('buildExportEnvelope', () => {
  it('wraps conversations and folders in a version 5 envelope', () => {
    const conversation = makeConversation();
    const envelope = buildExportEnvelope([conversation], []);

    expect(envelope.version).toBe(5);
    expect(envelope.history).toEqual([conversation]);
    expect(envelope.folders).toEqual([]);
  });

  it('defaults folders to an empty array when omitted', () => {
    const envelope = buildExportEnvelope([makeConversation()]);
    expect(envelope.folders).toEqual([]);
  });

  it('preserves every field of each conversation verbatim', () => {
    const conversation = makeConversation({
      selectedAddons: ['addon-1'],
      responseFormat: ResponseFormat.PlainText,
    });
    const envelope = buildExportEnvelope([conversation], []);

    expect(envelope.history[0]).toEqual(conversation);
  });
});

describe('stripConversationAttachments', () => {
  it('removes the attachment list from every message', () => {
    const stripped = stripConversationAttachments(makeConversation());

    expect(stripped.messages[0].custom_content).toBeUndefined();
  });

  it('leaves no trace of the attachment in the serialized envelope', async () => {
    const envelope = buildExportEnvelope(
      [stripConversationAttachments(makeConversation())],
      [],
    );
    const text = await readBlobAsText(serializeExportEnvelope(envelope));

    expect(text).not.toContain('files/bucket/file.png');
    expect(text).not.toContain('attachments');
  });

  it('keeps the other custom_content fields of a message that had attachments', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: 'Here you go',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            attachments: [{ title: 'out.png', url: 'files/bucket/out.png' }],
            state: { cursor: 7 },
          },
        },
      ],
    });

    const stripped = stripConversationAttachments(conversation);

    expect(stripped.messages[0].custom_content).toEqual({
      state: { cursor: 7 },
    });
  });

  it('removes stage attachments while keeping the stages themselves', () => {
    const conversation = makeConversation({
      messages: [
        {
          role: 'assistant' as Conversation['messages'][number]['role'],
          content: 'Done',
          timestamp: '2026-07-10T00:00:00.000Z',
          custom_content: {
            stages: [
              {
                index: 0,
                name: 'Lookup',
                status: null,
                attachments: [
                  { title: 'stage.png', url: 'files/bucket/stage.png' },
                ],
              },
            ],
          },
        },
      ],
    });

    const stripped = stripConversationAttachments(conversation);

    expect(stripped.messages[0].custom_content?.stages).toEqual([
      { index: 0, name: 'Lookup', status: null },
    ]);
  });

  it('leaves a message without custom_content untouched', () => {
    const message = {
      role: 'user' as Conversation['messages'][number]['role'],
      content: 'Hi',
      timestamp: '2026-07-10T00:00:00.000Z',
    };
    const stripped = stripConversationAttachments(
      makeConversation({ messages: [message] }),
    );

    expect(stripped.messages[0]).toBe(message);
  });

  it('preserves every non-message conversation field', () => {
    const conversation = makeConversation();
    const stripped = stripConversationAttachments(conversation);

    expect({ ...stripped, messages: [] }).toEqual({
      ...conversation,
      messages: [],
    });
  });

  it('does not mutate the source conversation', () => {
    const conversation = makeConversation();
    stripConversationAttachments(conversation);

    expect(conversation.messages[0].custom_content?.attachments).toHaveLength(
      1,
    );
  });
});

describe('serializeExportEnvelope', () => {
  it('serializes the envelope to a JSON Blob', async () => {
    const envelope = buildExportEnvelope([makeConversation()], []);
    const blob = serializeExportEnvelope(envelope);

    expect(blob.type).toBe('application/json');
    const parsed = JSON.parse(await readBlobAsText(blob));
    expect(parsed.version).toBe(5);
    expect(parsed.history).toHaveLength(1);
  });
});

describe('buildExportFileName', () => {
  const date = new Date(2026, 6, 10); // 2026-07-10 (month is 0-indexed)

  it('builds the single-conversation-without-attachments file name', () => {
    expect(
      buildExportFileName(
        ExportFileNameKind.SingleConversation,
        'ai_dial',
        date,
      ),
    ).toBe('2026-07-10_ai_dial_chat_conversation.json');
  });

  it('builds the single-conversation-with-attachments file name with a .dial extension', () => {
    expect(
      buildExportFileName(
        ExportFileNameKind.SingleConversationWithAttachments,
        'ai_dial',
        date,
      ),
    ).toBe('2026-07-10_ai_dial_chat_with_attachments.dial');
  });

  it('builds the all-conversations file name', () => {
    expect(
      buildExportFileName(
        ExportFileNameKind.AllConversationsHistory,
        'ai_dial',
        date,
      ),
    ).toBe('2026-07-10_ai_dial_chat_conversations_history.json');
  });

  it('zero-pads single-digit month and day', () => {
    const earlyDate = new Date(2026, 0, 5); // 2026-01-05
    expect(
      buildExportFileName(
        ExportFileNameKind.SingleConversation,
        'ai_dial',
        earlyDate,
      ),
    ).toBe('2026-01-05_ai_dial_chat_conversation.json');
  });
});
