import {
  All,
  BadRequestException,
  Controller,
  GatewayTimeoutException,
  Logger,
  MethodNotAllowedException,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';

const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'DELETE',
]);
const TIMEOUT_MS = 60_000;
/** Response headers worth relaying; everything else is the BFF's own. */
const RELAYED_HEADERS = ['content-type'] as const;

const hasDotSegment = (value: string): boolean =>
  value.split('/').some((segment) => segment === '.' || segment === '..');

const encodePath = (value: string): string =>
  value.split('/').map(encodeURIComponent).join('/');

/**
 * TEMPORARY, to try a Core application route from the browser: forwards
 * `/api/v1/deployment-route/{deploymentId}/{path}` to DIAL Core's
 * `/v1/deployments/{deploymentId}/route/{path}` with the caller's own access
 * token, and relays Core's status and JSON body unchanged. The deployment ID
 * may contain slashes (`applications/public/name__1.0.0`), so the client sends
 * it URL-encoded as one segment. Core stays the authority for route
 * permissions and rate limits.
 */
@Controller({ path: 'deployment-route', version: '1' })
export class DeploymentRouteController {
  private readonly logger = new Logger(DeploymentRouteController.name);

  constructor(private readonly dialClient: DialClientService) {}

  @All(':id/*path')
  @ApiExcludeEndpoint()
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!ALLOWED_METHODS.has(req.method)) {
      throw new MethodNotAllowedException();
    }
    const { id, path } = req.params as { id: string; path: string[] | string };
    const routePath = Array.isArray(path) ? path.join('/') : path;
    if (!id || !routePath || hasDotSegment(id) || hasDotSegment(routePath)) {
      throw new BadRequestException('Invalid deployment route');
    }

    const query = req.url.includes('?')
      ? req.url.slice(req.url.indexOf('?'))
      : '';
    const destination = `${this.dialClient.baseUrl.replace(/\/+$/, '')}/v1/deployments/${encodePath(id)}/route/${encodePath(routePath)}${query}`;
    const user = req.user as SessionUser;
    const hasBody =
      req.method !== 'GET' &&
      req.body != null &&
      typeof req.body === 'object' &&
      Object.keys(req.body as object).length > 0;

    let upstream: globalThis.Response;
    try {
      upstream = await this.dialClient.fetchCore(destination, {
        method: req.method,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...getBearerAuthHeaders(user.at),
        },
        ...(hasBody ? { body: JSON.stringify(req.body) } : {}),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('DIAL Core request timed out');
      }
      this.logger.error(
        `Route call failed: ${req.method} ${id}/${routePath}`,
        (error as Error)?.stack,
      );
      throw new ServiceUnavailableException(
        'DIAL Core is currently unavailable',
      );
    }

    res.status(upstream.status);
    for (const name of RELAYED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }
}
