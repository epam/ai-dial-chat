import type { Conversation, Message } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { collectAttachmentRefs, splitFileIdAnchor } from '../attachment-refs';

const makeConversation = (messages: Message[]): Conversation => ({
  id: 'bucket-a/gpt-4o__My Chat',
  folderId: 'bucket-a',
  name: 'My Chat',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 0.5,
  messages,
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
});

const makeMessage = (customContent: Message['custom_content']): Message =>
  ({
    role: 'assistant',
    content: '',
    timestamp: '2026-07-10T00:00:00.000Z',
    custom_content: customContent,
  }) as Message;

describe('splitFileIdAnchor', () => {
  it('separates a trailing anchor from the file id', () => {
    expect(splitFileIdAnchor('files/b/doc.pdf#page=3')).toEqual({
      fileId: 'files/b/doc.pdf',
      anchor: '#page=3',
    });
  });

  it('reports an empty anchor when there is none', () => {
    expect(splitFileIdAnchor('files/b/doc.pdf')).toEqual({
      fileId: 'files/b/doc.pdf',
      anchor: '',
    });
  });

  it('drops an anchor carrying characters no reader parses, keeping the file id', () => {
    expect(splitFileIdAnchor('files/b/doc.pdf#"><script>')).toEqual({
      fileId: 'files/b/doc.pdf',
      anchor: '',
    });
  });
});

describe('collectAttachmentRefs', () => {
  it('collects message attachments', () => {
    const conversation = makeConversation([
      makeMessage({
        attachments: [{ title: 'q1.pdf', url: 'files/b/reports/q1.pdf' }],
      }),
    ]);

    expect(collectAttachmentRefs(conversation)).toEqual([
      { fileId: 'files/b/reports/q1.pdf' },
    ]);
  });

  it('collects files an agent produced inside an execution stage', () => {
    const conversation = makeConversation([
      makeMessage({
        stages: [
          {
            index: 0,
            name: 'Generate report',
            status: null,
            attachments: [
              { title: 'chart.png', url: 'files/app-bucket/appdata/chart.png' },
            ],
          },
        ],
      }),
    ]);

    expect(collectAttachmentRefs(conversation)).toEqual([
      { fileId: 'files/app-bucket/appdata/chart.png' },
    ]);
  });

  it('collects the source document a citation points at, without its anchor', () => {
    const conversation = makeConversation([
      makeMessage({
        annotations: [
          {
            body: {
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/pdf',
                  url: 'files/b/sources/spec.pdf#page=7',
                  title: 'spec.pdf',
                },
              },
            },
          },
        ],
      }),
    ]);

    expect(collectAttachmentRefs(conversation)).toEqual([
      { fileId: 'files/b/sources/spec.pdf' },
    ]);
  });

  it('collects both url and reference_url when they name different files', () => {
    const conversation = makeConversation([
      makeMessage({
        attachments: [
          {
            title: 'q1.pdf',
            url: 'files/b/reports/q1.pdf',
            reference_url: 'files/b/sources/raw.csv',
          },
        ],
      }),
    ]);

    expect(collectAttachmentRefs(conversation)).toEqual([
      { fileId: 'files/b/reports/q1.pdf' },
      { fileId: 'files/b/sources/raw.csv' },
    ]);
  });

  it('dedupes a file referenced by a stage, a message, and a citation', () => {
    const fileId = 'files/app-bucket/appdata/report.xlsx';
    const conversation = makeConversation([
      makeMessage({
        attachments: [{ title: 'report.xlsx', url: fileId }],
        stages: [
          {
            index: 0,
            name: 'Build workbook',
            status: null,
            attachments: [{ title: 'report.xlsx', url: fileId }],
          },
        ],
        annotations: [
          {
            body: {
              source: {
                type: 'attachment',
                attachment: {
                  type: 'application/vnd.ms-excel',
                  url: `${fileId}#sheet=1`,
                },
              },
            },
          },
        ],
      }),
    ]);

    expect(collectAttachmentRefs(conversation)).toEqual([{ fileId }]);
  });

  it('ignores references that are not DIAL file ids', () => {
    const conversation = makeConversation([
      makeMessage({
        attachments: [
          { title: 'external', url: 'https://example.com/report.pdf' },
          { title: 'inline', data: 'YmFzZTY0' },
        ],
      }),
    ]);

    expect(collectAttachmentRefs(conversation)).toEqual([]);
  });
});
