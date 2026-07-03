import { describe, expect, it, vi } from 'vitest';
import type { MessageAttachment } from '../../models/chat';
import { AttachmentType } from '../../types/attachment';
import { messageAttachmentToDisplayAttachment } from '../message-attachment-to-display';

describe('messageAttachmentToDisplayAttachment', () => {
  it('maps an image attachment with a remote url using default resolvers', () => {
    const dto: MessageAttachment = {
      type: 'image/png',
      title: 'chart.png',
      url: 'files/user-bucket/chart.png',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment).toMatchObject({
      id: 'files/user-bucket/chart.png',
      name: 'chart.png',
      contentType: 'image/png',
      type: AttachmentType.Image,
      url: 'files/user-bucket/chart.png',
      previewUrl: 'files/user-bucket/chart.png',
    });
  });

  it('uses a custom resolvePreviewUrl callback when provided', () => {
    const dto: MessageAttachment = {
      type: 'image/jpeg',
      title: 'photo.jpg',
      url: 'files/user-bucket/photo.jpg',
    };
    const resolvePreviewUrl = vi.fn(
      () => '/api/v1/files/download?path=user-bucket/photo.jpg',
    );

    const attachment = messageAttachmentToDisplayAttachment(dto, {
      resolvePreviewUrl,
    });

    expect(resolvePreviewUrl).toHaveBeenCalledWith(dto);
    expect(attachment.previewUrl).toBe(
      '/api/v1/files/download?path=user-bucket/photo.jpg',
    );
  });

  it('maps an audio attachment with a remote url using default resolvers (fixed gap)', () => {
    const dto: MessageAttachment = {
      type: 'audio/mpeg',
      title: 'recording.mp3',
      url: 'files/user-bucket/recording.mp3',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.type).toBe(AttachmentType.Audio);
    expect(attachment.playUrl).toBe('files/user-bucket/recording.mp3');
  });

  it('uses a custom resolvePlayUrl callback when provided', () => {
    const dto: MessageAttachment = {
      type: 'audio/wav',
      title: 'voice.wav',
      url: 'files/user-bucket/voice.wav',
    };
    const resolvePlayUrl = vi.fn(
      () => '/api/v1/files/download?path=user-bucket/voice.wav',
    );

    const attachment = messageAttachmentToDisplayAttachment(dto, {
      resolvePlayUrl,
    });

    expect(resolvePlayUrl).toHaveBeenCalledWith(dto);
    expect(attachment.playUrl).toBe(
      '/api/v1/files/download?path=user-bucket/voice.wav',
    );
  });

  it('synthesizes a data: URL for an inline-data audio attachment without a url', () => {
    const dto: MessageAttachment = {
      type: 'audio/mpeg',
      title: 'clip.mp3',
      data: 'SGVsbG8=',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.playUrl).toBe('data:audio/mpeg;base64,SGVsbG8=');
  });

  it('synthesizes a data: URL for an inline-data image attachment without a url', () => {
    const dto: MessageAttachment = {
      type: 'image/png',
      title: 'image.png',
      data: 'iVBORw0KGgo=',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.previewUrl).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('preserves inline data for non-image, non-audio attachments', () => {
    const dto: MessageAttachment = {
      type: 'text/markdown',
      title: '[1] RAG search result',
      data: 'The **main idea** is to support life sciences research.',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.type).toBe(AttachmentType.File);
    expect(attachment.data).toBe(
      'The **main idea** is to support life sciences research.',
    );
    expect(attachment.previewUrl).toBeUndefined();
    expect(attachment.url).toBeUndefined();
  });

  it('treats attachments without a MIME type as files', () => {
    const dto: MessageAttachment = {
      title: 'report',
      url: 'files/report',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment).toMatchObject({
      id: 'files/report',
      name: 'report',
      contentType: '',
      type: AttachmentType.File,
    });
    expect(attachment.previewUrl).toBeUndefined();
    expect(attachment.playUrl).toBeUndefined();
  });

  it('falls back the id to data when url is absent', () => {
    const dto: MessageAttachment = {
      type: 'application/pdf',
      title: 'report.pdf',
      data: 'SGVsbG8=',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.id).toBe('SGVsbG8=');
  });

  it('falls back the id to title when neither url nor data is present', () => {
    const dto: MessageAttachment = {
      type: 'application/pdf',
      title: 'report.pdf',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.id).toBe('report.pdf');
  });

  it('includes referenceUrl when present on the dto', () => {
    const dto: MessageAttachment = {
      type: 'application/pdf',
      title: 'report.pdf',
      reference_url: 'https://example.com/report.pdf',
    };

    const attachment = messageAttachmentToDisplayAttachment(dto);

    expect(attachment.referenceUrl).toBe('https://example.com/report.pdf');
  });
});
