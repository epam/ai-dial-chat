import { AttachmentType } from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import { attachmentDtoToDisplayAttachment } from '../attachment-dto-to-display';

/*
 * resolveCatalogIconUrl is imported by the module under test; mock it here so
 * the spec doesn't depend on API endpoint constants.
 */
vi.mock('../icon-path', () => ({
  resolveCatalogIconUrl: (url: string) =>
    url.startsWith('files/')
      ? `/api/v1/files/download?path=${url.slice('files/'.length)}`
      : url,
}));

describe('attachmentDtoToDisplayAttachment', () => {
  it('maps a file DTO to a display attachment without a local File', () => {
    const dto: AttachmentDto = {
      type: 'application/pdf',
      title: 'report.pdf',
      data: 'SGVsbG8=',
    };

    const attachment = attachmentDtoToDisplayAttachment(dto);

    expect(attachment).toMatchObject({
      id: 'SGVsbG8=',
      name: 'report.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
    });
    expect('file' in attachment).toBe(false);
  });

  it('uses inline image data as previewUrl', () => {
    const dto: AttachmentDto = {
      type: 'image/png',
      title: 'image.png',
      data: 'iVBORw0KGgo=',
    };

    const attachment = attachmentDtoToDisplayAttachment(dto);

    expect(attachment.type).toBe(AttachmentType.Image);
    expect(attachment.previewUrl).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('preserves inline data for non-image attachments', () => {
    const dto: AttachmentDto = {
      type: 'text/markdown',
      title: '[1] RAG search result',
      data: 'The **main idea** is to support life sciences research.',
    };

    const attachment = attachmentDtoToDisplayAttachment(dto);

    expect(attachment.type).toBe(AttachmentType.File);
    expect(attachment.data).toBe(
      'The **main idea** is to support life sciences research.',
    );
    expect(attachment.previewUrl).toBeUndefined();
  });

  it('resolves a DIAL file ID url to a download URL for image previewUrl', () => {
    const dto: AttachmentDto = {
      type: 'image/jpeg',
      title: 'photo.jpg',
      url: 'files/user-bucket/uploads/2026-06/photo.jpg',
    };

    const attachment = attachmentDtoToDisplayAttachment(dto);

    expect(attachment.type).toBe(AttachmentType.Image);
    expect(attachment.url).toBe('files/user-bucket/uploads/2026-06/photo.jpg');
    expect(attachment.previewUrl).toBe(
      '/api/v1/files/download?path=user-bucket/uploads/2026-06/photo.jpg',
    );
  });
});
