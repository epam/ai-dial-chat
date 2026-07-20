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
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApplicationsService } from './applications.service';
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
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    operationId: 'listApplications',
    summary: 'List available applications',
    description:
      'Returns the list of DIAL Core applications visible to the authenticated session user. ' +
      "Proxies GET /openai/applications using the caller's session access token. " +
      'Results are cached server-side for 30 seconds per user.',
  })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createApplication',
    summary: 'Create a new application',
    description:
      'Creates a new application for the authenticated session user by proxying DIAL Core. ' +
      'Invalidates the applications list cache on success.',
  })
  @ApiBody({ type: CreateApplicationBodyDto })
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
  @ApiResponse({ status: 409, description: 'Application name already taken' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'updateApplication',
    summary: 'Update an application',
    description:
      'Updates the General-step fields (name, description, iconUrl, topics, intro) of an ' +
      "existing application for the authenticated session user, by proxying DIAL Core. " +
      "Settings-step configuration (application_properties, version) is preserved untouched. " +
      'Invalidates the applications and deployments list caches on success.',
  })
  @ApiBody({ type: UpdateApplicationBodyDto })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'deleteApplication',
    summary: 'Delete an application',
    description:
      'Deletes an application for the authenticated session user by proxying DIAL Core. ' +
      'Invalidates the applications list cache on success.',
  })
  @ApiResponse({ status: 204, description: 'Application deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid application name' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
