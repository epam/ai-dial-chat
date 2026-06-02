import { AttachmentType } from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';
import { describe, expect, it } from 'vitest';
import { attachmentDtoToDisplayAttachment } from '../attachment-dto-to-display';

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
});
