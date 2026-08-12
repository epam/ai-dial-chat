import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { buildIfMatchHeaders } from '../../common/utils/conditional-headers';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import { SKILL_MANIFEST_FILE } from '../utils/skill-path.util';

/**
 * Owns the four structural skill mutations: whole-skill deletion, single-file
 * deletion, and grouping-folder create/delete. Folded into one service
 * rather than split further because none of these four share state, a
 * cache, or a cross-cutting dependency with each other beyond the SDK client
 * itself (design.md's service ownership map).
 */
@Injectable()
export class SkillsMutationService {
  private readonly logger = new Logger(SkillsMutationService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /** Deletes a whole skill. DIAL Core returns no body/ETag on success. */
  async deleteSkill(
    bucket: string,
    path: string,
    accessToken: string,
    ifMatch?: string,
  ): Promise<{ success: true }> {
    try {
      const { error, response } =
        await this.dialClient.client.deleteSkillFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: {
              ...getBearerAuthHeaders(accessToken),
              ...buildIfMatchHeaders(ifMatch),
            },
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
          },
        );

      if (error != null) {
        return handleDialSdkError(
          error,
          'skills.deleteSkill',
          this.logger,
          response,
        );
      }

      return { success: true };
    } catch (err) {
      return handleDialSdkError(err, 'skills.deleteSkill', this.logger);
    }
  }

  /**
   * Deletes one file inside a skill. Rejects deleting the skill's own
   * `SKILL.md` manifest before ever calling DIAL Core — a skill without a
   * manifest is not a valid skill (design.md D4).
   */
  async deleteSkillFile(
    bucket: string,
    path: string,
    filePath: string,
    accessToken: string,
    ifMatch?: string,
  ): Promise<{ etag?: string }> {
    if (filePath === SKILL_MANIFEST_FILE) {
      throw new BadRequestException(
        `Cannot delete ${SKILL_MANIFEST_FILE} — it is required at the skill root`,
      );
    }

    try {
      const { error, response } = await this.dialClient.client.deleteSkillFile(
        bucket,
        encodeDialResourcePath(path),
        encodeDialResourcePath(filePath),
        {
          headers: {
            ...getBearerAuthHeaders(accessToken),
            ...buildIfMatchHeaders(ifMatch),
          },
          signal: AbortSignal.timeout(
            getSkillTransferTimeoutMs(this.configService),
          ),
        },
      );

      if (error != null) {
        return handleDialSdkError(
          error,
          'skills.deleteSkillFile',
          this.logger,
          response,
        );
      }

      return { etag: response.headers.get('etag') ?? undefined };
    } catch (err) {
      return handleDialSdkError(err, 'skills.deleteSkillFile', this.logger);
    }
  }

  /**
   * Creates a grouping folder. The verified SDK schema declares no request
   * headers at all for this operation (design.md D2) — there is no
   * `ifMatch` parameter to forward, unlike every other mutation here.
   */
  async createSkillGroupingFolder(
    bucket: string,
    path: string,
    accessToken: string,
  ): Promise<{ etag?: string }> {
    try {
      const { error, response } =
        await this.dialClient.client.createSkillGroupingFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: getBearerAuthHeaders(accessToken),
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
          },
        );

      if (error != null) {
        return handleDialSdkError(
          error,
          'skills.createSkillGroupingFolder',
          this.logger,
          response,
        );
      }

      return { etag: response.headers.get('etag') ?? undefined };
    } catch (err) {
      return handleDialSdkError(
        err,
        'skills.createSkillGroupingFolder',
        this.logger,
      );
    }
  }

  /**
   * Deletes an empty grouping folder. DIAL Core returns `409` when the
   * folder is non-empty, already mapped to `ConflictException` by the
   * existing `mapDialHttpStatus` branch.
   */
  async deleteSkillGroupingFolder(
    bucket: string,
    path: string,
    accessToken: string,
    ifMatch?: string,
  ): Promise<{ success: true }> {
    try {
      const { error, response } =
        await this.dialClient.client.deleteSkillGroupingFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: {
              ...getBearerAuthHeaders(accessToken),
              ...buildIfMatchHeaders(ifMatch),
            },
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
          },
        );

      if (error != null) {
        return handleDialSdkError(
          error,
          'skills.deleteSkillGroupingFolder',
          this.logger,
          response,
        );
      }

      return { success: true };
    } catch (err) {
      return handleDialSdkError(
        err,
        'skills.deleteSkillGroupingFolder',
        this.logger,
      );
    }
  }
}
