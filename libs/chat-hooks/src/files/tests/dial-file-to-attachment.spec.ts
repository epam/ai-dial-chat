import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { describe, expect, it, vi } from 'vitest';
import {
  dialFileToAttachment,
  dialFilesToAttachments,
} from '../dial-file-to-attachment';

const makeFile = (overrides: Partial<DialFile> = {}): DialFile => ({
  id: 'reports/q1.pdf',
  name: 'q1.pdf',
  path: '/My files/reports/q1.pdf',
  folderId: 'bucket',
  nodeType: DialFileNodeType.ITEM,
  contentType: 'application/pdf',
  ...overrides,
});

describe('dialFileToAttachment', () => {
  it('maps a selected storage file to an already-uploaded attachment', () => {
    expect(dialFileToAttachment(makeFile(), 'my-bucket')).toEqual(
      expect.objectContaining({
        id: 'files/my-bucket/reports/q1.pdf',
        name: 'q1.pdf',
        contentType: 'application/pdf',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        url: 'files/my-bucket/reports/q1.pdf',
      }),
    );
  });

  it('keeps the DIAL URL returned by file storage', () => {
    expect(
      dialFileToAttachment(
        makeFile({ url: 'files/my-bucket/reports/q1.pdf' }),
        'my-bucket',
      )?.url,
    ).toBe('files/my-bucket/reports/q1.pdf');
  });

  it('skips folders', () => {
    expect(
      dialFilesToAttachments(
        [makeFile({ nodeType: DialFileNodeType.FOLDER })],
        'my-bucket',
      ),
    ).toEqual([]);
  });

  it('does not call the resolver for a non-image file', () => {
    const resolvePreviewUrl = vi.fn();
    dialFileToAttachment(makeFile(), 'my-bucket', { resolvePreviewUrl });
    expect(resolvePreviewUrl).not.toHaveBeenCalled();
  });

  it("resolves an image file's previewUrl through the injected resolver", () => {
    const resolvePreviewUrl = vi.fn(() => 'resolved-preview-url');
    const attachment = dialFileToAttachment(
      makeFile({ contentType: 'image/png', name: 'photo.png' }),
      'my-bucket',
      { resolvePreviewUrl },
    );
    expect(resolvePreviewUrl).toHaveBeenCalledWith(
      'files/my-bucket/reports/q1.pdf',
    );
    expect(attachment?.previewUrl).toBe('resolved-preview-url');
  });

  it('leaves previewUrl unset for an image file when no resolver is supplied', () => {
    const attachment = dialFileToAttachment(
      makeFile({ contentType: 'image/png', name: 'photo.png' }),
      'my-bucket',
    );
    expect(attachment?.previewUrl).toBeUndefined();
  });

  it('dialFilesToAttachments matches per-file dialFileToAttachment calls', () => {
    const resolvePreviewUrl = vi.fn((url: string) => `preview:${url}`);
    const files = [
      makeFile({ id: 'reports/q1.pdf', name: 'q1.pdf' }),
      makeFile({
        id: 'images/photo.png',
        name: 'photo.png',
        contentType: 'image/png',
      }),
    ];

    const batch = dialFilesToAttachments(files, 'my-bucket', {
      resolvePreviewUrl,
    });
    const individual = files.map(
      (file) => dialFileToAttachment(file, 'my-bucket', { resolvePreviewUrl })!,
    );

    expect(batch).toEqual(individual);
  });
});
