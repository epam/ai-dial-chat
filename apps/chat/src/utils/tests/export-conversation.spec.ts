import type { Conversation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';

const readBlobAsText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
import { ExportFileNameKind } from '../../types/conversation-export';
import {
  buildExportEnvelope,
  buildExportFileName,
  serializeExportEnvelope,
} from '../export-conversation';

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
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
      responseFormat: { type: 'text' } as Conversation['responseFormat'],
    });
    const envelope = buildExportEnvelope([conversation], []);

    expect(envelope.history[0]).toEqual(conversation);
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
      buildExportFileName(ExportFileNameKind.SingleConversation, 'ai_dial', date),
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
