import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { FilesService } from '../files.service';

type SdkClient = {
  uploadFile: ReturnType<typeof vi.fn>;
  downloadFile: ReturnType<typeof vi.fn>;
};

function makeService() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
  };

  const service = new FilesService(configService);
  (service as unknown as { client: SdkClient }).client = sdkClient;

  return { service, sdkClient };
}

const okUpload = (url: string) => ({
  error: undefined,
  response: { status: 200, headers: { get: () => null } },
  data: { url },
});

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

const mockFile = { buffer: Buffer.from('hello'), mimetype: 'application/pdf' };

describe('FilesService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('returns FileUploadResponseDto on success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(okUpload('bucket/path/file.pdf'));

      const result = await service.uploadFile(
        'bucket',
        'path/file.pdf',
        mockFile,
        'token',
      );
      expect(result).toEqual({ url: 'files/bucket/path/file.pdf' });
    });

    it('builds the returned file URL from bucket and path', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(okUpload('ignored-upstream-url'));

      const result = await service.uploadFile(
        'user-bucket',
        'uploads/2026-06/IMG_4740%202.jpg',
        mockFile,
        'token',
      );

      expect(result).toEqual({
        url: 'files/user-bucket/uploads/2026-06/IMG_4740%202.jpg',
      });
    });

    it('calls SDK with bucket, path, authorization and multipart form data', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(
        okUpload('files/bucket/path/file.pdf'),
      );

      await service.uploadFile('bucket', 'path/file.pdf', mockFile, 'my-token');
      expect(sdkClient.uploadFile).toHaveBeenCalledWith(
        'bucket',
        'path/file.pdf',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
          body: expect.any(FormData),
        }),
      );
      expect(sdkClient.uploadFile.mock.calls[0][2].headers).not.toHaveProperty(
        'Content-Type',
      );
    });

    it('throws UnauthorizedException on 401', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(401));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(403));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on 429', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(429));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(500));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service, sdkClient } = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      sdkClient.uploadFile.mockRejectedValue(timeoutErr);
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
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
