import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { DeploymentLimitsResponseDto } from '../openapi/openapi-response.dto';
import { DeploymentsService } from './deployments.service';
import { DeploymentConfigurationDto } from './dto/deployment-configuration.dto';
import { DeploymentDetailsDto } from './dto/deployment-details.dto';
import { DeploymentsResponseDto } from './dto/deployment-item.dto';
import { DeploymentsQueryDto } from './dto/deployments-query.dto';

@ApiTags('deployments')
@Controller({ path: 'deployments', version: '1' })
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'listDeployments',
    summary: 'List deployments by interface type',
  })
  @ApiQuery({
    name: 'interface_type',
    required: false,
    isArray: true,
    enum: ['chat', 'embedding', 'mcp', 'custom_ui', 'all'],
    description: 'Filter by interface type (repeatable)',
    example: ['chat', 'mcp'],
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: Boolean,
    description:
      'Bypass the short server-side deployments list cache and refresh from DIAL Core',
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
  listDeployments(
    @Query() query: DeploymentsQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sub, at, bucket } = req.user as SessionUser;
    res.setHeader(
      'Cache-Control',
      query.refresh ? 'private, no-store' : 'private, max-age=30',
    );
    return this.deploymentsService.listDeployments(
      sub,
      at,
      bucket,
      query.interface_type,
      query.refresh,
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

  @Get(':deployment/limits')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getDeploymentLimits',
    summary: 'Get deployment usage limits',
    description:
      'Returns spent/limit statistics for a single deployment. ' +
      "Proxies GET /v1/deployments/{deployment_name}/limits using the caller's session access token. " +
      'Not cached — every request hits DIAL Core for real-time usage data.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved deployment limits',
    type: DeploymentLimitsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to access deployment limits',
  })
  @ApiResponse({
    status: 404,
    description: 'Deployment limits not found',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getDeploymentLimits(
    @Req() req: Request,
    @Param('deployment') deployment: string,
  ) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getDeploymentLimits(deployment, at);
  }

  @Get(':deployment/details')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'getDeploymentDetails',
    summary: 'Get full details for a single deployment',
    description:
      'Fetches the full per-entity payload for a model, application, or toolset by id ' +
      "(dispatching to DIAL Core's getModel/getApplication/getToolset based on the " +
      'resolved deployment type) and maps it into a frontend-safe DeploymentDetailsDto. ' +
      'Results are cached server-side for 60 seconds per user; the response ' +
      'carries no client-facing Cache-Control so a browser never serves a ' +
      "stale copy of another user's cache window or of credentials that " +
      'changed since the last fetch.',
  })
  @ApiResponse({ status: 200, type: DeploymentDetailsDto })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getDeploymentDetails(
    @Req() req: Request,
    @Param('deployment') deployment: string,
  ) {
    const { sub, at } = req.user as SessionUser;
    return this.deploymentsService.getDeploymentDetails(sub, deployment, at);
  }
}
