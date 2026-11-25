import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ClientClosedRequestException } from '../common/exceptions/client-closed-request.exception';
import { SVG_CONTENT_SECURITY_POLICY } from '../common/utils/svg-content-security-policy';
import {
  ContentSourceOperation,
  ContentSourceResult,
  recordContentSourceCall,
} from './content-sources-telemetry';
import {
  ContentSourcesQueueFullException,
  ContentSourcesRequest,
  ContentSourcesService,
  UpstreamCredentialsException,
} from './content-sources.service';
import {
  ContentDocumentResponseDto,
  ContentSourceParamsDto,
  ContentSourcePathQueryDto,
  ContentSourceResponseDto,
} from './dto/content-sources.dto';

const SVG_MIME_TYPE = 'image/svg+xml';
const ASSET_CACHE_CONTROL = 'private, max-age=3600';

const ASSET_CONTENT = {
  'image/png': { schema: { type: 'string', format: 'binary' } },
  'image/jpeg': { schema: { type: 'string', format: 'binary' } },
  'image/gif': { schema: { type: 'string', format: 'binary' } },
  'image/webp': { schema: { type: 'string', format: 'binary' } },
  [SVG_MIME_TYPE]: { schema: { type: 'string', format: 'binary' } },
} as const;

const resolvePrincipalKey = (user: SessionUser): string =>
  `${user.providerId}:${user.sub}`;

const elapsedSeconds = (startedAt: bigint): number =>
  Number(process.hrtime.bigint() - startedAt) / 1e9;

const classifyFailure = (
  error: unknown,
  signal?: AbortSignal,
): ContentSourceResult => {
  if (signal?.aborted) return ContentSourceResult.ClientClosed;
  if (!(error instanceof HttpException)) {
    return ContentSourceResult.InternalError;
  }
  if (error instanceof UpstreamCredentialsException) {
    return ContentSourceResult.UpstreamCredentials;
  }
  if (error instanceof ContentSourcesQueueFullException) {
    return ContentSourceResult.UpstreamQueueFull;
  }
  switch (error.getStatus()) {
    case HttpStatus.BAD_REQUEST:
      return ContentSourceResult.BadRequest;
    case HttpStatus.NOT_FOUND:
      return ContentSourceResult.NotFound;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ContentSourceResult.AdmissionRejected;
    case HttpStatus.SERVICE_UNAVAILABLE:
      return ContentSourceResult.Unavailable;
    case HttpStatus.BAD_GATEWAY:
      return ContentSourceResult.UpstreamError;
    default:
      return ContentSourceResult.InternalError;
  }
};

@ApiTags('content-sources')
@Controller({ path: 'content-sources', version: '1' })
export class ContentSourcesController {
  private readonly logger = new Logger(ContentSourcesController.name);

  constructor(private readonly service: ContentSourcesService) {}

