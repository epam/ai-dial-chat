import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as yauzl from 'yauzl';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { isValidSkillRelativePath } from '../utils/skill-path.util';

export interface UploadedSkillFile {
  buffer: Buffer;
  mimetype: string;
}

const SKILL_MANIFEST_FILE = 'SKILL.md';

const buildIfMatchHeaders = (ifMatch?: string): Record<string, string> =>
  ifMatch != null ? { 'If-Match': ifMatch } : {};

const buildUploadFormData = (
  file: UploadedSkillFile,
  fileName: string,
): FormData => {
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype }),
    fileName,
  );
  return formData;
};

@Injectable()
export class SkillsUploadService {
  private readonly logger = new Logger(SkillsUploadService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return (
      this.configService.get<number>('SKILL_TRANSFER_TIMEOUT_MS') ?? 60_000
    );
  }

  private getUploadMaxFiles(): number {
    return this.configService.get<number>('SKILL_UPLOAD_MAX_FILES') ?? 500;
  }

  private getFileUploadMaxBytes(): number {
    return (
      this.configService.get<number>('SKILL_FILE_UPLOAD_MAX_BYTES') ??
      20_971_520
    );
  }

  /**
   * Validates every entry of an uploaded whole-skill ZIP (path safety,
   * reserved markers, duplicate paths, `SKILL.md` at the root — design.md
   * D1/D4) without extracting any file content, then forwards the untouched
   * ZIP buffer to DIAL Core's `uploadSkillFolder`, which does its own
   * extraction server-side. Returns the new aggregate ETag when DIAL Core
   * provides one.
   */
  async uploadSkill(
    bucket: string,
    path: string,
    zipFile: UploadedSkillFile,
    accessToken: string,
    ifMatch?: string,
  ): Promise<{ etag?: string }> {
    await this.validateSkillArchive(zipFile.buffer);

    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(this.getTimeoutMs());

    try {
      const { error, response } =
        await this.dialClient.client.uploadSkillFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: {
              ...getBearerAuthHeaders(accessToken),
              ...buildIfMatchHeaders(ifMatch),
            },
            body: buildUploadFormData(
              zipFile,
              `${path.split('/').filter(Boolean).pop() ?? 'skill'}.zip`,
            ) as unknown as { file: string },
            signal: AbortSignal.any([abortController.signal, timeoutSignal]),
          },
        );

      if (error != null) {
        return handleDialSdkError(
          error,
          'skills.uploadSkill',
          this.logger,
          response,
        );
      }

      return { etag: response.headers.get('etag') ?? undefined };
    } catch (err) {
      return handleDialSdkError(err, 'skills.uploadSkill', this.logger);
    }
  }

  /**
   * Uploads (or replaces) a single file inside an existing skill. `filePath`
   * is re-validated here (beyond the DTO's `IsValidFilePath`) against the
   * same reserved-marker/path-safety rules whole-skill entries use, since
   * both are DIAL Core skill-relative paths (design.md D4).
   */
  async uploadSkillFile(
    bucket: string,
    path: string,
    filePath: string,
    file: UploadedSkillFile,
    accessToken: string,
    ifMatch?: string,
  ): Promise<{ etag?: string }> {
    if (!isValidSkillRelativePath(filePath)) {
      throw new BadRequestException('Invalid file path');
    }

    const maxBytes = this.getFileUploadMaxBytes();
    if (file.buffer.length > maxBytes) {
      throw new PayloadTooLargeException('Skill file payload too large');
    }

    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(this.getTimeoutMs());

    try {
      const { error, response } = await this.dialClient.client.uploadSkillFile(
        bucket,
        encodeDialResourcePath(path),
        encodeDialResourcePath(filePath),
        {
          headers: {
            ...getBearerAuthHeaders(accessToken),
            ...buildIfMatchHeaders(ifMatch),
          },
          body: buildUploadFormData(
            file,
            filePath.split('/').filter(Boolean).pop() ?? 'file',
          ) as unknown as { file: string },
          signal: AbortSignal.any([abortController.signal, timeoutSignal]),
        },
      );

      if (error != null) {
        return handleDialSdkError(
          error,
          'skills.uploadSkillFile',
          this.logger,
          response,
        );
      }

      return { etag: response.headers.get('etag') ?? undefined };
    } catch (err) {
      return handleDialSdkError(err, 'skills.uploadSkillFile', this.logger);
    }
  }

  /**
   * Reads a ZIP's central directory (no content extraction) and rejects it
   * with `BadRequestException` on any unsafe/reserved entry path or
   * duplicate relative path, and with `UnprocessableEntityException` when it
   * exceeds `SKILL_UPLOAD_MAX_FILES` or is missing a root `SKILL.md`.
   */
  private async validateSkillArchive(buffer: Buffer): Promise<void> {
    let zipfile: yauzl.ZipFile;
    try {
      zipfile = await yauzl.fromBufferPromise(buffer, {
        lazyEntries: true,
        decodeStrings: false,
        autoClose: false,
      });
    } catch {
      throw new BadRequestException('Invalid or corrupted skill ZIP archive');
    }

    try {
      const maxFiles = this.getUploadMaxFiles();
      const seenPaths = new Set<string>();
      let hasManifest = false;
      let fileCount = 0;

      for await (const entry of zipfile.eachEntry()) {
        const fileName = this.decodeEntryName(entry.fileName);
        if (fileName.endsWith('/')) {
          continue;
        }

        fileCount += 1;
        if (fileCount > maxFiles) {
          throw new UnprocessableEntityException(
            `Skill archive contains more than ${maxFiles} files`,
          );
        }

        if (!isValidSkillRelativePath(fileName)) {
          throw new BadRequestException(
            `Skill archive contains an invalid entry path: ${fileName}`,
          );
        }

        if (seenPaths.has(fileName)) {
          throw new BadRequestException(
            `Skill archive contains a duplicate entry path: ${fileName}`,
          );
        }
        seenPaths.add(fileName);

        if (fileName === SKILL_MANIFEST_FILE) {
          hasManifest = true;
        }
      }

      if (!hasManifest) {
        throw new BadRequestException(
          `Skill archive is missing a root ${SKILL_MANIFEST_FILE} file`,
        );
      }
    } finally {
      zipfile.close();
    }
  }

  /** Decodes a yauzl entry name read with `decodeStrings: false` (raw `Buffer`), or passes a string through unchanged. */
  private decodeEntryName(rawFileName: string): string {
    const raw: unknown = rawFileName;
    return Buffer.isBuffer(raw) ? raw.toString('utf8') : rawFileName;
  }
}
