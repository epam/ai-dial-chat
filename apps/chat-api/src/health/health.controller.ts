import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { resolveFrontendRootPath } from '../app/static-assets';
import { Public } from '../common/decorators/public.decorator';

const computeBuildId = (): string => {
  try {
    const indexHtmlPath = join(resolveFrontendRootPath(), 'index.html');
    const contents = readFileSync(indexHtmlPath);
    return createHash('sha256').update(contents).digest('hex').slice(0, 12);
  } catch {
    /* No built frontend on disk (e.g. local dev without a build). Falls back to a
     * per-process value so a single running instance still reports one stable id;
     * this path never runs against a real deployment, which always serves a built dist. */
    return `dev-${Date.now()}`;
  }
};

/* Computed once when this module loads (i.e. once per process). Hashing the
 * built frontend's index.html — rather than requiring a dedicated deploy-time
 * env var — means every pod serving the same deployed image reports the same
 * value, and the value changes exactly when a new frontend build is deployed. */
const BUILD_ID = computeBuildId();

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
   * @returns An object containing the status, current timestamp, application version, and build identifier
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
        buildId: {
          type: 'string',
          example: '3f9a1c2b8e7d',
          description:
            'Stable identifier for the running deployment, derived from a hash of the served frontend build. Changes when a new deployment replaces the frontend static assets, letting long-lived clients detect that a reload will pick up a newer build.',
        },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      buildId: BUILD_ID,
    };
  }
}