  @Get(':sourceId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getContentSource',
    summary: 'List the documents of a deployment-configured content source',
    description:
      'Lists the Markdown documents of a GitHub or GitLab source configured in CONTENT_SOURCES_CONFIG. The upstream token stays on the server.',
  })
  @ApiResponse({
    status: 200,
    description: 'The source and its documents',
    type: ContentSourceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 404,
    description: 'No such source, or the repository path does not exist',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many concurrent content-source requests',
  })
  @ApiResponse({
    status: 502,
    description:
      'The hosting provider rejected the credentials or returned an invalid or oversized response',
  })
  @ApiResponse({
    status: 503,
    description: 'The hosting provider is unreachable or timed out',
  })
  getContentSource(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: ContentSourceParamsDto,
  ): Promise<ContentSourceResponseDto> {
    return this.run(
      ContentSourceOperation.List,
      params.sourceId,
      req,
      res,
      (request) => this.service.listSource(params.sourceId, request),
    );
  }

  @Get(':sourceId/document')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getContentSourceDocument',
    summary: 'Read one Markdown document of a content source',
    description:
      'Returns the document Markdown unchanged. The path must be inside the source and match its include glob.',
  })
  @ApiResponse({
    status: 200,
    description: 'The document',
    type: ContentDocumentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or unsafe path' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'No such source or document' })
  @ApiResponse({
    status: 429,
    description: 'Too many concurrent content-source requests',
  })
  @ApiResponse({
    status: 502,
    description:
      'The hosting provider rejected the credentials or returned an invalid or oversized response',
  })
  @ApiResponse({
    status: 503,
    description: 'The hosting provider is unreachable or timed out',
  })
  getContentSourceDocument(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: ContentSourceParamsDto,
    @Query() query: ContentSourcePathQueryDto,
  ): Promise<ContentDocumentResponseDto> {
    return this.run(
      ContentSourceOperation.Document,
      params.sourceId,
      req,
      res,
      (request) =>
        this.service.getDocument(params.sourceId, query.path, request),
    );
  }

  @Get(':sourceId/asset')
  @ApiOperation({
    operationId: 'getContentSourceAsset',
    summary: 'Read one image of a content source',
    description:
      'Returns image bytes (png, jpg, jpeg, gif, webp, svg) from within the source assets folder. SVG responses carry a sandboxing Content-Security-Policy.',
  })
  @ApiResponse({
    status: 200,
    description: 'The image bytes',
    content: ASSET_CONTENT,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or unsafe path, or an unsupported file type',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 404,
    description:
      'No such source or asset, or the path is outside the assets folder',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many concurrent content-source requests',
  })
  @ApiResponse({
    status: 502,
    description:
      'The hosting provider rejected the credentials or returned an invalid or oversized response',
  })
  @ApiResponse({
    status: 503,
    description: 'The hosting provider is unreachable or timed out',
  })
  async getContentSourceAsset(
    @Req() req: Request,
    @Res() res: Response,
    @Param() params: ContentSourceParamsDto,
    @Query() query: ContentSourcePathQueryDto,
  ): Promise<void> {
    const asset = await this.run(
      ContentSourceOperation.Asset,
      params.sourceId,
      req,
      res,
      (request) => this.service.getAsset(params.sourceId, query.path, request),
    );

    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', ASSET_CACHE_CONTROL);
    if (asset.contentType === SVG_MIME_TYPE) {
      res.setHeader('Content-Security-Policy', SVG_CONTENT_SECURITY_POLICY);
    }
    res.send(asset.bytes);
  }

  /*
   * Resolve the source first so an unknown id is refused before any work;
   * then run and always record. Admission is not decided here: fresh cache
   * hits are never throttled, and upstream work is bounded where it starts
   * (per-user miss lease in the service, pool gates under the providers). A
   * client disconnect aborts this request's signal, so a load nobody else
   * waits for leaves the upstream queue or is aborted.
   */
  private async run<T>(
    operation: ContentSourceOperation,
    sourceId: string,
    req: Request,
    res: Response,
    task: (request: ContentSourcesRequest) => Promise<T>,
  ): Promise<T> {
    let known = false;
    try {
      this.service.resolve(sourceId);
      known = true;
    } catch (error) {
      this.record(operation, sourceId, false, classifyFailure(error), 0);
      throw error;
    }

    const clientAbort = new AbortController();
    const handleClose = () => {
      if (!res.writableEnded) clientAbort.abort();
    };
    res.on('close', handleClose);

    const startedAt = process.hrtime.bigint();
    try {
      const result = await task({
        principalKey: resolvePrincipalKey(req.user as SessionUser),
        signal: clientAbort.signal,
      });
      this.record(
        operation,
        sourceId,
        known,
        ContentSourceResult.Success,
        elapsedSeconds(startedAt),
      );
      return result;
    } catch (error) {
      this.record(
        operation,
        sourceId,
        known,
        classifyFailure(error, clientAbort.signal),
        elapsedSeconds(startedAt),
      );
      /*
       * Once the client is gone, whatever failed is a consequence of that
       * abort (often a bare AbortError). A typed exception keeps the global
       * filter from logging every abandoned image as an unexpected error.
       */
      if (clientAbort.signal.aborted) {
        this.logger.debug(
          `Content source "${sourceId}" ${operation} aborted: client disconnected`,
        );
        throw new ClientClosedRequestException();
      }
      throw error;
    } finally {
      res.off('close', handleClose);
    }
  }

  private record(
    operation: ContentSourceOperation,
    sourceId: string,
    known: boolean,
    result: ContentSourceResult,
    durationSeconds: number,
  ): void {
    recordContentSourceCall({
      sourceId,
      known,
      operation,
      result,
      durationSeconds,
    });
  }
}
