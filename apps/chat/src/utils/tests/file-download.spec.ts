import { DownloadDestinationType } from '@epam/ai-dial-chat-hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
});
