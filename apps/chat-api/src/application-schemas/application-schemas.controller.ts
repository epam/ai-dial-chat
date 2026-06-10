import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApplicationSchemasService } from './application-schemas.service';
import {
  ApplicationSchemasResponseDto,
  GetApplicationSchemaDto,
} from './dto/application-schema.dto';

@ApiTags('applications')
@Controller({ path: 'application-schemas', version: '1' })
export class ApplicationSchemasController {
  constructor(
    private readonly applicationSchemasService: ApplicationSchemasService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'listApplicationSchemas',
    summary: 'List application type schemas',
    description:
      'Returns DIAL Core application type schemas visible to the authenticated user. ' +
      'Results are cached server-side for 60 seconds per user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved schema list',
    type: ApplicationSchemasResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to list application schemas',
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
  listApplicationSchemas(@Req() req: Request) {
    const { sub, at } = req.user as SessionUser;
    return this.applicationSchemasService.listApplicationSchemas(sub, at);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'getApplicationSchema',
    summary: 'Get application type schema by id',
    description:
      'Returns one DIAL Core application type schema by its $id. ' +
      'Results are cached server-side for 60 seconds per user per schema.',
  })
  @ApiParam({
    name: 'id',
    description: 'Schema $id (URL-encoded)',
    example: 'https://example.com/schemas/quick-app',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved schema',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiResponse({ status: 400, description: 'Invalid or empty id' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to access this schema',
  })
  @ApiResponse({ status: 404, description: 'Schema not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getApplicationSchema(
    @Req() req: Request,
    @Param() params: GetApplicationSchemaDto,
  ) {
    const { sub, at } = req.user as SessionUser;
    return this.applicationSchemasService.getApplicationSchema(
      sub,
      at,
      params.id,
    );
  }
}
