import {
  AttachmentType,
  type MessageAttachment,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { toDisplayAttachment } from './to-display-attachment';

describe('toDisplayAttachment', () => {
  it('maps image attachments to display images', () => {
    const attachment: MessageAttachment = {
      title: 'chart.png',
      type: 'image/png',
      url: 'files/chart.png',
    };

    const displayAttachment = toDisplayAttachment(attachment, 0);

    expect(displayAttachment).toMatchObject({
      id: 'files/chart.png',
      name: 'chart.png',
      contentType: 'image/png',
      type: AttachmentType.Image,
      previewUrl: 'files/chart.png',
    });
  });

  it('treats attachments without a MIME type as files', () => {
    const attachment: MessageAttachment = {
      title: 'report',
      url: 'files/report',
    };

    const displayAttachment = toDisplayAttachment(attachment, 0);

    expect(displayAttachment).toMatchObject({
      id: 'files/report',
      name: 'report',
      contentType: '',
      type: AttachmentType.File,
    });
    expect(displayAttachment.previewUrl).toBeUndefined();
  });
});
