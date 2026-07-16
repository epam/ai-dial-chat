import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesDownloadService } from '../../download/files-download.service';

type SdkClient = {
  downloadFile: ReturnType<typeof vi.fn>;
};

function makeService(configOverrides: Record<string, unknown> = {}) {
  const configService = {
    get: vi.fn((key: string) => {
      if (key in configOverrides) return configOverrides[key];
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    downloadFile: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new FilesDownloadService(dialClient, configService);

  return { service, sdkClient };
}

const okDownload = (
  body: ReadableStream,
  headers: Record<string, string | null>,
) => ({
  error: undefined,
  response: {
    status: 200,
    body,
    headers: { get: (h: string) => headers[h] ?? null },
  },
});

const errResponse = (status: number) => ({
  error: new Error('HTTP error'),
  response: { status, headers: { get: () => null } },
  data: undefined,
});

describe('FilesDownloadService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadFile', () => {
    it('returns stream and allowlisted headers on success', async () => {
      const { service, sdkClient } = makeService();
      const webStream = new ReadableStream();
      sdkClient.downloadFile.mockResolvedValue(
        okDownload(webStream, {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="f.pdf"',
          'content-length': '1024',
          'x-internal': 'should-be-stripped',
        }),
      );

      const result = await service.downloadFile(
        'bucket',
        'path/file.pdf',
        'token',
      );
      expect(result.stream).toBe(webStream);
      expect(result.headers).toEqual({
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="f.pdf"',
        'content-length': '1024',
      });
      expect(result.headers).not.toHaveProperty('x-internal');
    });

    it('strips files/{bucket}/ prefix before calling SDK download', async () => {
      const { service, sdkClient } = makeService();
      const webStream = new ReadableStream();
      sdkClient.downloadFile.mockResolvedValue(
        okDownload(webStream, {
          'content-type': 'application/pdf',
        }),
      );

      await service.downloadFile(
        'my-bucket',
        'files/my-bucket/reports/q1.pdf',
        'token',
      );

      expect(sdkClient.downloadFile).toHaveBeenCalledWith(
        'my-bucket',
        'reports/q1.pdf',
        expect.any(Object),
      );
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockResolvedValue(errResponse(404));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on 401', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockResolvedValue(errResponse(401));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadGatewayException on 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockResolvedValue(errResponse(502));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service, sdkClient } = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      sdkClient.downloadFile.mockRejectedValue(timeoutErr);
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockRejectedValue(new TypeError('ECONNREFUSED'));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
