import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesApi } from '../api-client';
import { uploadFile } from '../files.api';

describe('uploadFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated FilesApi with the picked file', async () => {
    const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
    const uploadSpy = vi.spyOn(filesApi, 'uploadFile').mockResolvedValue({
      url: 'files/bucket/uploads/2026-05-26/doc.pdf',
      name: 'doc.pdf',
      contentType: 'application/pdf',
      contentLength: 5,
    });

    await uploadFile(file);

    expect(uploadSpy).toHaveBeenCalledWith({ file });
  });

  it('maps the FileUploadResponseDto into an ApiAttachment', async () => {
    const file = new File(['x'], 'image.png', { type: 'image/png' });
    vi.spyOn(filesApi, 'uploadFile').mockResolvedValue({
      url: 'files/bucket/uploads/2026-05-26/image.png',
      name: 'image.png',
      contentType: 'image/png',
      contentLength: 1,
    });

    const result = await uploadFile(file);

    expect(result).toEqual({
      type: 'image/png',
      title: 'image.png',
      url: 'files/bucket/uploads/2026-05-26/image.png',
    });
  });

  it('uses the deduplicated name from the response, not the original File name', async () => {
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    vi.spyOn(filesApi, 'uploadFile').mockResolvedValue({
      url: 'files/bucket/uploads/2026-05-26/report (1).pdf',
      name: 'report (1).pdf',
      contentType: 'application/pdf',
      contentLength: 1,
    });

    const result = await uploadFile(file);

    expect(result.title).toBe('report (1).pdf');
    expect(result.url).toBe('files/bucket/uploads/2026-05-26/report (1).pdf');
  });

  it('propagates upload errors', async () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    vi.spyOn(filesApi, 'uploadFile').mockRejectedValue(
      new Error('413 too large'),
    );

    await expect(uploadFile(file)).rejects.toThrow('413 too large');
  });
});
