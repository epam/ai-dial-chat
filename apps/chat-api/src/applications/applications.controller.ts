import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import {
  ListResourceFoldersQueryDto,
  MoveResourceDto,
  ResourceFoldersResponseDto,
  ResourceIdResponseDto,
} from '../common/dto/resource-folder.dto';
import { ResourceNameConflictDto } from '../common/dto/resource-name-conflict.dto';
import { ApplicationsService } from './applications.service';
import {
  CommitApplicationVersionDto,
  ForkApplicationVersionDto,
} from './dto/application-version.dto';
import { ApplicationsResponseDto } from './dto/application.dto';
import {
  CreateApplicationBodyDto,
  CreatedApplicationDto,
} from './dto/create-application.dto';
import { GetApplicationDto } from './dto/get-application.dto';
import {
  UpdateApplicationBodyDto,
  UpdatedApplicationDto,
} from './dto/update-application.dto';

@ApiTags('applications')
@Controller({ path: 'applications', version: '1' })
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    operationId: 'listApplications',
    summary: 'List available applications',
    description:
      'Returns the list of DIAL Core applications visible to the authenticated session user. ' +
      "Proxies GET /openai/applications using the caller's session access token. " +
      'Results are cached server-side for 30 seconds per user.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved application list',
    type: ApplicationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to list applications',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listApplications(@Req() req: Request) {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.listApplications(sub, at);
  }

  @Get('folders')
  @ApiOperation({
    operationId: 'listApplicationFolders',
    summary: "List the caller's application folders",
    description:
      "Lists the folders directly under `path` in the caller's own applications bucket. " +
      'A folder that does not exist yet lists as empty. Not cached.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Folders under the requested path',
    type: ResourceFoldersResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid folder path' })
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
  listApplicationFolders(
    @Req() req: Request,
    @Query() query: ListResourceFoldersQueryDto,
  ): Promise<ResourceFoldersResponseDto> {
    const { at } = req.user as SessionUser;
    return this.applicationsService.listApplicationFolders(
      at,
      query.path ?? '',
    );
  }

  @Post(':applicationName/move')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'moveApplication',
    summary: "Move an application to one of the caller's folders",
    description:
      "Moves an application in the caller's own bucket into `folderPath`, never overwriting an existing application. " +
      'Invalidates the applications, deployments and details caches on success.',
  })
  @ApiBody({ type: MoveResourceDto })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Application moved; the response carries its new id',
    type: ResourceIdResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid application name or folder path',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: "The application is not in the caller's own bucket",
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({
    status: 409,
    description:
      'The target folder already holds an own application with the same displayed name and version (`code` `name-taken-agent` or `name-taken-toolset`), or an application with the same leaf',
    type: ResourceNameConflictDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  moveApplication(
    @Req() req: Request,
    @Param() params: GetApplicationDto,
    @Body() body: MoveResourceDto,
  ): Promise<ResourceIdResponseDto> {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.moveApplication(
      sub,
      at,
      params.applicationName,
      body.folderPath,
    );
  }

  @Post(':applicationName/versions')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'forkApplicationVersion',
    summary: 'Fork an application into a new version',
    description:
      'Copies the stored application to `{folderPath}/{name}__{version}` and stamps the copy with `version`, never overwriting. ' +
      'Used with commitApplicationVersion so edits saved to the source end up in the new version only.',
  })
  @ApiBody({ type: ForkApplicationVersionDto })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 201,
    description: 'Snapshot created; the response carries its id',
    type: ResourceIdResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid application name, version or folder path',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: "The application is not in the caller's own bucket",
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({
    status: 409,
    description:
      'The version already exists in the folder (path conflict, no `code`), or another own entity in the folder already has this name and version (`code` `name-taken-agent` or `name-taken-toolset`)',
    type: ResourceNameConflictDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  forkApplicationVersion(
    @Req() req: Request,
    @Param() params: GetApplicationDto,
    @Body() body: ForkApplicationVersionDto,
  ): Promise<ResourceIdResponseDto> {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.forkApplicationVersion(
      sub,
      at,
      params.applicationName,
      body,
    );
  }

  @Post(':applicationName/versions/commit')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'commitApplicationVersion',
    summary: 'Commit a forked application version',
    description:
      'Swaps the bodies of the source application and its forked snapshot, each keeping its own version: ' +
      'the source gets back its pre-edit body and the snapshot gets the edits. ' +
      'Both writes are conditional on the ETags read in the same request.',
  })
  @ApiBody({ type: CommitApplicationVersionDto })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: "Committed; the response carries the new version's id",
    type: ResourceIdResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid application name or snapshot id',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: "The source or the snapshot is not in the caller's own bucket",
  })
  @ApiResponse({ status: 404, description: 'Source or snapshot not found' })
  @ApiResponse({
    status: 409,
    description: 'The source or the snapshot changed while committing',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  commitApplicationVersion(
    @Req() req: Request,
    @Param() params: GetApplicationDto,
    @Body() body: CommitApplicationVersionDto,
  ): Promise<ResourceIdResponseDto> {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.commitApplicationVersion(
      sub,
      at,
      params.applicationName,
      body,
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createApplication',
    summary: 'Create a new application',
    description:
      'Creates a new application for the authenticated session user by proxying DIAL Core. ' +
      'With createOnly, never overwrites an existing application and creates at the next free path instead (409 when none is free). ' +
      'With preserveApplicationProperties, stores schema settings verbatim. ' +
      'Invalidates the applications list and deployments list caches on success.',
  })
  @ApiBody({ type: CreateApplicationBodyDto })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 201,
    description: 'Application created successfully',
    type: CreatedApplicationDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or invalid fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission to create applications in their bucket',
  })
  @ApiResponse({
    status: 409,
    description:
      'Another own entity in the folder and catalog tab already has this name and version (`code` `name-taken-agent` or `name-taken-toolset`), or, without a `code`, every candidate storage path is taken',
    type: ResourceNameConflictDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response or an empty bucket',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  createApplication(
    @Req() req: Request,
    @Body() body: CreateApplicationBodyDto,
  ): Promise<CreatedApplicationDto> {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.createApplication(sub, at, body);
  }

  @Patch(':applicationName')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'updateApplication',
    summary: 'Update an application',
    description:
      'Updates the General-step fields (name, description, iconUrl, topics) of an ' +
      'existing application for the authenticated session user, by proxying DIAL Core. ' +
      'Settings-step configuration (application_properties) is preserved untouched unless ' +
      'the request supplies applicationProperties, in which case it fully replaces the ' +
      'stored value. Invalidates the applications and deployments list caches on success.',
  })
  @ApiBody({ type: UpdateApplicationBodyDto })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: UpdatedApplicationDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid application name or body fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({
    status: 409,
    description:
      'The new name and version are already held by another own entity in the same folder and catalog tab (`code` `name-taken-agent` or `name-taken-toolset`)',
    type: ResourceNameConflictDto,
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  updateApplication(
    @Req() req: Request,
    @Param() params: GetApplicationDto,
    @Body() body: UpdateApplicationBodyDto,
  ): Promise<UpdatedApplicationDto> {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.updateApplication(
      sub,
      at,
      params.applicationName,
      body,
    );
  }

  @Delete(':applicationName')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteApplication',
    summary: 'Delete an application',
    description:
      'Deletes an application for the authenticated session user by proxying DIAL Core. ' +
      'Invalidates the applications list cache on success.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Application deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid application name' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  deleteApplication(
    @Req() req: Request,
    @Param() params: GetApplicationDto,
  ): Promise<void> {
    const { sub, at } = req.user as SessionUser;
    return this.applicationsService.deleteApplication(
      sub,
      at,
      params.applicationName,
    );
  }
}
