import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

/**
 * Health check controller.
 *
 * Provides a simple endpoint to verify that the application is running.
 * Useful for load balancers, monitoring systems, and deployment health checks.
 */
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Returns the application health status.
   *
   * @returns An object containing the status, current timestamp, and application version
   */
  @Get()
  @ApiOperation({
    summary: 'Check application health status',
    description:
      'Returns a simple health check response indicating the application is running. ' +
      'Use this endpoint for load balancer health checks, monitoring, and deployment verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy and responding',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok', description: 'Health status' },
        timestamp: {
          type: 'string',
          example: '2026-05-07T20:00:00.000Z',
          description: 'Current server time in ISO format',
        },
        version: {
          type: 'string',
          example: '1.0.0',
          description: 'Application version',
        },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
