import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CelebrationCatalogService } from './celebration-catalog.service';
import {
  CELEBRATION_IMMUTABLE_CACHE_CONTROL,
  CELEBRATION_INDEX_CACHE_CONTROL,
  PER_RESPONSE_BROTLI_QUALITY,
} from './constants/celebrations.constants';
import { CelebrationCatalogDto } from './dto/celebration-catalog.dto';
import { CelebrationPackDto } from './dto/celebration-pack.dto';
import { GetCelebrationAssetDto } from './dto/get-celebration-asset.dto';
import { GetCelebrationPackDto } from './dto/get-celebration-pack.dto';
import {
  compressCelebrationBody,
  sendCelebrationResponse,
} from './response-encoding';
import { CelebrationMediaType } from './types/celebration';

const BAD_GATEWAY_DESCRIPTION =
  'The themes host answered with an invalid status, a redirect, an unsupported schemaVersion, a schema violation, an exceeded cap, or a size, hash or media-type mismatch';
const UNAVAILABLE_DESCRIPTION =
  'THEMES_CONFIG_URL is not configured, or the themes host is unreachable or timed out';

/* The index and manifests are small and served per response, so they are
 * compressed at a cheaper Brotli quality than the immutable assets. */
const jsonBody = (value: unknown, cacheControl: string) => {
  const body = Buffer.from(JSON.stringify(value));
  return {
    body,
    mediaType: CelebrationMediaType.Json,
    cacheControl,
    encode: (encoding: Parameters<typeof compressCelebrationBody>[1]) =>
      compressCelebrationBody(body, encoding, PER_RESPONSE_BROTLI_QUALITY),
  };
};

/**
 * Public delivery of external celebration packs from
 * `<THEMES_CONFIG_URL>/celebrations/`. No endpoint reads the session or returns
 * user data; theme endpoints are untouched.
 */
@Public()
@ApiTags('celebrations')
@Controller({ path: 'celebrations', version: '1' })
export class CelebrationsController {
  constructor(private readonly catalogService: CelebrationCatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the celebration catalog',
    description:
      'Returns the validated celebration index: every published pack version and the default pack per event. ' +
      'Cached for 60 seconds, with an ETag; manifest paths and hashes are never exposed.',
  })
  @ApiResponse({
    status: 200,
    description: 'The celebration catalog',
    type: CelebrationCatalogDto,
  })
  @ApiResponse({
    status: 304,
    description: 'The catalog matches the If-None-Match ETag',
  })
  @ApiResponse({
    status: 404,
    description: 'The themes host publishes no celebration index',
  })
  @ApiResponse({ status: 502, description: BAD_GATEWAY_DESCRIPTION })
  @ApiResponse({ status: 503, description: UNAVAILABLE_DESCRIPTION })
  async getCelebrationCatalog(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const catalog = await this.catalogService.getCatalog();
    await sendCelebrationResponse(
      request,
      response,
      jsonBody(catalog, CELEBRATION_INDEX_CACHE_CONTROL),
    );
  }

  @Get('packs/:packId/:version')
  @ApiOperation({
    summary: 'Get a celebration pack',
    description:
      'Returns one validated pack version that the current celebration index lists. ' +
      'A version is immutable, so the response may be cached for a year.',
  })
  @ApiResponse({
    status: 200,
    description: 'The validated pack',
    type: CelebrationPackDto,
  })
  @ApiResponse({
    status: 400,
    description: 'packId or version fails its allowlist',
    schema: {
      example: {
        statusCode: 400,
        message: ['packId must be a lowercase kebab-case identifier'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'The current celebration index does not list the pack version',
  })
  @ApiResponse({ status: 502, description: BAD_GATEWAY_DESCRIPTION })
  @ApiResponse({ status: 503, description: UNAVAILABLE_DESCRIPTION })
  async getCelebrationPack(
    @Param() params: GetCelebrationPackDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const pack = await this.catalogService.getPack(
      params.packId,
      params.version,
    );
    await sendCelebrationResponse(
      request,
      response,
      jsonBody(pack, CELEBRATION_IMMUTABLE_CACHE_CONTROL),
    );
  }

  @Get('assets/:assetId')
  @ApiOperation({
    summary: 'Get a celebration asset',
    description:
      'Returns the verified bytes of an asset that a manifest of the current celebration index declares, ' +
      'with its registered Content-Type. JSON and SVG are compressed when the client accepts br or gzip.',
  })
  @ApiResponse({
    status: 200,
    description: 'The asset bytes',
    content: {
      [CelebrationMediaType.Json]: {
        schema: { type: 'object', additionalProperties: true },
      },
      [CelebrationMediaType.Svg]: {
        schema: { type: 'string', format: 'binary' },
      },
      [CelebrationMediaType.Png]: {
        schema: { type: 'string', format: 'binary' },
      },
      [CelebrationMediaType.Webp]: {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'assetId fails its allowlist',
    schema: {
      example: {
        statusCode: 400,
        message: ['assetId must be a lowercase asset identifier'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'No manifest listed by the current celebration index declares the asset',
  })
  @ApiResponse({ status: 502, description: BAD_GATEWAY_DESCRIPTION })
  @ApiResponse({ status: 503, description: UNAVAILABLE_DESCRIPTION })
  async getCelebrationAsset(
    @Param() params: GetCelebrationAssetDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const asset = await this.catalogService.getAsset(params.assetId);
    await sendCelebrationResponse(request, response, {
      body: asset.body,
      mediaType: asset.mediaType,
      cacheControl: CELEBRATION_IMMUTABLE_CACHE_CONTROL,
      encode: (encoding) =>
        this.catalogService.getEncodedAsset(params.assetId, asset, encoding),
    });
  }
}
