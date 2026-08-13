import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  SKILL_MANIFEST_FILE,
  isValidSkillRelativePath,
} from '../utils/skill-path.util';

export interface UploadedSkillFile {
  buffer: Buffer;
  mimetype: string;
}

/**
 * Validates a create/update request's `skillManifest`/`filePaths`/`files`
 * package and builds the outbound per-file `FormData` DIAL Core's whole-skill
 * write operation requires. Owned only by `SkillsUploadService`. Never
 * constructs, receives, or forwards a ZIP archive — DIAL Core's real
 * contract (verified against its source) takes discrete multipart parts.
 */
@Injectable()
export class SkillsPackageService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getUploadMaxFiles(): number {
    return this.configService.get<number>('SKILL_UPLOAD_MAX_FILES') ?? 100;
  }

  private getFileUploadMaxBytes(): number {
    return (
      this.configService.get<number>('SKILL_FILE_UPLOAD_MAX_BYTES') ?? 1_048_576
    );
  }

  private getUploadMaxTotalBytes(): number {
    return (
      this.configService.get<number>('SKILL_UPLOAD_MAX_TOTAL_BYTES') ??
      16_777_216
    );
  }

  /**
   * Validates `skillManifest` (the full `SKILL.md` text), `filePaths` (a
   * JSON-encoded array of supporting-file relative paths), and `files`
   * (their raw content, positionally paired with `filePaths`), then builds
   * the `FormData` DIAL Core expects: one `file` part for the manifest
   * (filename `SKILL.md`) plus one per supporting file (filename its exact
   * relative path).
   */
  validateAndBuildFormData(
    skillManifest: string,
    filePathsJson: string,
    files: UploadedSkillFile[],
  ): FormData {
    if (skillManifest.trim() === '') {
      throw new BadRequestException('skillManifest must not be empty');
    }

    const filePaths = this.parseFilePaths(filePathsJson);

    if (filePaths.length !== files.length) {
      throw new BadRequestException(
        `filePaths has ${filePaths.length} entries but ${files.length} files were received`,
      );
    }

    const seenPaths = new Set<string>();
    for (const relativePath of filePaths) {
      if (relativePath === SKILL_MANIFEST_FILE) {
        throw new BadRequestException(
          `filePaths must not include ${SKILL_MANIFEST_FILE} — it is supplied via skillManifest`,
        );
      }
      if (!isValidSkillRelativePath(relativePath)) {
        throw new BadRequestException(
          `Invalid supporting file path: ${relativePath}`,
        );
      }
      if (seenPaths.has(relativePath)) {
        throw new BadRequestException(
          `Duplicate supporting file path: ${relativePath}`,
        );
      }
      seenPaths.add(relativePath);
    }

    const maxFiles = this.getUploadMaxFiles();
    const totalFileCount = filePaths.length + 1; // + SKILL.md
    if (totalFileCount > maxFiles) {
      throw new BadRequestException(
        `Skill contains ${totalFileCount} files which exceeds the limit of ${maxFiles}`,
      );
    }

    const maxFileBytes = this.getFileUploadMaxBytes();
    const manifestBytes = Buffer.byteLength(skillManifest, 'utf8');
    if (manifestBytes > maxFileBytes) {
      throw new PayloadTooLargeException(
        `skillManifest size ${manifestBytes} exceeds the per-file limit of ${maxFileBytes}`,
      );
    }

    let totalBytes = manifestBytes;
    for (let i = 0; i < files.length; i += 1) {
      const size = files[i].buffer.length;
      if (size > maxFileBytes) {
        throw new PayloadTooLargeException(
          `File '${filePaths[i]}' size ${size} exceeds the per-file limit of ${maxFileBytes}`,
        );
      }
      totalBytes += size;
    }

    const maxTotalBytes = this.getUploadMaxTotalBytes();
    if (totalBytes > maxTotalBytes) {
      throw new PayloadTooLargeException(
        `Skill total size ${totalBytes} exceeds the limit of ${maxTotalBytes}`,
      );
    }

    return this.buildFormData(skillManifest, filePaths, files);
  }

  private parseFilePaths(filePathsJson: string): string[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(filePathsJson);
    } catch {
      throw new BadRequestException('filePaths must be valid JSON');
    }

    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === 'string')
    ) {
      throw new BadRequestException(
        'filePaths must be a JSON array of strings',
      );
    }

    return parsed;
  }

  private buildFormData(
    skillManifest: string,
    filePaths: string[],
    files: UploadedSkillFile[],
  ): FormData {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([skillManifest], { type: 'text/markdown' }),
      SKILL_MANIFEST_FILE,
    );
    for (let i = 0; i < filePaths.length; i += 1) {
      formData.append(
        'file',
        new Blob([files[i].buffer], { type: files[i].mimetype }),
        filePaths[i],
      );
    }
    return formData;
  }
}
