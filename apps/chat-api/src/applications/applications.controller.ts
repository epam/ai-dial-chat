import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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
}
