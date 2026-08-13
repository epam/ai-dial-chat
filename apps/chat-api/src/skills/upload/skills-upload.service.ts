import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as yauzl from 'yauzl';
import {
  extractDialErrorMessage,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { buildIfMatchHeaders } from '../../common/utils/conditional-headers';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import {
  SKILL_MANIFEST_FILE,
  isValidSkillRelativePath,
} from '../utils/skill-path.util';

export interface UploadedSkillFile {
  buffer: Buffer;
  mimetype: string;
}

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
   * Combines the caller-supplied client-disconnect signal (set by the
   * controller from the request's own `close` event) with the transfer
   * timeout, so an abandoned upload's DIAL Core connection is cancelled
   * promptly instead of running until `SKILL_TRANSFER_TIMEOUT_MS` elapses.
   */
  private combineWithTimeoutSignal(signal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(
      getSkillTransferTimeoutMs(this.configService),
    );
    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
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
    signal?: AbortSignal,
  ): Promise<{ etag?: string }> {
    await this.validateSkillArchive(zipFile.buffer);

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
            signal: this.combineWithTimeoutSignal(signal),
          },
        );

      if (error != null) {
        return mapDialHttpStatus(
          response.status,
          'skills.uploadSkill',
          this.logger,
          error,
          extractDialErrorMessage(error),
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
    signal?: AbortSignal,
  ): Promise<{ etag?: string }> {
    if (!isValidSkillRelativePath(filePath)) {
      throw new BadRequestException('Invalid file path');
    }

    const maxBytes = this.getFileUploadMaxBytes();
    if (file.buffer.length > maxBytes) {
      throw new PayloadTooLargeException('Skill file payload too large');
    }

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
          signal: this.combineWithTimeoutSignal(signal),
        },
      );

      if (error != null) {
        return mapDialHttpStatus(
          response.status,
          'skills.uploadSkillFile',
          this.logger,
          error,
          extractDialErrorMessage(error),
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
