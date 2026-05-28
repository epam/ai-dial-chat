import {
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { FilesService } from '../files.service';

function makeService() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;
  return new FilesService(configService);
}

const mockFile = { buffer: Buffer.from('hello'), mimetype: 'application/pdf' };

describe('FilesService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('returns FileUploadResponseDto on success', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ url: 'files/bucket/path/file.pdf' }),
        }),
      );

      const result = await service.uploadFile(
        'bucket',
        'path/file.pdf',
        mockFile,
        'token',
      );
      expect(result).toEqual({ url: 'files/bucket/path/file.pdf' });
    });

    it('sends Authorization header and correct Content-Type', async () => {
      const service = makeService();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'files/bucket/path/file.pdf' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await service.uploadFile('bucket', 'path/file.pdf', mockFile, 'my-token');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://dial-core/v1/files/bucket/path/file.pdf',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
            'Content-Type': 'application/pdf',
          }),
        }),
      );
    });

    it('percent-encodes spaces and parens in the DIAL Core URL', async () => {
      const service = makeService();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'files/bucket/my%20file%20(1).pdf' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await service.uploadFile('bucket', 'my file (1).pdf', mockFile, 'tok');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://dial-core/v1/files/bucket/my%20file%20(1).pdf',
        expect.anything(),
      );
    });

    it('throws UnauthorizedException on 401', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401 }),
      );
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on 403', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 403 }),
      );
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on 429', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 429 }),
      );
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws ServiceUnavailableException on 5xx', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      );
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const service = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutErr));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('downloadFile', () => {
    it('returns stream and allowlisted headers on success', async () => {
      const service = makeService();
      const webStream = new ReadableStream();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: webStream,
          headers: {
            get: (name: string) => {
              const map: Record<string, string> = {
                'content-type': 'application/pdf',
                'content-disposition': 'attachment; filename="f.pdf"',
                'content-length': '1024',
                'x-internal': 'should-be-stripped',
              };
              return map[name] ?? null;
            },
          },
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
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 }),
      );
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on 401', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401 }),
      );
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ServiceUnavailableException on 5xx', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 502 }),
      );
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const service = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutErr));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('ECONNREFUSED')),
      );
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
