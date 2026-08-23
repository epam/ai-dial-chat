import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { SkillsUploadService } from '../../upload/skills-upload.service';
import type { SkillsArchiveExtractionService } from '../skills-archive-extraction.service';
import { SkillsImportService } from '../skills-import.service';
import type { SkillsManifestImportService } from '../skills-manifest-import.service';

const ARCHIVE_EXTRACTED = {
  name: 'docs-helper',
  skillManifest: '---\nname: docs-helper\ndescription: y\n---\n\nbody',
  filePaths: ['scripts/run.sh'],
  files: [
    { buffer: Buffer.from('echo hi'), mimetype: 'application/octet-stream' },
  ],
};

const MANIFEST_EXTRACTED = {
  name: 'docs-helper',
  skillManifest: '---\nname: docs-helper\ndescription: y\n---\n\nbody',
  filePaths: [],
  files: [],
};

const makeService = () => {
  const configService = {
    get: () => undefined,
  } as unknown as ConfigService<EnvironmentVariables>;

  const extractionService = {
    extract: vi.fn().mockResolvedValue(ARCHIVE_EXTRACTED),
  } as unknown as SkillsArchiveExtractionService;

  const manifestImportService = {
    extract: vi.fn().mockResolvedValue(MANIFEST_EXTRACTED),
  } as unknown as SkillsManifestImportService;

  const uploadService = {
    createSkill: vi.fn().mockResolvedValue({ etag: '"abc123"' }),
  } as unknown as SkillsUploadService;

  const service = new SkillsImportService(
    extractionService,
    manifestImportService,
    uploadService,
    configService,
  );

  return { service, extractionService, manifestImportService, uploadService };
};

describe('SkillsImportService', () => {
  it('extracts the archive and creates the skill in exactly one Core call', async () => {
    const { service, extractionService, manifestImportService, uploadService } =
      makeService();

    const result = await service.importSkillArchive(
      'my-bucket',
      'archive.zip',
      '/tmp/archive.zip',
      'token',
    );

    expect(extractionService.extract).toHaveBeenCalledOnce();
    expect(manifestImportService.extract).not.toHaveBeenCalled();
    expect(uploadService.createSkill).toHaveBeenCalledOnce();
    expect(uploadService.createSkill).toHaveBeenCalledWith(
      'my-bucket',
      'docs-helper',
      ARCHIVE_EXTRACTED.skillManifest,
      JSON.stringify(ARCHIVE_EXTRACTED.filePaths),
      ARCHIVE_EXTRACTED.files,
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

  it('routes a file named exactly SKILL.md to the standalone-manifest extractor', async () => {
    const { service, extractionService, manifestImportService, uploadService } =
      makeService();

    const result = await service.importSkillArchive(
      'my-bucket',
      'SKILL.md',
      '/tmp/SKILL.md',
      'token',
    );

    expect(manifestImportService.extract).toHaveBeenCalledOnce();
    expect(extractionService.extract).not.toHaveBeenCalled();
    expect(uploadService.createSkill).toHaveBeenCalledWith(
      'my-bucket',
      'docs-helper',
      MANIFEST_EXTRACTED.skillManifest,
      JSON.stringify(MANIFEST_EXTRACTED.filePaths),
      MANIFEST_EXTRACTED.files,
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

  it('does not treat a wrong-case or wrong-name Markdown filename as a standalone manifest', async () => {
    const { service, extractionService, manifestImportService } = makeService();

    await service.importSkillArchive(
      'my-bucket',
      'skill.md',
      '/tmp/skill.md',
      'token',
    );

    expect(manifestImportService.extract).not.toHaveBeenCalled();
    expect(extractionService.extract).toHaveBeenCalledOnce();
  });

  it('makes no Core call when archive extraction fails', async () => {
    const { service, extractionService, uploadService } = makeService();
    vi.mocked(extractionService.extract).mockRejectedValue(
      new Error('invalid archive'),
    );

    await expect(
      service.importSkillArchive(
        'my-bucket',
        'archive.zip',
        '/tmp/archive.zip',
        'token',
      ),
    ).rejects.toThrow('invalid archive');
    expect(uploadService.createSkill).not.toHaveBeenCalled();
  });

  it('makes no Core call when standalone-manifest extraction fails', async () => {
    const { service, manifestImportService, uploadService } = makeService();
    vi.mocked(manifestImportService.extract).mockRejectedValue(
      new Error('invalid manifest'),
    );

    await expect(
      service.importSkillArchive(
        'my-bucket',
        'SKILL.md',
        '/tmp/SKILL.md',
        'token',
      ),
    ).rejects.toThrow('invalid manifest');
    expect(uploadService.createSkill).not.toHaveBeenCalled();
  });

  it('propagates a collision as ConflictException unchanged', async () => {
    const { service, uploadService } = makeService();
    vi.mocked(uploadService.createSkill).mockRejectedValue(
      new ConflictException('A skill already exists at this path'),
    );

    await expect(
      service.importSkillArchive(
        'my-bucket',
        'archive.zip',
        '/tmp/archive.zip',
        'token',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
