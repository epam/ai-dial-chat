import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { getUserDisplayName } from '../common/utils/user-display-name';
import { CatalogEntityParamsDto } from './dto/catalog-entity-params.dto';
import { PublishCatalogEntityDto } from './dto/publish-catalog-entity.dto';
import { PublishHistoryEntryDto } from './dto/publish-history-entry.dto';
import { PublishResultDto } from './dto/publish-result.dto';
import { PublishService } from './publish.service';

/** Controller for publishing catalog entities to an Organization folder and reading their publish history, both proxied through DIAL Core's Publication API. */
@ApiTags('publish')
@Controller({ path: 'catalog', version: '1' })
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post(':entityType/:entityId/publish')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'publishCatalogEntity',
    summary: 'Publish a catalog entity to an Organization folder',
    description:
      'Publishes a catalog entity (Toolset or Application) to a folder under the Organization/public ' +
      "bucket by proxying DIAL Core's Publication API (`createPublication`). This endpoint keeps no " +
      'publish records of its own — DIAL Core is the sole source of truth.',
  })
  @ApiBody({ type: PublishCatalogEntityDto })
  @ApiResponse({
    status: 201,
    description: 'Entity published successfully',
    type: PublishResultDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — invalid entityType, entityId, or folderPath',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks write access to the target folder',
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
  publish(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
    @Body() { folderPath, version, rules }: PublishCatalogEntityDto,
  ): Promise<PublishResultDto> {
    const { at, claims } = req.user as SessionUser;
    return this.publishService.publish(
      at,
      entityType,
      entityId,
      folderPath,
      version,
      getUserDisplayName(claims),
      rules,
    );
  }

  @Get(':entityType/:entityId/publish-history')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'getCatalogPublishHistory',
    summary: 'Get publish history for a catalog entity',
    description:
      'Returns every folder this catalog entity has been published to, most recent first, derived from ' +
      "DIAL Core's Publication API (`getPublications`) — never from chat-api-side storage.",
  })
  @ApiResponse({
    status: 200,
    description: 'Publish history for the entity',
    type: PublishHistoryEntryDto,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid entityType or entityId',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
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
  getPublishHistory(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
  ): Promise<PublishHistoryEntryDto[]> {
    const { at } = req.user as SessionUser;
    return this.publishService.getPublishHistory(at, entityType, entityId);
  }
}
