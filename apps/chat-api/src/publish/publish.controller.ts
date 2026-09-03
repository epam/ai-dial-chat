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
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { getUserDisplayName } from '../common/utils/user-display-name';
import { CatalogEntityParamsDto } from './dto/catalog-entity-params.dto';
import { PublishCatalogEntityDto } from './dto/publish-catalog-entity.dto';
import { PublishHistoryEntryDto } from './dto/publish-history-entry.dto';
import { PublishResultDto } from './dto/publish-result.dto';
import { UnpublishCatalogEntityDto } from './dto/unpublish-catalog-entity.dto';
import { UnpublishResultDto } from './dto/unpublish-result.dto';
import { PublishService } from './publish.service';

/** Controller for publishing catalog entities to an Organization folder and reading their publish history, both proxied through DIAL Core's Publication API. */
@ApiTags('publish')
@Controller({ path: 'catalog', version: '1' })
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post(':entityType/:entityId/publish')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'publishCatalogEntity',
    summary: 'Publish a catalog entity to an Organization folder',
    description:
      'Publishes a catalog entity (Toolset, Application, Prompt, or Skill) to a folder under the Organization/public ' +
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
      'Validation error — invalid entityType, entityId, folderPath, version, or rules',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks write access to the target folder',
  })
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
    const { at, bucket, claims } = req.user as SessionUser;
    return this.publishService.publish(
      at,
      bucket,
      entityType,
      entityId,
      folderPath,
      version,
      getUserDisplayName(claims),
      rules,
    );
  }

  @Post(':entityType/:entityId/unpublish')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'unpublishCatalogEntity',
    summary: 'Request removal of a published catalog entity from a folder',
    description:
      'Submits a removal request for one already-published folder of a catalog entity (Toolset, Application, ' +
      "Prompt, or Skill) by proxying DIAL Core's Publication API (`createPublication`) with a single " +
      '`DELETE`-action resource. **The removal takes effect only after an administrator approves the ' +
      'request.** Until then the published copy stays visible to everyone who could already see it, and the ' +
      'folder continues to appear in the entity’s publish history. This endpoint keeps no records of its ' +
      'own — DIAL Core is the sole source of truth.',
  })
  @ApiBody({ type: UnpublishCatalogEntityDto })
  @ApiResponse({
    status: 200,
    description: 'Unpublish request submitted for administrator approval',
    type: UnpublishResultDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — invalid entityType, entityId, folderPath, or version',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks write access to the target folder',
  })
  @ApiResponse({
    status: 404,
    description: 'DIAL Core reports the entity or target folder as unknown',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  unpublish(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
    @Body() { folderPath, version }: UnpublishCatalogEntityDto,
  ): Promise<UnpublishResultDto> {
    const { at, bucket, claims } = req.user as SessionUser;
    return this.publishService.unpublish(
      at,
      bucket,
      entityType,
      entityId,
      folderPath,
      version,
      getUserDisplayName(claims),
    );
  }

  @Get(':entityType/:entityId/publish-history')
  @HttpCode(200)
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
    const { at, bucket } = req.user as SessionUser;
    return this.publishService.getPublishHistory(
      at,
      bucket,
      entityType,
      entityId,
    );
  }
}
