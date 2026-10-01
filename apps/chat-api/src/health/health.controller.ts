import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { resolveFrontendRootPath } from '../app/static-assets';
import { Public } from '../common/decorators/public.decorator';
import { resolveAppVersion } from '../common/utils/app-version';
import type { EnvironmentVariables } from '../config/environment.config';

const hashBuildInput = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex').slice(0, 12);

const readFrontendIndexHtml = (): Buffer =>
  readFileSync(join(resolveFrontendRootPath(), 'index.html'));

/**
 * Stable identifier for the running deployment, computed once per process.
 *
 * Hashing the built frontend's index.html — rather than requiring a dedicated
 * deploy-time env var — means every pod serving the same deployed image reports
 * the same value, and the value changes exactly when a new frontend build is
 * deployed. Without a bundled frontend (the BFF-only ai-dial-chat-bff image, or
 * local dev running only chat-api) it falls back to a hash of the resolved app
 * version, so a BFF-only deployment still reports a new value per release.
 */
export const computeBuildId = (
  appVersion: string,
  readIndexHtml: () => Buffer = readFrontendIndexHtml,
): string => {
  try {
    return hashBuildInput(readIndexHtml());
  } catch {
    return hashBuildInput(appVersion);
  }
};

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
  /* Env is fixed for the process lifetime, so the version is resolved once at
   * construction rather than per request. */
  private readonly appVersion: string;

  private readonly buildId: string;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.appVersion = resolveAppVersion(
      this.config.get('CHAT_VERSION', { infer: true }),
    );
    this.buildId = computeBuildId(this.appVersion);
  }

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
          description:
            'Application version. Sourced from CHAT_VERSION; falls back to the workspace root package.json version — the one the release pipeline stamps — when that env var is unset or blank. Matches the appVersion reported by the client config endpoint.',
        },
        buildId: {
          type: 'string',
          example: '3f9a1c2b8e7d',
          description:
            'Stable identifier for the running deployment, derived from a hash of the served frontend build, or of the application version when no frontend is bundled (BFF-only image). Changes when a new deployment replaces the frontend static assets or the version, letting long-lived clients detect that a reload will pick up a newer build.',
        },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: this.appVersion,
      buildId: this.buildId,
    };
  }
}
