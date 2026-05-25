import { Controller, Get, Header, Param, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { DialDeploymentDto } from '../openapi/openapi-response.dto';
import { DeploymentsService } from './deployments.service';

@ApiTags('deployments')
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  @Header('Deprecation', 'true')
  @ApiOperation({
    summary: 'List all available deployments',
    deprecated: true,
    description:
      'Deprecated — use GET /api/v1/catalog instead. This endpoint is retained for backward compatibility only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of deployment objects from DIAL Core',
    type: [DialDeploymentDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  getDeployments(@Req() req: Request) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getDeployments(at);
  }

  @Get(':deployment')
  @Header('Deprecation', 'true')
  @ApiOperation({
    summary: 'Get a single deployment by name',
    deprecated: true,
    description:
      'Deprecated — use GET /api/v1/catalog instead. This endpoint is retained for backward compatibility only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deployment object',
    type: DialDeploymentDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  getDeployment(@Req() req: Request, @Param('deployment') deployment: string) {
    const { at } = req.user as SessionUser;
    return this.deploymentsService.getDeployment(deployment, at);
  }
}
