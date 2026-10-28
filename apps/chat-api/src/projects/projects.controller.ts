import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import type { UploadedContextFile } from './create/projects-create.service';
import { CreateProjectResponseDto } from './dto/create-project-response.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsResponseDto } from './dto/list-projects-response.dto';
import { ProjectCreateErrorDto } from './dto/project-create-error.dto';
import { ProjectContextUploadInterceptor } from './project-context-upload.interceptor';
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

  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(ProjectContextUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Q4 launch' },
        description: {
          type: 'string',
          example: 'Bundles the Q4 support tickets and survey results.',
        },
        instructions: {
          type: 'string',
          example: '## Approach\nExplain your reasoning step by step.',
        },
        fileNames: {
          type: 'string',
          example: '["tickets.csv","survey.xlsx"]',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'createProject',
    summary: 'Create a project',
    description:
      "Creates a project at the root of the session user's bucket in one atomic, create-only DIAL Core call. " +
      'The BFF writes PROJECT.md (YAML frontmatter with name and description, instructions as the body) and ' +
      'each context file under context/. Name, file names, types, per-file size, total size and file count are ' +
      'validated first; every domain rejection carries a ProjectCreateErrorCode.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 201,
    description: 'The project was created',
    type: CreateProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid name, file names, file type or file count, or an invalid or unknown field',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The projectsEnabled feature is not enabled for this user, or DIAL Core denied access',
  })
  @ApiResponse({
    status: 409,
    description: 'A project with this name already exists (code name-taken)',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({
    status: 413,
    description:
      'A context file or the context files in total are too large (file-too-large, capacity-exceeded)',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  createProject(
    @UploadedFiles() files: UploadedContextFile[] | undefined,
    @Body() body: CreateProjectDto,
    @Req() req: Request,
  ): Promise<CreateProjectResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());
    return this.projectsService.createProject(
      bucket,
      body,
      files ?? [],
      at,
      abortController.signal,
    );
  }
}
