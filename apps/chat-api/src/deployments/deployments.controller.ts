import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeploymentsService } from './deployments.service';

@ApiTags('deployments')
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available deployments' })
  @ApiResponse({
    status: 200,
    description: 'Array of deployment objects from DIAL Core',
  })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  getDeployments() {
    return this.deploymentsService.getDeployments();
  }

  @Get(':deployment')
  @ApiOperation({ summary: 'Get a single deployment by name' })
  @ApiResponse({ status: 200, description: 'Deployment object' })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({
    status: 502,
    description: 'Unexpected response from DIAL Core',
  })
  getDeployment(@Param('deployment') deployment: string) {
    return this.deploymentsService.getDeployment(deployment);
  }
}
