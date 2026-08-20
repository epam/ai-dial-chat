import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import { SkillsUploadService } from '../upload/skills-upload.service';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import { SKILL_RESOURCE_PREFIX } from '../utils/skill-path.util';
import { SkillsArchiveExtractionService } from './skills-archive-extraction.service';

export interface SkillArchiveImportResult {
  name: string;
  path: string;
  url: string;
  etag?: string;
}

/**
 * Orchestrates `POST /api/v1/skills/import` (design.md D3,
 * `add-skill-archive-import`): extracts and validates the archive, then
 * calls the existing, unmodified `SkillsUploadService.createSkill` — no
 * path/count/size validation or DIAL Core call logic is duplicated here, so
 * an archive-created Skill and a manually-authored Skill can never diverge
 * on what "a valid Skill" means.
 */
@Injectable()
export class SkillsArchiveImportService {
  constructor(
    private readonly extractionService: SkillsArchiveExtractionService,
    private readonly uploadService: SkillsUploadService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /**
   * Combines the caller-supplied client-disconnect signal with the transfer
   * timeout, covering both extraction and the subsequent Core call — the
   * same pattern `SkillsUploadService` uses for its own SDK calls.
   */
  private combineWithTimeoutSignal(signal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(
      getSkillTransferTimeoutMs(this.configService),
    );
    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  }

  async importSkillArchive(
    bucket: string,
    archivePath: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<SkillArchiveImportResult> {
    const combinedSignal = this.combineWithTimeoutSignal(signal);

    const { name, skillManifest, filePaths, files } =
      await this.extractionService.extract(archivePath, combinedSignal);

    const { etag } = await this.uploadService.createSkill(
      bucket,
      name,
      skillManifest,
      JSON.stringify(filePaths),
      files,
      accessToken,
      combinedSignal,
    );

    return {
      name,
      path: name,
      url: `${SKILL_RESOURCE_PREFIX}${bucket}/${name}`,
      etag,
    };
  }
}
