import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import type { UploadedSkillFile } from '../package/skills-package.service';
import { SkillsPackageService } from '../package/skills-package.service';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import { isValidSkillRelativePath } from '../utils/skill-path.util';

const buildSingleFileFormData = (
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
    private readonly packageService: SkillsPackageService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getFileUploadMaxBytes(): number {
    return (
      this.configService.get<number>('SKILL_FILE_UPLOAD_MAX_BYTES') ?? 1_048_576
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
   * Creates a new skill atomically. Sends `If-None-Match: '*'` to DIAL
   * Core's `uploadSkillFolder` (its real, verified create-only mechanism —
   * design.md's Context, read directly from Core's `EtagHeader` source) and
   * sends no `If-Match`. A `412` response (Core's real create-collision
   * signal) is translated to `409 Conflict`.
   */
  async createSkill(
    bucket: string,
    path: string,
    skillManifest: string,
    filePathsJson: string,
    files: UploadedSkillFile[],
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<{ etag?: string }> {
    const formData = this.packageService.validateAndBuildFormData(
      skillManifest,
      filePathsJson,
      files,
    );

    try {
      const { error, response } =
        await this.dialClient.client.uploadSkillFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: {
              ...getBearerAuthHeaders(accessToken),
              // Undeclared in the pinned SDK's operation type — a verified
              // schema gap, not a speculative header (design.md D2).
              'If-None-Match': '*',
            } as Record<string, string>,
            body: formData as unknown as { file: string },
            signal: this.combineWithTimeoutSignal(signal),
          },
        );

      if (error != null) {
        if (response.status === 412) {
          throw new ConflictException(
            extractDialErrorMessage(error) ??
              'A skill already exists at this path',
          );
        }
        return mapDialHttpStatus(
          response.status,
          'skills.createSkill',
          this.logger,
          error,
          extractDialErrorMessage(error),
        );
      }

      return { etag: response.headers.get('etag') ?? undefined };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      return handleDialSdkError(err, 'skills.createSkill', this.logger);
    }
  }

  /**
   * Replaces an existing skill's whole content, guarded by the caller's
   * concrete `If-Match`. A `412` response is a genuine stale-edit conflict
   * and is surfaced unchanged.
   */
  async updateSkill(
    bucket: string,
    path: string,
    skillManifest: string,
    filePathsJson: string,
    files: UploadedSkillFile[],
    ifMatch: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<{ etag?: string }> {
    const formData = this.packageService.validateAndBuildFormData(
      skillManifest,
      filePathsJson,
      files,
    );

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
            body: formData as unknown as { file: string },
            signal: this.combineWithTimeoutSignal(signal),
          },
        );

      if (error != null) {
        return mapDialHttpStatus(
          response.status,
          'skills.updateSkill',
          this.logger,
          error,
          extractDialErrorMessage(error),
        );
      }

      return { etag: response.headers.get('etag') ?? undefined };
    } catch (err) {
      return handleDialSdkError(err, 'skills.updateSkill', this.logger);
    }
  }

  /**
   * Uploads (or replaces) a single file inside an existing skill. `filePath`
   * is re-validated here (beyond the DTO's `IsValidFilePath`) against the
   * same reserved-marker/path-safety rules whole-skill entries use. This
   * operation always targets an existing skill (adding a file to a skill
   * that doesn't exist yet is not a supported flow) — it has no create-only
   * case and therefore no `If-None-Match`/`409` handling to add.
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
          body: buildSingleFileFormData(
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
}
