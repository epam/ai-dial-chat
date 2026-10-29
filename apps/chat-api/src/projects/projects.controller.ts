import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import type { UploadedContextFile } from './create/projects-create.service';
import {
  type ProjectDownload,
  ProjectsDownloadService,
} from './download/projects-download.service';
import { CreateProjectResponseDto } from './dto/create-project-response.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsResponseDto } from './dto/list-projects-response.dto';
import { ProjectCreateErrorDto } from './dto/project-create-error.dto';
import { ProjectDetailsDto } from './dto/project-details.dto';
import {
  ProjectFileParamDto,
  ProjectIdParamDto,
} from './dto/project-id-param.dto';
import {
  UpdateProjectDto,
  UpdateProjectResponseDto,
} from './dto/update-project.dto';
import { ProjectContextUploadInterceptor } from './project-context-upload.interceptor';
import { ProjectsService, requireProjectId } from './projects.service';
import { ProjectsUpdateService } from './update/projects-update.service';

/** Request header name of a conditional write's ETag, as Express lower-cases it. */
const IF_MATCH_HEADER = 'if-match';

/** Swagger metadata of the required `If-Match` header on conditional writes. */
const IF_MATCH_HEADER_DOC = {
  name: 'If-Match',
  required: true,
  description:
    'The single `etag` of the project version the caller read. A stale value yields 409 project-changed; a missing one, `*` or a comma-separated list, 428.',
};

/** Swagger metadata of the URL-encoded `:id` param shared by every per-project route. */
const PROJECT_ID_PARAM = {
  name: 'id',
  description:
    'The DIAL project id `projects/{bucket}/{path}`, URL-encoded into one path segment.',
  example: 'projects%2Fa1b2c3%2Fmarketing%2Fq4-launch',
};

/** Swagger description of `403` on the owner-only writes. */
const OWNER_ONLY_FORBIDDEN =
  "The projectsEnabled feature is not enabled for this user, the project is not in the caller's own bucket, or DIAL Core denied access";

/*
 * A signal that aborts when the client goes away, so a long Core call stops
 * with the request. Express emits `close` on the request once the response
 * has ended or the connection dropped.
 */
const abortOnClose = (req: Request): AbortSignal => {
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());
  return abortController.signal;
};

