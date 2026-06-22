import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DownloadDestinationType,
  prepareDownloadDestination,
  triggerBrowserDownload,
} from '../file-download';

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

  it('falls back to a blob when the file picker API is unavailable', async () => {
    const destination = await prepareDownloadDestination('reports.zip');

    expect(destination).toEqual({ type: DownloadDestinationType.Blob });
  });

  it('reports a cancelled save dialog without starting a download', async () => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi
        .fn()
        .mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
    });

    const destination = await prepareDownloadDestination('reports.zip');

    expect(destination).toEqual({
      type: DownloadDestinationType.Cancelled,
    });
  });
});
