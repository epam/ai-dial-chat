import { Controller, Get, HttpCode, Param, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { PublishDependenciesService } from './dependencies/publish-dependencies.service';
import { CatalogEntityParamsDto } from './dto/catalog-entity-params.dto';
import { ResourceDependenciesResultDto } from './dto/resource-dependency.dto';

/**
 * Reads the resources a catalog entity refers to that are not in the public
 * bucket. A sibling of `PublishController` on the same `catalog` path, kept
 * apart because it is advisory: it never fails on an upstream error, unlike the
 * publish routes that proxy DIAL Core.
 */
@ApiTags('publish')
@Controller({ path: 'catalog', version: '1' })
export class PublishDependenciesController {
  constructor(
    private readonly publishDependenciesService: PublishDependenciesService,
  ) {}

  @Get(':entityType/:entityId/publish-dependencies')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getCatalogPublishDependencies',
    summary: 'List the private dependencies of a catalog entity',
    description:
      'Returns the direct references of a catalog entity (Toolset, Application, Prompt, Skill or Project) ' +
      'that are not in the public bucket, so the publisher can publish them too before the published copy ' +
      'reaches its audience. Resources that publishing already carries along (the application icon and its ' +
      'declared files) are not listed, and a dependency’s own dependencies are not followed. The list is ' +
      'advisory: when it cannot be resolved the response is an empty list rather than an error. Kinds that ' +
      'reference no other resource always return an empty list.',
  })
  @ApiResponse({
    status: 200,
    description: 'The entity’s private dependencies, possibly empty',
    type: ResourceDependenciesResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid entityType or entityId',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  getPublishDependencies(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
  ): Promise<ResourceDependenciesResultDto> {
    const { at, sub } = req.user as SessionUser;
    return this.publishDependenciesService.getDependencies(
      at,
      sub,
      entityType,
      entityId,
    );
  }
}
