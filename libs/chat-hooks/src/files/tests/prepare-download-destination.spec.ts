import { afterEach, describe, expect, it, vi } from 'vitest';
import { DownloadDestinationType } from '../download-destination';
import { prepareDownloadDestination } from '../prepare-download-destination';

afterEach(() => {
  Reflect.deleteProperty(window, 'showSaveFilePicker');
  vi.restoreAllMocks();
});

describe('prepareDownloadDestination', () => {
  it('resolves a Stream destination when the file picker API is available', async () => {
    const writable = new WritableStream<Uint8Array>();
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

    expect(destination.type).toBe(DownloadDestinationType.Stream);
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
