import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { SkillsUploadService } from '../../upload/skills-upload.service';
import type { SkillsArchiveExtractionService } from '../skills-archive-extraction.service';
import { SkillsArchiveImportService } from '../skills-archive-import.service';

const EXTRACTED = {
  name: 'docs-helper',
  skillManifest: '---\nname: docs-helper\ndescription: y\n---\n\nbody',
  filePaths: ['scripts/run.sh'],
  files: [
    { buffer: Buffer.from('echo hi'), mimetype: 'application/octet-stream' },
  ],
};

const makeService = () => {
  const configService = {
    get: () => undefined,
  } as unknown as ConfigService<EnvironmentVariables>;

  const extractionService = {
    extract: vi.fn().mockResolvedValue(EXTRACTED),
  } as unknown as SkillsArchiveExtractionService;

  const uploadService = {
    createSkill: vi.fn().mockResolvedValue({ etag: '"abc123"' }),
  } as unknown as SkillsUploadService;

  const service = new SkillsArchiveImportService(
    extractionService,
    uploadService,
    configService,
  );

  return { service, extractionService, uploadService };
};

describe('SkillsArchiveImportService', () => {
  it('extracts the archive and creates the skill in exactly one Core call', async () => {
    const { service, extractionService, uploadService } = makeService();

    const result = await service.importSkillArchive(
      'my-bucket',
      '/tmp/archive.zip',
      'token',
    );

    expect(extractionService.extract).toHaveBeenCalledOnce();
    expect(uploadService.createSkill).toHaveBeenCalledOnce();
    expect(uploadService.createSkill).toHaveBeenCalledWith(
      'my-bucket',
      'docs-helper',
      EXTRACTED.skillManifest,
      JSON.stringify(EXTRACTED.filePaths),
      EXTRACTED.files,
      'token',
      expect.any(AbortSignal),
    );
    expect(result).toEqual({
      name: 'docs-helper',
      path: 'docs-helper',
      url: 'skills/my-bucket/docs-helper',
      etag: '"abc123"',
    });
  });

  it('makes no Core call when extraction fails', async () => {
    const { service, extractionService, uploadService } = makeService();
    vi.mocked(extractionService.extract).mockRejectedValue(
      new Error('invalid archive'),
    );

    await expect(
      service.importSkillArchive('my-bucket', '/tmp/archive.zip', 'token'),
    ).rejects.toThrow('invalid archive');
    expect(uploadService.createSkill).not.toHaveBeenCalled();
  });

  it('propagates a collision as ConflictException unchanged', async () => {
    const { service, uploadService } = makeService();
    vi.mocked(uploadService.createSkill).mockRejectedValue(
      new ConflictException('A skill already exists at this path'),
    );

    await expect(
      service.importSkillArchive('my-bucket', '/tmp/archive.zip', 'token'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
