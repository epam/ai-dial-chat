import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';

export interface SkillDownload {
  stream: ReadableStream;
  headers: Record<string, string>;
  abortOnDisconnect: () => void;
}

/**
 * Safe response-header allowlist for skill downloads — based on
 * `apps/chat-api/src/files/download/files-download.service.ts`'s
 * `SAFE_DOWNLOAD_HEADERS` and including `etag`, since skill downloads carry
 * a resource-version ETag the plain file-download endpoint has no equivalent
 * for (design.md D5). `content-length` is intentionally omitted: the SDK's
 * Fetch response body may already be transport-decoded, so the upstream wire
 * length is not necessarily the number of bytes this BFF streams to its
 * caller. Node must frame the outgoing response from the actual body.
 */
export const SAFE_SKILL_DOWNLOAD_HEADERS = [
  'content-type',
  'content-disposition',
  'etag',
] as const;

const GROUPING_FOLDER_DOWNLOAD_MESSAGE =
  'The requested path is a grouping folder, not a skill — use GET /api/v1/skills to list its contents instead of downloading it';

/**
 * `openapi-fetch` resolves an empty-bodied error response (e.g. DIAL Core's
 * `403` with `Content-Length: 0`) with `error: undefined`, so the SDK's
 * `error` field alone cannot tell a failure from a success — the status
 * decides. Checking only `error` let such a response stream its empty body
 * back to the caller as a `200`.
 */
const isFailedResponse = (error: unknown, response: Response): boolean =>
  error != null || response.status >= 400;

/**
 * DIAL Core masks a missing resource as `403` ("You don't have an access
 * to …"). The caller always has access to their own bucket, so a `403` there
 * can only mean the resource does not exist — it is reported as the `404`
 * the frontend contract expects. A `403` on another user's bucket stays a
 * genuine access denial.
 */
const isMaskedNotFound = (
  response: Response,
  bucket: string,
  callerBucket: string | undefined,
): boolean =>
  response.status === 403 && callerBucket != null && bucket === callerBucket;

@Injectable()
export class SkillsDownloadService {
  private readonly logger = new Logger(SkillsDownloadService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private extractSafeHeaders(response: Response): Record<string, string> {
    return Object.fromEntries(
      SAFE_SKILL_DOWNLOAD_HEADERS.map(
        (h) => [h, response.headers.get(h)] as const,
      ).filter(([, v]) => v !== null),
    ) as Record<string, string>;
  }

  /**
   * Downloads a whole skill as a ZIP archive. When `path` resolves to a
   * grouping folder rather than a skill, DIAL Core's `GET
   * /v2/skills/{bucket}/{path}` route answers with the
   * `downloadSkillGroupingFolder` contract instead — a `400` with no body
   * (schema.ts declares no `200` at all for that case) — which this method
   * turns into a `BadRequestException` directing the caller to list
   * metadata instead (design.md's negative-contract rule), rather than
   * forwarding an empty/error body as if it were a ZIP stream.
   *
   * `callerBucket` is the authenticated user's own bucket; a `403` for that
   * bucket is DIAL Core masking a missing skill and becomes a `404`.
   */
  async downloadSkill(
    bucket: string,
    path: string,
    accessToken: string,
    callerBucket?: string,
  ): Promise<SkillDownload> {
    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(
      getSkillTransferTimeoutMs(this.configService),
    );

    try {
      const { error, response } =
        await this.dialClient.client.downloadSkillFolder(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: getBearerAuthHeaders(accessToken),
            parseAs: 'stream',
            signal: AbortSignal.any([abortController.signal, timeoutSignal]),
          },
        );

      if (isFailedResponse(error, response)) {
        if (response.status === 400) {
          throw new BadRequestException(GROUPING_FOLDER_DOWNLOAD_MESSAGE);
        }
        if (isMaskedNotFound(response, bucket, callerBucket)) {
          throw new NotFoundException('Skill not found');
        }
        return handleDialSdkError(
          error,
          'skills.downloadSkill',
          this.logger,
          response,
        );
      }

      const stream = response.body as ReadableStream | null;
      if (stream == null) {
        return handleDialSdkError(
          new Error('DIAL Core returned no skill stream'),
          'skills.downloadSkill',
          this.logger,
          response,
        );
      }

      return {
        stream,
        headers: this.extractSafeHeaders(response),
        abortOnDisconnect: () => abortController.abort(),
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      return handleDialSdkError(err, 'skills.downloadSkill', this.logger);
    }
  }

  /**
   * Downloads one file from a skill. The upstream OpenAPI `content` map key
   * for this operation is the literal string `application/json` regardless
   * of the file's real type (upstream schema debt) — this method trusts the
   * dynamic `Content-Type` response *header* instead, forwarded verbatim
   * through the safe-header allowlist. A `403` for `callerBucket` becomes a
   * `404`, as in `downloadSkill`.
   */
  async downloadSkillFile(
    bucket: string,
    path: string,
    filePath: string,
    accessToken: string,
    callerBucket?: string,
  ): Promise<SkillDownload> {
    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(
      getSkillTransferTimeoutMs(this.configService),
    );

    try {
      const { error, response } =
        await this.dialClient.client.downloadSkillFile(
          bucket,
          encodeDialResourcePath(path),
          encodeDialResourcePath(filePath),
          {
            headers: getBearerAuthHeaders(accessToken),
            parseAs: 'stream',
            signal: AbortSignal.any([abortController.signal, timeoutSignal]),
          },
        );

      if (isFailedResponse(error, response)) {
        if (isMaskedNotFound(response, bucket, callerBucket)) {
          throw new NotFoundException('File or skill not found');
        }
        return handleDialSdkError(
          error,
          'skills.downloadSkillFile',
          this.logger,
          response,
        );
      }

      const stream = response.body as ReadableStream | null;
      if (stream == null) {
        return handleDialSdkError(
          new Error('DIAL Core returned no file stream'),
          'skills.downloadSkillFile',
          this.logger,
          response,
        );
      }

      return {
        stream,
        headers: this.extractSafeHeaders(response),
        abortOnDisconnect: () => abortController.abort(),
      };
    } catch (err) {
      return handleDialSdkError(err, 'skills.downloadSkillFile', this.logger);
    }
  }
}
