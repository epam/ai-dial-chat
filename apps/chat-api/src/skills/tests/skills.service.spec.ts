import { describe, expect, it, vi } from 'vitest';
import type { SkillsDownloadService } from '../download/skills-download.service';
import type { SkillsListingService } from '../listing/skills-listing.service';
import type { SkillsMutationService } from '../mutation/skills-mutation.service';
import { SkillsService } from '../skills.service';
import type { SkillsUploadService } from '../upload/skills-upload.service';

/*
 * Delegation-only assertions: every public facade method must call exactly
 * the matching sub-service method with the same arguments and return its
 * result unchanged. No business logic is asserted here — that's covered in
 * each sub-service's own spec (design.md's testing ownership map).
 */
describe('SkillsService', () => {
  const makeService = () => {
    const listingService = {
      listSkills: vi.fn().mockResolvedValue('listSkills-result'),
      listCatalogSkills: vi.fn().mockResolvedValue('listCatalogSkills-result'),
      listSkillFiles: vi.fn().mockResolvedValue('listSkillFiles-result'),
    } as unknown as SkillsListingService;
    const downloadService = {
      downloadSkill: vi.fn().mockResolvedValue('downloadSkill-result'),
      downloadSkillFile: vi.fn().mockResolvedValue('downloadSkillFile-result'),
    } as unknown as SkillsDownloadService;
    const uploadService = {
      createSkill: vi.fn().mockResolvedValue('createSkill-result'),
      updateSkill: vi.fn().mockResolvedValue('updateSkill-result'),
      uploadSkillFile: vi.fn().mockResolvedValue('uploadSkillFile-result'),
    } as unknown as SkillsUploadService;
    const mutationService = {
      deleteSkill: vi.fn().mockResolvedValue('deleteSkill-result'),
      deleteSkillFile: vi.fn().mockResolvedValue('deleteSkillFile-result'),
      createSkillGroupingFolder: vi
        .fn()
        .mockResolvedValue('createSkillGroupingFolder-result'),
      deleteSkillGroupingFolder: vi
        .fn()
        .mockResolvedValue('deleteSkillGroupingFolder-result'),
    } as unknown as SkillsMutationService;

    const service = new SkillsService(
      listingService,
      downloadService,
      uploadService,
      mutationService,
    );

    return {
      service,
      listingService,
      downloadService,
      uploadService,
      mutationService,
    };
  };

  it('delegates listSkills to SkillsListingService', async () => {
    const { service, listingService } = makeService();
    const result = await service.listSkills('bucket', 'path', {}, 'token');
    expect(listingService.listSkills).toHaveBeenCalledWith(
      'bucket',
      'path',
      {},
      'token',
    );
    expect(result).toBe('listSkills-result');
  });

  it('delegates listCatalogSkills to SkillsListingService', async () => {
    const { service, listingService } = makeService();
    const result = await service.listCatalogSkills('bucket', 'token');
    expect(listingService.listCatalogSkills).toHaveBeenCalledWith(
      'bucket',
      'token',
    );
    expect(result).toBe('listCatalogSkills-result');
  });

  it('delegates listSkillFiles to SkillsListingService', async () => {
    const { service, listingService } = makeService();
    const result = await service.listSkillFiles(
      'bucket',
      'path',
      'filePath',
      {},
      'token',
    );
    expect(listingService.listSkillFiles).toHaveBeenCalledWith(
      'bucket',
      'path',
      'filePath',
      {},
      'token',
    );
    expect(result).toBe('listSkillFiles-result');
  });

  it('delegates downloadSkill to SkillsDownloadService', async () => {
    const { service, downloadService } = makeService();
    const result = await service.downloadSkill('bucket', 'path', 'token');
    expect(downloadService.downloadSkill).toHaveBeenCalledWith(
      'bucket',
      'path',
      'token',
    );
    expect(result).toBe('downloadSkill-result');
  });

  it('delegates downloadSkillFile to SkillsDownloadService', async () => {
    const { service, downloadService } = makeService();
    const result = await service.downloadSkillFile(
      'bucket',
      'path',
      'filePath',
      'token',
    );
    expect(downloadService.downloadSkillFile).toHaveBeenCalledWith(
      'bucket',
      'path',
      'filePath',
      'token',
    );
    expect(result).toBe('downloadSkillFile-result');
  });

  it('delegates createSkill to SkillsUploadService', async () => {
    const { service, uploadService } = makeService();
    const result = await service.createSkill(
      'bucket',
      'path',
      'manifest',
      '[]',
      [],
      'token',
    );
    expect(uploadService.createSkill).toHaveBeenCalledWith(
      'bucket',
      'path',
      'manifest',
      '[]',
      [],
      'token',
    );
    expect(result).toBe('createSkill-result');
  });

  it('delegates updateSkill to SkillsUploadService', async () => {
    const { service, uploadService } = makeService();
    const result = await service.updateSkill(
      'bucket',
      'path',
      'manifest',
      '[]',
      [],
      '"etag"',
      'token',
    );
    expect(uploadService.updateSkill).toHaveBeenCalledWith(
      'bucket',
      'path',
      'manifest',
      '[]',
      [],
      '"etag"',
      'token',
    );
    expect(result).toBe('updateSkill-result');
  });

  it('delegates uploadSkillFile to SkillsUploadService', async () => {
    const { service, uploadService } = makeService();
    const file = { buffer: Buffer.from(''), mimetype: 'text/plain' };
    const result = await service.uploadSkillFile(
      'bucket',
      'path',
      'filePath',
      file,
      'token',
      '"etag"',
    );
    expect(uploadService.uploadSkillFile).toHaveBeenCalledWith(
      'bucket',
      'path',
      'filePath',
      file,
      'token',
      '"etag"',
    );
    expect(result).toBe('uploadSkillFile-result');
  });

  it('delegates deleteSkill to SkillsMutationService', async () => {
    const { service, mutationService } = makeService();
    const result = await service.deleteSkill(
      'bucket',
      'path',
      'token',
      '"etag"',
    );
    expect(mutationService.deleteSkill).toHaveBeenCalledWith(
      'bucket',
      'path',
      'token',
      '"etag"',
    );
    expect(result).toBe('deleteSkill-result');
  });

  it('delegates deleteSkillFile to SkillsMutationService', async () => {
    const { service, mutationService } = makeService();
    const result = await service.deleteSkillFile(
      'bucket',
      'path',
      'filePath',
      'token',
      '"etag"',
    );
    expect(mutationService.deleteSkillFile).toHaveBeenCalledWith(
      'bucket',
      'path',
      'filePath',
      'token',
      '"etag"',
    );
    expect(result).toBe('deleteSkillFile-result');
  });

  it('delegates createSkillGroupingFolder to SkillsMutationService', async () => {
    const { service, mutationService } = makeService();
    const result = await service.createSkillGroupingFolder(
      'bucket',
      'path',
      'token',
    );
    expect(mutationService.createSkillGroupingFolder).toHaveBeenCalledWith(
      'bucket',
      'path',
      'token',
    );
    expect(result).toBe('createSkillGroupingFolder-result');
  });

  it('delegates deleteSkillGroupingFolder to SkillsMutationService', async () => {
    const { service, mutationService } = makeService();
    const result = await service.deleteSkillGroupingFolder(
      'bucket',
      'path',
      'token',
      '"etag"',
    );
    expect(mutationService.deleteSkillGroupingFolder).toHaveBeenCalledWith(
      'bucket',
      'path',
      'token',
      '"etag"',
    );
    expect(result).toBe('deleteSkillGroupingFolder-result');
  });

  it('does not expose resolveSkillItem on the facade', () => {
    const { service } = makeService();
    expect(
      (service as unknown as Record<string, unknown>)['resolveSkillItem'],
    ).toBeUndefined();
  });
});
