import { Controller, Get, Header, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { DeploymentsService } from './deployments.service';
import { DeploymentConfigurationDto } from './dto/deployment-configuration.dto';
import { DeploymentsResponseDto } from './dto/deployment-item.dto';
import { DeploymentsQueryDto } from './dto/deployments-query.dto';

@ApiTags('deployments')
@Controller({ path: 'deployments', version: '1' })
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    operationId: 'listDeployments',
    summary: 'List deployments by interface type',
  })
  @ApiQuery({
    name: 'interface_type',
    required: false,
    isArray: true,
    enum: ['chat', 'embeddings', 'mcp', 'custom_ui', 'all'],
    description: 'Filter by interface type (repeatable)',
    example: ['chat', 'mcp'],
  })
  @ApiResponse({ status: 200, type: DeploymentsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listDeployments(@Query() query: DeploymentsQueryDto, @Req() req: Request) {
    const { sub, at, bucket } = req.user as SessionUser;
    return this.deploymentsService.listDeployments(
      sub,
      at,
      bucket,
      query.interface_type,
    );
  }

  @Get(':deployment/configuration')
  @ApiOperation({
    summary: 'Get JSON Schema configuration for a deployment',
    description:
      'Returns the JSON Schema of configuration supported by the deployment. ' +
      'Only available for deployments whose `features.configuration` flag is `true`. ' +
      'Results are cached server-side for 60 seconds per user.',
  })
  @ApiResponse({ status: 200, type: DeploymentConfigurationDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Deployment does not support configuration',
  })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  getDeploymentConfiguration(
    @Req() req: Request,
    @Param('deployment') deployment: string,
  ) {
    const { at, sub } = req.user as SessionUser;
    return this.deploymentsService.getDeploymentConfiguration(
      deployment,
      sub,
      at,
    );
  }
}
