import {
  BadRequestException,
  ForbiddenException,
  MethodNotAllowedException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { SkillsDownloadService } from '../skills-download.service';

const makeResponse = (
  status: number,
  headers: Record<string, string> = {},
  body: ReadableStream | null = new ReadableStream(),
): Response =>
  ({
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    body,
  }) as unknown as Response;

const makeService = (result: { error?: unknown; response: Response }) => {
  const sdkClient = {
    downloadSkillFolder: vi.fn().mockResolvedValue(result),
    downloadSkillFile: vi.fn().mockResolvedValue(result),
  };
  const configService = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService<EnvironmentVariables>;
  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;
  const service = new SkillsDownloadService(dialClient, configService);
  return { service, sdkClient };
};

describe('SkillsDownloadService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadSkill', () => {
    it('streams a successful ZIP download and forwards safe headers', async () => {
      const { service } = makeService({
        error: undefined,
        response: makeResponse(200, {
          'content-type': 'application/zip',
          'content-length': '1234',
          etag: '"abc123"',
          'x-secret-header': 'leak-me-not',
        }),
      });

      const result = await service.downloadSkill(
        'my-bucket',
        'team-a/docs-helper',
        'token',
      );

      expect(result.stream).toBeInstanceOf(ReadableStream);
      expect(result.headers).toEqual({
        'content-type': 'application/zip',
        etag: '"abc123"',
      });
      expect(result.headers['content-length']).toBeUndefined();
      expect(result.headers['x-secret-header']).toBeUndefined();
    });

    it('rejects a grouping-folder download with BadRequestException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(400, {}, null),
      });

      await expect(
        service.downloadSkill('my-bucket', 'team-a/', 'token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('invokes abortOnDisconnect to cancel the upstream request', async () => {
      const { service } = makeService({
        error: undefined,
        response: makeResponse(200),
      });

      const result = await service.downloadSkill(
        'my-bucket',
        'team-a/docs-helper',
        'token',
      );
      expect(() => result.abortOnDisconnect()).not.toThrow();
    });

    it('maps 401 to UnauthorizedException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(401, {}, null),
      });
      await expect(
        service.downloadSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('maps 403 to ForbiddenException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(403, {}, null),
      });
      await expect(
        service.downloadSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('maps 404 to NotFoundException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(404, {}, null),
      });
      await expect(
        service.downloadSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps 405 to MethodNotAllowedException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(405, {}, null),
      });
      await expect(
        service.downloadSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(MethodNotAllowedException);
    });

    it('maps 422 to UnprocessableEntityException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(422, {}, null),
      });
      await expect(
        service.downloadSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('maps a network/timeout failure to ServiceUnavailableException', async () => {
      const sdkClient = {
        downloadSkillFolder: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
          ),
      };
      const configService = {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as ConfigService<EnvironmentVariables>;
      const dialClient = {
        client: sdkClient,
        baseUrl: 'http://dial-core',
      } as unknown as DialClientService;
      const service = new SkillsDownloadService(dialClient, configService);

      await expect(
        service.downloadSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('downloadSkillFile', () => {
    it('streams a successful file download with the dynamic content-type header', async () => {
      const { service } = makeService({
        error: undefined,
        response: makeResponse(200, {
          'content-type': 'text/markdown',
          etag: '"abc123"',
        }),
      });

      const result = await service.downloadSkillFile(
        'my-bucket',
        'team-a/docs-helper',
        'SKILL.md',
        'token',
      );

      expect(result.headers['content-type']).toBe('text/markdown');
      expect(result.headers.etag).toBe('"abc123"');
    });

    it('maps 404 to NotFoundException', async () => {
      const { service } = makeService({
        error: true,
        response: makeResponse(404, {}, null),
      });
      await expect(
        service.downloadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'SKILL.md',
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
