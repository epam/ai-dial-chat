import { readFile, stat } from 'node:fs/promises';
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  InvalidSkillManifestError,
  parseSkillManifestFrontmatter,
} from '../utils/skill-manifest-frontmatter.util';
import { isValidSkillName } from '../utils/skill-path.util';
import type { ExtractedSkillArchive } from './skills-archive-extraction.service';

/**
 * Validates a standalone `SKILL.md` upload for `POST /api/v1/skills/import`
 * (design.md D2, `extend-skill-upload-with-skill-md`) and returns the same
 * `{ name, skillManifest, filePaths, files }` shape
 * `SkillsArchiveExtractionService.extract` returns, so `SkillsImportService`
 * can hand either result to the unmodified `SkillsUploadService.createSkill`
 * call. Reuses `parseSkillManifestFrontmatter`/`isValidSkillName` unchanged —
 * a standalone manifest and an archive's `SKILL.md` entry are validated by
 * the exact same rules, just without any archive container around them.
 */
@Injectable()
export class SkillsManifestImportService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getFileUploadMaxBytes(): number {
    return (
      this.configService.get<number>('SKILL_FILE_UPLOAD_MAX_BYTES') ?? 1_048_576
    );
  }

  async extract(
    manifestPath: string,
    signal?: AbortSignal,
  ): Promise<ExtractedSkillArchive> {
    const maxFileBytes = this.getFileUploadMaxBytes();
    const { size } = await stat(manifestPath);
    if (size > maxFileBytes) {
      throw new PayloadTooLargeException(
        `SKILL.md exceeds the per-file limit of ${maxFileBytes} bytes`,
      );
    }

    if (signal?.aborted) {
      throw new BadRequestException('Skill import aborted');
    }

    const buffer = await readFile(manifestPath);
    const skillManifest = this.decodeManifest(buffer);
    const { name } = this.parseManifest(skillManifest);

    if (!isValidSkillName(name)) {
      throw new BadRequestException(
        'Skill manifest "name" must be a safe single path segment',
      );
    }

    /*
     * SKILL.md itself travels as `skillManifest`, not as a `filePaths`/`files`
     * entry — SkillsPackageService.validateAndBuildFormData rejects a
     * SKILL.md entry in filePaths as redundant. A standalone manifest has no
     * supporting files, so both arrays are empty.
     */
    return { name, skillManifest, filePaths: [], files: [] };
  }

  private decodeManifest(buffer: Buffer): string {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new BadRequestException('SKILL.md is not valid UTF-8');
    }
  }

  private parseManifest(
    skillManifest: string,
  ): ReturnType<typeof parseSkillManifestFrontmatter> {
    try {
      return parseSkillManifestFrontmatter(skillManifest);
    } catch (err) {
      if (err instanceof InvalidSkillManifestError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
