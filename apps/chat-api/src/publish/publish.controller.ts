import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { ResourceIdResponseDto } from '../common/dto/resource-folder.dto';
import {
  getUserDisplayName,
  resolveDisplayAuthor,
} from '../common/utils/user-display-name';
import { CatalogEntityParamsDto } from './dto/catalog-entity-params.dto';
import { CopyCatalogEntityToOrgUnitDto } from './dto/copy-catalog-entity-to-org-unit.dto';
import { PublishCatalogEntityDto } from './dto/publish-catalog-entity.dto';
import { PublishConflictDto } from './dto/publish-conflict.dto';
import { PublishHistoryEntryDto } from './dto/publish-history-entry.dto';
import { PublishResultDto } from './dto/publish-result.dto';
import {
  PublishTargetCheckDto,
  PublishTargetCheckQueryDto,
} from './dto/publish-target-check.dto';
import { UnpublishAccessDto } from './dto/unpublish-access.dto';
import { UnpublishCatalogEntityDto } from './dto/unpublish-catalog-entity.dto';
import { UnpublishResultDto } from './dto/unpublish-result.dto';
import { VersionStatusEntryDto } from './dto/version-status-entry.dto';
import { OrgUnitCopyService } from './org-unit-copy.service';
import { PublishService } from './publish.service';
import { VersionStatusesService } from './version-statuses.service';

/** Controller for publishing catalog entities to an Organization folder and reading their publish history, both proxied through DIAL Core's Publication API. */
@ApiTags('publish')
@Controller({ path: 'catalog', version: '1' })
export class PublishController {
  constructor(
    private readonly publishService: PublishService,
    private readonly orgUnitCopyService: OrgUnitCopyService,
    private readonly versionStatusesService: VersionStatusesService,
  ) {}

