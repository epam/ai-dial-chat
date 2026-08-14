import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { SkillsMutationService } from '../skills-mutation.service';

const makeResponse = (
  status: number,
  headers: Record<string, string> = {},
): Response =>
  ({
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  }) as unknown as Response;

const makeService = () => {
  const sdkClient = {
    deleteSkillFolder: vi.fn(),
    deleteSkillFile: vi.fn(),
    createSkillGroupingFolder: vi.fn(),
    deleteSkillGroupingFolder: vi.fn(),
  };
  const configService = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService<EnvironmentVariables>;
  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;
  const service = new SkillsMutationService(dialClient, configService);
  return { service, sdkClient };
};

describe('SkillsMutationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('deleteSkill', () => {
    it('deletes a whole skill and returns success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200),
      });

      const result = await service.deleteSkill(
        'my-bucket',
        'team-a/docs-helper',
        'token',
      );

      expect(result).toEqual({ success: true });
      expect(sdkClient.deleteSkillFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('forwards If-Match when supplied', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200),
      });

      await service.deleteSkill(
        'my-bucket',
        'team-a/docs-helper',
        'token',
        '"etag"',
      );

      expect(sdkClient.deleteSkillFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-Match': '"etag"' }),
        }),
      );
    });

    it('maps 404 to NotFoundException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(404),
      });

      await expect(
        service.deleteSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps 412 to PreconditionFailedException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillFolder.mockResolvedValue({
        error: true,
        response: makeResponse(412),
      });

      await expect(
        service.deleteSkill('my-bucket', 'team-a/docs-helper', 'token'),
      ).rejects.toThrow(PreconditionFailedException);
    });
  });

  describe('deleteSkillFile', () => {
    it('deletes a file and returns the new ETag', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillFile.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"new-etag"' }),
      });

      const result = await service.deleteSkillFile(
        'my-bucket',
        'team-a/docs-helper',
        'scripts/helper.py',
        'token',
      );

      expect(result).toEqual({ etag: '"new-etag"' });
    });

    it('rejects deleting SKILL.md before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();

      await expect(
        service.deleteSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'SKILL.md',
          'token',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sdkClient.deleteSkillFile).not.toHaveBeenCalled();
    });

    it('maps 404 to NotFoundException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillFile.mockResolvedValue({
        error: true,
        response: makeResponse(404),
      });

      await expect(
        service.deleteSkillFile(
          'my-bucket',
          'team-a/docs-helper',
          'scripts/helper.py',
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSkillGroupingFolder', () => {
    it('creates a grouping folder and returns the ETag', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.createSkillGroupingFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200, { etag: '"folder-etag"' }),
      });

      const result = await service.createSkillGroupingFolder(
        'my-bucket',
        'team-a/',
        'token',
      );

      expect(result).toEqual({ etag: '"folder-etag"' });
      expect(sdkClient.createSkillGroupingFolder).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('maps 400 to BadRequestException on a create collision', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.createSkillGroupingFolder.mockResolvedValue({
        error: true,
        response: makeResponse(400),
      });

      await expect(
        service.createSkillGroupingFolder('my-bucket', 'team-a/', 'token'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSkillGroupingFolder', () => {
    it('deletes an empty grouping folder and returns success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillGroupingFolder.mockResolvedValue({
        error: undefined,
        response: makeResponse(200),
      });

      const result = await service.deleteSkillGroupingFolder(
        'my-bucket',
        'team-a/',
        'token',
      );

      expect(result).toEqual({ success: true });
    });

    it('maps 409 to ConflictException for a non-empty folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillGroupingFolder.mockResolvedValue({
        error: true,
        response: makeResponse(409),
      });

      await expect(
        service.deleteSkillGroupingFolder('my-bucket', 'team-a/', 'token'),
      ).rejects.toThrow(ConflictException);
    });

    it('maps 412 to PreconditionFailedException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillGroupingFolder.mockResolvedValue({
        error: true,
        response: makeResponse(412),
      });

      await expect(
        service.deleteSkillGroupingFolder(
          'my-bucket',
          'team-a/',
          'token',
          '"etag"',
        ),
      ).rejects.toThrow(PreconditionFailedException);
    });

    it('maps 404 to NotFoundException', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteSkillGroupingFolder.mockResolvedValue({
        error: true,
        response: makeResponse(404),
      });

      await expect(
        service.deleteSkillGroupingFolder('my-bucket', 'team-a/', 'token'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
