import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { CatalogFilterService } from './catalog-filter.service';
import { CatalogService } from './catalog.service';
import { CatalogResponseDto } from './dto/catalog-item.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@ApiTags('catalog')
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogFilterService: CatalogFilterService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    operationId: 'listCatalogItems',
    summary: 'List all catalog items (models and applications)',
    description:
      'Returns all models and applications visible to the authenticated session user, merged and sorted by display name. ' +
      'Results are cached server-side for 30 seconds per user. ' +
      'Optional modelCapabilities.* query parameters filter model items by exact boolean capability values; application items are not filtered. Filtering is applied after cache retrieval.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved catalog',
    type: CatalogResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameter',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listCatalogItems(@Query() query: CatalogQueryDto, @Req() req: Request) {
    const { sub, at } = req.user as SessionUser;
    const filter = this.catalogFilterService.parse(query);
    return this.catalogService.listCatalogItems(sub, at, filter);
  }
}
