import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialSdkError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import type { ResourceIdResponseDto } from '../../common/dto/resource-folder.dto';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { buildIfMatchHeaders } from '../../common/utils/conditional-headers';
import {
  buildFolderResourcePath,
  getResourceLeaf,
} from '../../common/utils/dial-resource-transfer';
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
 * itself (`openspec/changes/archive/2026-08-10-add-skills-bff-api/design.md`'s service ownership map).
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
   * manifest is not a valid skill (`openspec/changes/archive/2026-08-10-add-skills-bff-api/design.md` D4).
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
   * headers at all for this operation (`openspec/changes/archive/2026-08-10-add-skills-bff-api/design.md` D2) — there is no
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
   * Moves one of the caller's skills into `folderPath` of the same bucket,
   * never overwriting a skill already there; resolves with its new id.
   * DIAL Core answers a non-overwriting move onto an existing target with
   * 400, so that case is reported as 409.
   */
  async moveSkill(
    bucket: string,
    path: string,
    folderPath: string,
    accessToken: string,
  ): Promise<ResourceIdResponseDto> {
    const context = 'skills.moveSkill';
    const leaf = path.split('/').pop() ?? path;
    const targetPath = folderPath ? `${folderPath}/${leaf}` : leaf;
    if (targetPath === path) return { id: `skills/${bucket}/${path}` };

    const headers = getBearerAuthHeaders(accessToken);
    const sourcePath = encodeDialResourcePath(path);
    const destinationPath = buildFolderResourcePath(
      folderPath,
      getResourceLeaf(sourcePath),
    );
    try {
      const { error, response } = await this.dialClient.client.moveResource({
        headers,
        body: {
          sourceUrl: `skills/${bucket}/${sourcePath}`,
          destinationUrl: `skills/${bucket}/${destinationPath}`,
          overwrite: false,
        },
      });
      if (error == null && response.status < 400) {
        return { id: `skills/${bucket}/${targetPath}` };
      }
      if (
        response.status === 400 &&
        (await this.skillExists(bucket, destinationPath, headers))
      ) {
        this.logger.warn(`DIAL Core rejected ${context}: target exists`);
        throw new ConflictException('A skill with this name already exists');
      }
      return mapDialHttpStatus(response.status, context, this.logger);
    } catch (err) {
      return handleDialSdkError(err, context, this.logger);
    }
  }

  private async skillExists(
    bucket: string,
    encodedPath: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    try {
      const { response } = await this.dialClient.client.listSkillMetadata(
        bucket,
        encodedPath,
        { headers },
      );
      return response.status === 200;
    } catch {
      return false;
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
