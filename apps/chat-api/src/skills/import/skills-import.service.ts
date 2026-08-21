import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import { SkillsUploadService } from '../upload/skills-upload.service';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import {
  SKILL_MANIFEST_FILE,
  SKILL_RESOURCE_PREFIX,
} from '../utils/skill-path.util';
import { SkillsArchiveExtractionService } from './skills-archive-extraction.service';
import { SkillsManifestImportService } from './skills-manifest-import.service';

export interface SkillArchiveImportResult {
  name: string;
  path: string;
  url: string;
  etag?: string;
}

/**
 * Orchestrates `POST /api/v1/skills/import` (design.md D2/D5,
 * `extend-skill-upload-with-skill-md`, building on
 * `add-skill-archive-import`): selects the standalone-manifest or archive
 * extractor by the uploaded field's exact filename, then calls the existing,
 * unmodified `SkillsUploadService.createSkill` — no path/count/size
 * validation or DIAL Core call logic is duplicated here, so an
 * archive-created Skill, a standalone-manifest Skill, and a manually-authored
 * Skill can never diverge on what "a valid Skill" means.
 */
@Injectable()
export class SkillsImportService {
  constructor(
    private readonly extractionService: SkillsArchiveExtractionService,
    private readonly manifestImportService: SkillsManifestImportService,
    private readonly uploadService: SkillsUploadService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /**
   * Combines the caller-supplied client-disconnect signal with the transfer
   * timeout, covering both extraction/parsing and the subsequent Core call —
   * the same pattern `SkillsUploadService` uses for its own SDK calls.
   */
  private combineWithTimeoutSignal(signal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(
      getSkillTransferTimeoutMs(this.configService),
    );
    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  }

  async importSkillArchive(
    bucket: string,
    filename: string,
    filePath: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<SkillArchiveImportResult> {
    const combinedSignal = this.combineWithTimeoutSignal(signal);

    const { name, skillManifest, filePaths, files } =
      filename === SKILL_MANIFEST_FILE
        ? await this.manifestImportService.extract(filePath, combinedSignal)
        : await this.extractionService.extract(filePath, combinedSignal);

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