  @Post(':entityType/:entityId/publish')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'publishCatalogEntity',
    summary: 'Publish a catalog entity to an Organization folder',
    description:
      'Publishes a catalog entity (Toolset, Application, Prompt, or Skill) to a folder under the Organization/public ' +
      "bucket by proxying DIAL Core's Publication API (`createPublication`). This endpoint keeps no " +
      'publish records of its own — DIAL Core is the sole source of truth. The optional `author` sets the ' +
      "publication's displayed author (the catalog's **Hosted by** value); when it is omitted or blank the " +
      "caller's own session display name is used, as it always was. The optional `publishCredentials` flag asks " +
      "Core to copy the publisher's own credential for the entity onto the published copy, so members of the " +
      'organization use it without authorising individually; it is forwarded unchanged and changes no ' +
      'authorization — Core still derives the actor from the bearer token, enforces target-folder write access, ' +
      'and holds the publication PENDING until an administrator approves it. Publishing an application also ' +
      'publishes its first-level private dependencies (skills, prompts, toolsets, applications) in the same ' +
      'DIAL Core request, so the published application works for other users; a temporary copy of the ' +
      "application, with its references rewritten, is the request's source and is deleted when the call returns. " +
      "The author's own application is never modified.",
  })
  @ApiBody({ type: PublishCatalogEntityDto })
  @ApiDialCoreErrors()
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
    status: 409,
    description:
      "The same application is already being published, or the published copy would land on a path that is already taken (`code` `target-exists`): another author's resource, or an earlier publication, holds the same name (and version) in this folder. DIAL Core can also report a conflict",
    type: PublishConflictDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description:
      'The session user bucket could not be resolved because DIAL Core is unavailable (raised by session authentication; an unreachable DIAL Core during the call itself is reported as 502)',
  })
  publish(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
    @Body()
    {
      folderPath,
      version,
      author,
      rules,
      publishCredentials,
    }: PublishCatalogEntityDto,
  ): Promise<PublishResultDto> {
    const { at, bucket, claims, sub } = req.user as SessionUser;
    return this.publishService.publish(
      at,
      bucket,
      entityType,
      entityId,
      folderPath,
      version,
      resolveDisplayAuthor(author, claims),
      rules,
      publishCredentials,
      sub,
    );
  }

  @Get(':entityType/:entityId/publish-target')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getCatalogPublishTarget',
    summary:
      'Check whether the published copy of an entity would land on a taken path',
    description:
      "Derives the path a publish of this entity into `folderPath` (and `version`) would create, exactly as the publish endpoint does, and reads that path's metadata with the caller's own token. Creates nothing. `taken: false` means no resource was found, not that none is there: a copy hidden from the caller by access rules, or one still pending approval, is not detected, and another publication can land before the caller submits. The publish endpoint answers `409` `target-exists` for those cases.",
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Whether a resource was found at the target',
    type: PublishTargetCheckDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — invalid entityType, entityId, folderPath or version, or an entity type with no published copy to check',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'DIAL Core refused the caller the read',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable or timed out, or the session user bucket could not be resolved because DIAL Core is unavailable',
  })
  getPublishTarget(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
    @Query() { folderPath, version }: PublishTargetCheckQueryDto,
  ): Promise<PublishTargetCheckDto> {
    const { at } = req.user as SessionUser;
    return this.publishService.checkPublishTarget(
      at,
      entityType,
      entityId,
      folderPath,
      version,
    );
  }

  @Post(':entityType/:entityId/copy-to-org-unit')
  @HttpCode(200)
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.OrgUnitsEnabled)
  @ApiOperation({
    operationId: 'copyCatalogEntityToOrgUnit',
    summary: 'Copy an own catalog entity into an org-unit folder',
    description:
      "Copies a catalog entity of the caller's own bucket into `folderPath` of the public bucket under the same name, by proxying DIAL Core's resource copy. " +
      'No publication request is created: DIAL Core decides whether the caller may write into the folder and applies its per-type rules to the copy, and its 403 and 409 are returned as they are. ' +
      'Applications, toolsets, prompts and skills are supported; other types answer 400. A target that already exists answers 409: the copy never overwrites. ' +
      'Answers 403 while the `features.orgUnitsEnabled` flag is off.',
  })
  @ApiBody({ type: CopyCatalogEntityToOrgUnitDto })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Entity copied; the response carries the id of the copy',
    type: ResourceIdResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — invalid entityType, entityId or folderPath, or an entity type that cannot be copied into an org unit',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      "The `features.orgUnitsEnabled` flag is off, the entity is not in the caller's own bucket, or DIAL Core refused the write (no `write` in the unit, or a Core per-type rule)",
  })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({
    status: 409,
    description:
      'The folder already holds an entity with this name, or DIAL Core refused the copy as a conflict',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  copyToOrgUnit(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
    @Body() body: CopyCatalogEntityToOrgUnitDto,
  ): Promise<ResourceIdResponseDto> {
    const { sub, bucket, at } = req.user as SessionUser;
    return this.orgUnitCopyService.copyIntoOrgUnit(
      sub,
      bucket,
      at,
      entityType,
      entityId,
      body,
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
  @ApiDialCoreErrors()
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
    description:
      'Caller is neither an administrator nor the publisher of this copy, or lacks write access to the target folder',
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
    description:
      'The session user bucket could not be resolved because DIAL Core is unavailable (raised by session authentication; an unreachable DIAL Core during the call itself is reported as 502)',
  })
  unpublish(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
    @Body() { folderPath, version }: UnpublishCatalogEntityDto,
  ): Promise<UnpublishResultDto> {
    const user = req.user as SessionUser;
    return this.publishService.unpublish(
      user,
      entityType,
      entityId,
      folderPath,
      version,
      getUserDisplayName(user.claims),
    );
  }

  @Get(':entityType/:entityId/unpublish-access')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getCatalogUnpublishAccess',
    summary: 'Check whether the caller may request removal of a catalog entity',
    description:
      'Reports whether the session user may submit an unpublish request for this entity: true for an ' +
      'administrator, for an entity in their own bucket, and for the publisher of a public copy (the bucket ' +
      'holding the live publication that created it). It reveals only the caller’s own permission, never who ' +
      'published the entity, and creates nothing. A negative answer is a 200 with `canUnpublish: false`.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Whether the caller may request removal of the entity',
    type: UnpublishAccessDto,
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
    description:
      'DIAL Core returned an error for the publication list, or was unreachable',
  })
  @ApiResponse({
    status: 503,
    description:
      'The session user bucket could not be resolved because DIAL Core is unavailable (raised by session authentication; an unreachable DIAL Core during the call itself is reported as 502)',
  })
  async getCatalogUnpublishAccess(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
  ): Promise<UnpublishAccessDto> {
    return {
      canUnpublish: await this.publishService.canUnpublish(
        req.user as SessionUser,
        entityType,
        entityId,
      ),
    };
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
  @ApiDialCoreErrors()
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

  @Get(':entityType/:entityId/version-statuses')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'getCatalogVersionStatuses',
    summary: 'Get the publication status of every version of an entity',
    description:
      'Returns one entry per saved version of the application or toolset (same owner, folder and base name) ' +
      'with its publication status: `not-published`, `in-review`, `published` (with its folders and publisher) ' +
      'or `unknown` for a resource owned by another user. Derived from the caller’s own publications in DIAL ' +
      'Core, read once per request, and never from chat-api-side storage. Only applications and toolsets have versions.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Status of every version in the entity’s version group',
    type: VersionStatusEntryDto,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — invalid entityType or entityId, or an entity type without versions',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 404,
    description: 'No version of the entity exists in the caller’s listing',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getCatalogVersionStatuses(
    @Req() req: Request,
    @Param() { entityType, entityId }: CatalogEntityParamsDto,
  ): Promise<VersionStatusEntryDto[]> {
    const { sub, at, bucket } = req.user as SessionUser;
    return this.versionStatusesService.getVersionStatuses(
      sub,
      at,
      bucket,
      entityType,
      entityId,
    );
  }
}
