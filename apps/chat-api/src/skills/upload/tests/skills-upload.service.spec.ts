import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { SkillsPackageService } from '../../package/skills-package.service';
import { SkillsUploadService } from '../skills-upload.service';

const makeResponse = (
  status: number,
  headers: Record<string, string> = {},
): Response =>
  ({
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  }) as unknown as Response;

const makeService = (configOverrides: Record<string, unknown> = {}) => {
  const configService = {
    get: vi.fn((key: string) =>
      key in configOverrides ? configOverrides[key] : undefined,
    ),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient = {
    uploadSkillFolder: vi.fn(),
    uploadSkillFile: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;

  const packageService = new SkillsPackageService(configService);
  const service = new SkillsUploadService(
    dialClient,
    packageService,
    configService,
  );
  return { service, sdkClient };
};

const manifest = '---\nname: test\ndescription: d\n---\n\nbody';
const singleFile = {
  buffer: Buffer.from('print(1)'),
  mimetype: 'text/x-python',
};

describe('SkillsUploadService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSkill', () => {
    it('sends If-None-Match: * and no If-Match, returns the new ETag', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"abc123"' }),
      });

      const result = await service.createSkill(
        'my-bucket',
        'team-a/docs-helper',
        manifest,
        JSON.stringify(['scripts/helper.py']),
        [singleFile],
        'token',
      );

      expect(result).toEqual({ etag: '"abc123"' });
      expect(sdkClient.uploadSkillFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
            'If-None-Match': '*',
          }),
        }),
      );
      const headers = sdkClient.uploadSkillFolder.mock.calls[0][2].headers;
      expect(headers['If-Match']).toBeUndefined();
    });

    it('maps a 412 create collision to ConflictException (409)', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(412),
      });

      await expect(
        service.createSkill(
          'my-bucket',
          'team-a/docs-helper',
          manifest,
          JSON.stringify([]),
          [],
          'token',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an invalid package before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      await expect(
        service.createSkill(
          'my-bucket',
          'team-a/docs-helper',
          manifest,
          JSON.stringify(['../escape.md']),
          [singleFile],
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });

    it('maps 403 to ForbiddenException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(403),
      });

      await expect(
        service.createSkill(
          'my-bucket',
          'team-a/docs-helper',
          manifest,
          JSON.stringify([]),
          [],
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('maps a network/timeout failure to ServiceUnavailableException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockRejectedValue(
        Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
      );

      await expect(
        service.createSkill(
          'my-bucket',
          'team-a/docs-helper',
          manifest,
          JSON.stringify([]),
          [],
          'token',
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('updateSkill', () => {
    it('sends the caller-supplied If-Match and no If-None-Match', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"def456"' }),
      });

      const result = await service.updateSkill(
        'my-bucket',
        'team-a/docs-helper',
        manifest,
        JSON.stringify([]),
        [],
        '"prev-etag"',
        'token',
      );

      expect(result).toEqual({ etag: '"def456"' });
      const headers = sdkClient.uploadSkillFolder.mock.calls[0][2].headers;
      expect(headers['If-Match']).toBe('"prev-etag"');
      expect(headers['If-None-Match']).toBeUndefined();
    });

    it('maps a stale 412 to PreconditionFailedException (unchanged)', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(412),
      });

      await expect(
        service.updateSkill(
          'my-bucket',
          'team-a/docs-helper',
          manifest,
          JSON.stringify([]),
          [],
          '"stale-etag"',
          'token',
        ),
      ).rejects.toThrow(PreconditionFailedException);
    });

    it('rejects an invalid package before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      await expect(
        service.updateSkill(
          'my-bucket',
          'team-a/docs-helper',
          manifest,
          JSON.stringify(['SKILL.md']),
          [singleFile],
          '"etag"',
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFolder).not.toHaveBeenCalled();
    });
  });

  describe('uploadSkillFile', () => {
    it('uploads a single file and returns the new ETag', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFile.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"def456"' }),
      });

      const result = await service.uploadSkillFile(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        singleFile,
        'token',
      );

      expect(result).toEqual({ etag: '"def456"' });
      expect(sdkClient.uploadSkillFile).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('rejects an invalid filePath before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      await expect(
        service.uploadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          '../escape.py',
          singleFile,
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.uploadSkillFile).not.toHaveBeenCalled();
    });

    it('rejects a file exceeding SKILL_FILE_UPLOAD_MAX_BYTES with 413', async () => {
      const { service, sdkClient } = makeService({
        SKILL_FILE_UPLOAD_MAX_BYTES: 4,
      });

      await expect(
        service.uploadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'scripts/helper.py',
          singleFile,
          'token',
        ),
      ).rejects.toThrow(PayloadTooLargeException);
      expect(sdkClient.uploadSkillFile).not.toHaveBeenCalled();
    });

    it('forwards the If-Match header when supplied', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFile.mockResolvedValue({
        error: undefined,
        response: makeResponse(200),
      });

      await service.uploadSkillFile(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        singleFile,
        'token',
        '"prev-etag"',
      );

      expect(sdkClient.uploadSkillFile).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-Match': '"prev-etag"' }),
        }),
      );
    });

    it('maps 404 to NotFoundException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadSkillFile.mockResolvedValue({
        error: true,
        response: makeResponse(404),
      });

      await expect(
        service.uploadSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'scripts/helper.py',
          singleFile,
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
