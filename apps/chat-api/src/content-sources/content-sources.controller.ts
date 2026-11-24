import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { SVG_CONTENT_SECURITY_POLICY } from '../common/utils/svg-content-security-policy';
import { ContentSourcesAdmissionService } from './content-sources-admission.service';
import {
  ContentSourceOperation,
  ContentSourceResult,
  recordContentSourceCall,
} from './content-sources-telemetry';
import {
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

const classifyFailure = (error: unknown): ContentSourceResult => {
  if (!(error instanceof HttpException)) {
    return ContentSourceResult.InternalError;
  }
  if (error instanceof UpstreamCredentialsException) {
    return ContentSourceResult.UpstreamCredentials;
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
  constructor(
    private readonly service: ContentSourcesService,
    private readonly admission: ContentSourcesAdmissionService,
  ) {}

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
    @Param() params: ContentSourceParamsDto,
  ): Promise<ContentSourceResponseDto> {
    return this.run(ContentSourceOperation.List, params.sourceId, req, () =>
      this.service.listSource(params.sourceId),
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
    @Param() params: ContentSourceParamsDto,
    @Query() query: ContentSourcePathQueryDto,
  ): Promise<ContentDocumentResponseDto> {
    return this.run(ContentSourceOperation.Document, params.sourceId, req, () =>
      this.service.getDocument(params.sourceId, query.path),
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
      () => this.service.getAsset(params.sourceId, query.path),
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
   * Resolve the source first so an unknown id is refused before admission and
   * never holds capacity; then admit, run, and always release and record.
   */
  private async run<T>(
    operation: ContentSourceOperation,
    sourceId: string,
    req: Request,
    task: () => Promise<T>,
  ): Promise<T> {
    let known = false;
    try {
      this.service.resolve(sourceId);
      known = true;
    } catch (error) {
      this.record(operation, sourceId, false, classifyFailure(error), 0);
      throw error;
    }

    const principalKey = resolvePrincipalKey(req.user as SessionUser);
    if (!this.admission.tryAcquire(principalKey)) {
      this.record(
        operation,
        sourceId,
        known,
        ContentSourceResult.AdmissionRejected,
        0,
      );
      throw new HttpException(
        'Too many concurrent content-source requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const startedAt = process.hrtime.bigint();
    try {
      const result = await task();
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
        classifyFailure(error),
        elapsedSeconds(startedAt),
      );
      throw error;
    } finally {
      this.admission.release(principalKey);
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
