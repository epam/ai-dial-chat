import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiDialCoreErrors } from '../../common/dial/api-dial-core-errors.decorator';
import { GetModelDto } from '../dto/get-model.dto';
import {
  ModelCatalogEntryDto,
  ModelCatalogListResponseDto,
} from '../dto/model-catalog-response.dto';
import { ModelCatalogService } from './model-catalog.service';

const CATALOG_CACHE_CONTROL = 'private, max-age=300';

/* `@Header()` would also stamp error responses, letting a browser keep a
 * transient 404/503 for the full max-age, so the header is set only once the
 * catalog has resolved. */
const setCatalogCacheControl = (res: Response): void => {
  res.setHeader('Cache-Control', CATALOG_CACHE_CONTROL);
};

@ApiTags('models')
@Controller({ path: 'model-catalog', version: '1' })
export class ModelCatalogController {
  constructor(private readonly modelCatalogService: ModelCatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'List the model catalog',
    description:
      'Returns the DIAL Core models visible to the server-side MODEL_CATALOG_API_KEY, ' +
      "including models the caller's own roles cannot access. Display data only: " +
      'GET /api/v1/models still decides what the user can use, and Core invocation ' +
      'settings (defaults, responses_defaults, max_retry_attempts, tokenizer_model) are omitted. ' +
      'One server-side cache entry, shared by all users, is kept for 5 minutes.',
  })
  @ApiDialCoreErrors({ exclude: [HttpStatus.FORBIDDEN] })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the model catalog',
    type: ModelCatalogListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 404,
    description: 'The model catalog is not configured on this deployment',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core rejected the catalog key, or is unreachable or timed out',
  })
  async listModelCatalog(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ModelCatalogListResponseDto> {
    const catalog = await this.modelCatalogService.listCatalog();
    setCatalogCacheControl(res);
    return catalog;
  }

  @Get(':modelName')
  @ApiOperation({
    summary: 'Get a model from the catalog',
    description:
      'Returns one model from the cached model catalog, without a separate DIAL Core call. ' +
      'A model hidden from the catalog key answers 404, never 403, so its existence is not revealed.',
  })
  @ApiDialCoreErrors({ exclude: [HttpStatus.FORBIDDEN] })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the catalog model',
    type: ModelCatalogEntryDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid model name — disallowed characters',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 404,
    description:
      'The model catalog is not configured, or the model is not in the catalog',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core rejected the catalog key, or is unreachable or timed out',
  })
  async getModelCatalogEntry(
    @Param() dto: GetModelDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ModelCatalogEntryDto> {
    const entry = await this.modelCatalogService.getCatalogEntry(dto.modelName);
    setCatalogCacheControl(res);
    return entry;
  }
}
