import { finished } from 'node:stream/promises';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesArchiveDownloadService } from '../../archive/files-archive-download.service';
import { ArchiveItemNodeType } from '../../dto/download-archive.dto';
import { FilesListingService } from '../../listing/files-listing.service';

type SdkClient = {
  getFileMetadata: ReturnType<typeof vi.fn>;
  downloadFile: ReturnType<typeof vi.fn>;
};

function makeService(configOverrides: Record<string, unknown> = {}) {
  const configService = {
    get: vi.fn((key: string) => {
      if (key in configOverrides) return configOverrides[key];
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      if (key === 'ARCHIVE_TIMEOUT_MS') return 300_000;
      if (key === 'ARCHIVE_DOWNLOAD_CONCURRENCY') return 32;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    getFileMetadata: vi.fn(),
    downloadFile: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const filesListingService = new FilesListingService(
    dialClient,
    configService,
  );
  const service = new FilesArchiveDownloadService(
    dialClient,
    configService,
    filesListingService,
  );

  return { service, sdkClient };
}

describe('FilesArchiveDownloadService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadArchive', () => {
    it('uses the archive timeout for downloading archive entries', async () => {
      const { service, sdkClient } = makeService();
      const response = new Response('archive content');
      sdkClient.downloadFile.mockResolvedValue({
        error: undefined,
        response,
      });
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

      const result = await service.downloadArchive(
        [
          {
            bucket: 'my-bucket',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: ArchiveItemNodeType.Item,
          },
        ],
        'token',
      );

      result.stream.resume();
      await finished(result.stream);

      expect(timeoutSpy).toHaveBeenCalledWith(300_000);
      expect(sdkClient.downloadFile).toHaveBeenCalledWith(
        'my-bucket',
        'reports/q1.pdf',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/zip',
      });
    });

    it('destroys the returned stream instead of leaking an unhandled rejection when a download errors mid-transfer', async () => {
      const { service, sdkClient } = makeService();
      const failingWebStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('mid-stream failure'));
        },
      });
      sdkClient.downloadFile.mockResolvedValue({
        error: undefined,
        response: { status: 200, body: failingWebStream },
      });

      const result = await service.downloadArchive(
        [
          {
            bucket: 'my-bucket',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: ArchiveItemNodeType.Item,
          },
        ],
        'token',
      );

      const streamError = await new Promise<Error>((resolve) => {
        result.stream.on('error', resolve);
        result.stream.resume();
      });

      expect(streamError.message).toBe('mid-stream failure');
    });
  });
});
