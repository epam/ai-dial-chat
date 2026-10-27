import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { ListProjectsResponseDto } from './dto/list-projects-response.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller({ path: 'projects', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.ProjectsEnabled)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listProjects',
    summary: 'List projects',
    description:
      "Returns every DIAL project visible to the session user: the user's own bucket, " +
      'the public (organization) bucket, and projects shared with the user, merged and ' +
      'de-duplicated by id. The BFF follows DIAL Core paging itself, so the list is complete ' +
      'up to a per-source page cap. A failing source is omitted; the request fails only ' +
      'when both bucket listings fail.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the project list',
    type: ListProjectsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The projectsEnabled feature is not enabled for this user, or DIAL Core denied access',
  })
  listProjects(@Req() req: Request): Promise<ListProjectsResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.projectsService.listProjects(bucket, at);
  }
}