@ApiTags('projects')
@Controller({ path: 'projects', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.ProjectsEnabled)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly downloadService: ProjectsDownloadService,
    private readonly updateService: ProjectsUpdateService,
  ) {}

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

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getProject',
    summary: 'Get a project',
    description:
      "Returns one project's name, description, instructions, context files with their sizes, " +
      'and the ETag of the version they were read from. The BFF reads the project archive from ' +
      'DIAL Core, because project metadata carries no file sizes; `canEdit` is true only for a ' +
      "project in the caller's own bucket.",
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the project',
    type: ProjectDetailsDto,
  })
  @ApiResponse({ status: 400, description: 'The project id is invalid' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The projectsEnabled feature is not enabled for this user, or DIAL Core denied access',
  })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  @ApiResponse({
    status: 413,
    description:
      'The project archive exceeds the read limit (project-too-large)',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error or an invalid archive',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getProject(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
  ): Promise<ProjectDetailsDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.projectsService.getProject(id, bucket, at, abortOnClose(req));
  }

  @Put(':id')
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
        fileNames: { type: 'string', example: '["retro.pdf"]' },
        removedFileNames: { type: 'string', example: '["survey.xlsx"]' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'updateProject',
    summary: 'Save a project edit',
    description:
      'Saves the name, description, instructions and context of a project in one conditional DIAL Core write: ' +
      'the BFF rebuilds PROJECT.md, keeps every stored context file not listed in `removedFileNames`, adds the ' +
      '`files` parts and writes the whole project with `If-Match`. A different name then moves the project in its ' +
      "folder and keeps the caller's pin. Only a project in the caller's own bucket can be saved. " +
      'Every domain rejection carries a ProjectCreateErrorCode.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiHeader(IF_MATCH_HEADER_DOC)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'The project was saved, and moved when renamed',
    type: UpdateProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid id, name, file names, file type or file count, or unknown-file / duplicate-file-name',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: OWNER_ONLY_FORBIDDEN })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  @ApiResponse({
    status: 409,
    description:
      'The project changed since it was read, or a rename could not complete after the content was saved under the old name (project-changed); or the new name is taken (name-taken)',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({
    status: 413,
    description:
      'A file or the context in total is too large (file-too-large, capacity-exceeded), or the project or its stored PROJECT.md exceeds the read limit (project-too-large)',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({
    status: 428,
    description:
      'If-Match is missing, `*` or a list of tags (if-match-required)',
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
  updateProject(
    @Param() { id }: ProjectIdParamDto,
    @UploadedFiles() files: UploadedContextFile[] | undefined,
    @Body() body: UpdateProjectDto,
    @Req() req: Request,
  ): Promise<UpdateProjectResponseDto> {
    const { at, bucket } = req.user as SessionUser;
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    return this.updateService.updateProject(
      requireProjectId(id),
      body,
      files ?? [],
      ifMatch,
      bucket,
      at,
      abortOnClose(req),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    operationId: 'deleteProject',
    summary: 'Delete a project',
    description:
      'Deletes the project only if it is still the version named by `If-Match`, then removes it from ' +
      "the caller's pins. Only a project in the caller's own bucket can be deleted.",
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiHeader(IF_MATCH_HEADER_DOC)
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'The project was deleted' })
  @ApiResponse({ status: 400, description: 'The project id is invalid' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: OWNER_ONLY_FORBIDDEN })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  @ApiResponse({
    status: 409,
    description: 'The project changed since it was read (project-changed)',
    type: ProjectCreateErrorDto,
  })
  @ApiResponse({
    status: 428,
    description:
      'If-Match is missing, `*` or a list of tags (if-match-required)',
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
  deleteProject(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    const ifMatch = req.headers[IF_MATCH_HEADER] as string | undefined;
    return this.projectsService.deleteProject(id, ifMatch, bucket, at);
  }

  @Get(':id/archive')
  @ApiProduces('application/zip')
  @ApiOperation({
    operationId: 'downloadProject',
    summary: 'Download a project as a ZIP archive',
    description:
      "Streams DIAL Core's archive of the whole project (`PROJECT.md` and `context/`) as an attachment.",
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Streamed application/zip archive',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 400, description: 'The project id is invalid' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The projectsEnabled feature is not enabled for this user, or DIAL Core denied access',
  })
  @ApiResponse({ status: 404, description: 'The project does not exist' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  async downloadProject(
    @Param() { id }: ProjectIdParamDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    await this.streamDownload(res, () =>
      this.downloadService.downloadProject(requireProjectId(id), at, bucket),
    );
  }

  @Get(':id/files/:fileName')
  @ApiProduces('application/octet-stream')
  @ApiOperation({
    operationId: 'downloadProjectFile',
    summary: 'Download one context file of a project',
    description:
      'Streams one file directly under the project `context/` folder as an attachment with `X-Content-Type-Options: nosniff`.',
  })
  @ApiParam(PROJECT_ID_PARAM)
  @ApiParam({
    name: 'fileName',
    description: 'Name of a file directly under the project `context/` folder.',
    example: 'tickets.csv',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Streamed file content',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({
    status: 400,
    description: 'The project id or the file name is invalid',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The projectsEnabled feature is not enabled for this user, or DIAL Core denied access',
  })
  @ApiResponse({
    status: 404,
    description: 'The project or the file does not exist',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  async downloadProjectFile(
    @Param() { id, fileName }: ProjectFileParamDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { at, bucket } = req.user as SessionUser;
    await this.streamDownload(res, () =>
      this.downloadService.downloadContextFile(
        requireProjectId(id),
        fileName,
        at,
        bucket,
      ),
    );
  }

  /*
   * Pipes a Core download to the client, as `SkillsController.downloadSkill`
   * does. The 'close' listener is registered before the await so a
   * disconnect while Core is still answering is not missed.
   */
  private async streamDownload(
    res: Response,
    start: () => Promise<ProjectDownload>,
  ): Promise<void> {
    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    const { stream, headers, abortOnDisconnect } = await start();
    if (clientDisconnected) {
      abortOnDisconnect();
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    res.on('close', () => {
      if (!res.writableEnded) abortOnDisconnect();
    });

    await pipeline(Readable.fromWeb(stream as ReadableStream), res).catch(
      () => {
        res.destroy();
      },
    );
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
    return this.projectsService.createProject(
      bucket,
      body,
      files ?? [],
      at,
      abortOnClose(req),
    );
  }
}
