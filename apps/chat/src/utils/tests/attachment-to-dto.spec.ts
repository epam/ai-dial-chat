import type { Attachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { attachmentToDto, attachmentsToDtos } from '../attachment-to-dto';

const makeAttachment = (overrides?: Partial<Attachment>): Attachment => ({
  id: 'test-id',
  name: 'file.pdf',
  contentType: 'application/pdf',
  file: new File(['hello'], 'file.pdf', { type: 'application/pdf' }),
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: 'https://example.com/file.pdf',
  ...overrides,
});

describe('attachmentToDto', () => {
  it('maps an already uploaded attachment to a URL-based DTO', () => {
    const result = attachmentToDto(makeAttachment());

    expect(result).toEqual({
      type: 'application/pdf',
      title: 'file.pdf',
      url: 'https://example.com/file.pdf',
    });
  });

  it('throws when the attachment has not been uploaded yet', () => {
    expect(() => attachmentToDto(makeAttachment({ url: undefined }))).toThrow(
      'has not been uploaded',
    );
  });
});

describe('attachmentsToDtos', () => {
  it('returns undefined for an empty array', () => {
    expect(attachmentsToDtos([])).toBeUndefined();
  });

  it('maps uploaded attachments in order', () => {
    const result = attachmentsToDtos([
      makeAttachment({ name: 'a.pdf', url: 'https://example.com/a.pdf' }),
      makeAttachment({
        name: 'b.png',
        contentType: 'image/png',
        file: new File(['img'], 'b.png', { type: 'image/png' }),
        url: 'https://example.com/b.png',
      }),
    ]);

    expect(result).toEqual([
      {
        type: 'application/pdf',
        title: 'a.pdf',
        url: 'https://example.com/a.pdf',
      },
      {
        type: 'image/png',
        title: 'b.png',
        url: 'https://example.com/b.png',
      },
    ]);
  });
});
