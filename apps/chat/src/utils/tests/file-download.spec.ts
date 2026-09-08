import {
  DownloadDestinationType,
  prepareDownloadDestination,
} from '@epam/ai-dial-chat-hooks';
import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerBrowserDownload } from '../file-download';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  triggerBlobDownload: vi.fn(),
}));

afterEach(() => {
  Reflect.deleteProperty(window, 'showSaveFilePicker');
  vi.restoreAllMocks();
});

describe('file download streaming', () => {
  it('pipes the response body directly to the selected file', async () => {
    const chunks: Uint8Array[] = [];
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable),
      }),
    });

    const destination = await prepareDownloadDestination(
      'reports.zip',
      'application/zip',
    );
    const blobSpy = vi.spyOn(Response.prototype, 'blob');

    await triggerBrowserDownload(
      new Response('streamed archive'),
      'reports.zip',
      destination,
    );

    expect(destination.type).toBe(DownloadDestinationType.Stream);
    expect(blobSpy).not.toHaveBeenCalled();
    expect(new TextDecoder().decode(chunks[0])).toBe('streamed archive');
  });

  it('uses the server-provided Content-Disposition filename when present', async () => {
    vi.mocked(triggerBlobDownload).mockClear();
    const response = new Response('zip-bytes', {
      headers: {
        'Content-Disposition': 'attachment; filename="custom-name.zip"',
      },
    });

    const savedName = await triggerBrowserDownload(response, 'fallback.zip');

    expect(savedName).toBe('custom-name.zip');
    expect(triggerBlobDownload).toHaveBeenCalledWith(
      expect.anything(),
      'custom-name.zip',
    );
  });

  it('resolves the fallback filename when the response carries no Content-Disposition', async () => {
    vi.mocked(triggerBlobDownload).mockClear();
    const response = new Response('');

    const savedName = await triggerBrowserDownload(response, 'fallback.zip');

    expect(savedName).toBe('fallback.zip');
    expect(triggerBlobDownload).toHaveBeenCalledWith(
      expect.anything(),
      'fallback.zip',
    );
  });
});
