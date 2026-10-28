import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import type { ParsedProjectId } from '../utils/project-id.util';
import { PROJECT_CONTEXT_FOLDER } from '../utils/project-manifest.util';

/** A Core download ready to stream to the client. */
export interface ProjectDownload {
  stream: ReadableStream;
  headers: Record<string, string>;
  abortOnDisconnect: () => void;
}

/*
 * Deadline for DIAL Core to answer with response headers (it builds a
 * project archive in memory first). It stops once the headers arrive: the
 * streamed body has no deadline, so a slow client is not cut off, and a
 * client disconnect still aborts it.
 */
const PROJECT_DOWNLOAD_HEADERS_TIMEOUT_MS = 60_000;

/* `content-length` is omitted, as in `SkillsDownloadService`: the SDK body
 * may already be transport-decoded. `content-disposition` is built here. */
const FORWARDED_HEADERS = ['content-type', 'etag'] as const;

/* `openapi-fetch` resolves an empty-bodied error with `error: undefined`, so
 * the status decides. */
const isFailedResponse = (error: unknown, response: Response): boolean =>
  error != null || response.status >= 400;

/* Quotes, backslashes and non-ASCII characters cannot appear in a plain
 * quoted `filename`, so the fallback replaces them; `filename*` carries the
 * exact UTF-8 name for clients that read it. */
const toAsciiFileName = (fileName: string): string =>
  fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');

/** `Content-Disposition` that always downloads: an ASCII `filename` fallback plus the RFC 5987 UTF-8 `filename*`. */
export const buildAttachmentDisposition = (fileName: string): string =>
  `attachment; filename="${toAsciiFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

/**
 * Streams a whole project (Core's ZIP) or one context file to the client.
 * Responses are always attachments with `nosniff`, so a context file never
 * renders on the chat origin. A `403` in the caller's own bucket is Core
 * masking a missing resource and becomes a `404`.
 */
@Injectable()
export class ProjectsDownloadService {
  private readonly logger = new Logger(ProjectsDownloadService.name);

  constructor(private readonly dialClient: DialClientService) {}

  downloadProject(
    project: ParsedProjectId,
    accessToken: string,
    callerBucket: string,
  ): Promise<ProjectDownload> {
    return this.download(
      'projects.downloadProject',
      `${project.name}.zip`,
      project.bucket,
      callerBucket,
      (signal) =>
        this.dialClient.client.downloadProjectFolder(
          project.bucket,
          encodeDialResourcePath(project.path),
          {
            headers: getBearerAuthHeaders(accessToken),
            parseAs: 'stream',
            signal,
          },
        ),
    );
  }

  downloadContextFile(
    project: ParsedProjectId,
    fileName: string,
    accessToken: string,
    callerBucket: string,
  ): Promise<ProjectDownload> {
    return this.download(
      'projects.downloadProjectFile',
      fileName,
      project.bucket,
      callerBucket,
      (signal) =>
        this.dialClient.client.downloadProjectFile(
          project.bucket,
          encodeDialResourcePath(project.path),
          encodeDialResourcePath(`${PROJECT_CONTEXT_FOLDER}/${fileName}`),
          {
            headers: getBearerAuthHeaders(accessToken),
            parseAs: 'stream',
            signal,
          },
        ),
    );
  }

  private async download(
    context: string,
    fileName: string,
    bucket: string,
    callerBucket: string,
    request: (
      signal: AbortSignal,
    ) => Promise<{ error?: unknown; response: Response }>,
  ): Promise<ProjectDownload> {
    const abortController = new AbortController();
    const headersTimer = setTimeout(
      () =>
        abortController.abort(
          new DOMException(
            'DIAL Core did not answer the download in time',
            'TimeoutError',
          ),
        ),
      PROJECT_DOWNLOAD_HEADERS_TIMEOUT_MS,
    );

    try {
      let result: { error?: unknown; response: Response };
      try {
        result = await request(abortController.signal);
      } finally {
        clearTimeout(headersTimer);
      }
      const { error, response } = result;
      if (isFailedResponse(error, response)) {
        if (
          response.status === 404 ||
          (response.status === 403 && bucket === callerBucket)
        ) {
          throw new NotFoundException('Project or file not found');
        }
        return handleDialSdkError(error, context, this.logger, response);
      }

      const stream = response.body as ReadableStream | null;
      if (stream == null) {
        return handleDialSdkError(
          new Error('DIAL Core returned no download stream'),
          context,
          this.logger,
          response,
        );
      }

      const headers: Record<string, string> = {
        'content-disposition': buildAttachmentDisposition(fileName),
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store',
      };
      for (const name of FORWARDED_HEADERS) {
        const value = response.headers.get(name);
        if (value != null) headers[name] = value;
      }

      return {
        stream,
        headers,
        abortOnDisconnect: () => abortController.abort(),
      };
    } catch (err) {
      return handleDialSdkError(err, context, this.logger);
    }
  }
}
