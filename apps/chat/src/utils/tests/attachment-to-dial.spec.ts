import type { Attachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it, vi } from 'vitest';
import {
  attachmentToDialAttachment,
  attachmentsToDialAttachments,
} from '../attachment-to-dial';

const makeAttachment = (overrides?: Partial<Attachment>): Attachment => ({
  id: 'test-id',
  name: 'file.pdf',
  contentType: 'application/pdf',
  file: new File(['hello'], 'file.pdf', { type: 'application/pdf' }),
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('attachmentToDialAttachment', () => {
  it('resolves to a DialAttachment with correct type and title', async () => {
    const attachment = makeAttachment();
    const result = await attachmentToDialAttachment(attachment);
    expect(result.type).toBe('application/pdf');
    expect(result.title).toBe('file.pdf');
  });

  it('strips the data-URL prefix from the data field', async () => {
    const attachment = makeAttachment();
    const result = await attachmentToDialAttachment(attachment);
    expect(result.data).not.toMatch(/^data:/);
  });

  it('rejects when FileReader fires an error', async () => {
    const mockFile = {
      size: 5,
      type: 'application/pdf',
    } as File;
    const attachment = makeAttachment({ file: mockFile });

    // Spy on FileReader to simulate an error
    const originalFileReader = globalThis.FileReader;
    const mockReader = {
      readAsDataURL: vi.fn(function (this: { onerror?: (e: unknown) => void }) {
        setTimeout(() => this.onerror?.(new Error('read error')), 0);
      }),
      onload: null as ((e: unknown) => void) | null,
      onerror: null as ((e: unknown) => void) | null,
      error: new DOMException('read failed'),
    };
    globalThis.FileReader = vi.fn(
      () => mockReader,
    ) as unknown as typeof FileReader;

    await expect(attachmentToDialAttachment(attachment)).rejects.toBeDefined();
    globalThis.FileReader = originalFileReader;
  });
});

describe('attachmentsToDialAttachments', () => {
  it('returns undefined for an empty array', async () => {
    const result = await attachmentsToDialAttachments([]);
    expect(result).toBeUndefined();
  });

  it('encodes all attachments in order', async () => {
    const a1 = makeAttachment({
      name: 'a.pdf',
      contentType: 'application/pdf',
    });
    const a2 = makeAttachment({
      name: 'img.png',
      contentType: 'image/png',
      file: new File(['img'], 'img.png', { type: 'image/png' }),
    });
    const result = await attachmentsToDialAttachments([a1, a2]);
    expect(result).toHaveLength(2);
    expect(result?.[0].title).toBe('a.pdf');
    expect(result?.[1].title).toBe('img.png');
  });
});
