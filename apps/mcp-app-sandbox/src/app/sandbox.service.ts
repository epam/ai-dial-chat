import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';
import { SANDBOX_CSP_HEADER } from './csp';
import { buildSandboxPageHtml } from './sandbox-page';

@Injectable()
export class SandboxService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /**
   * Returns the request's `Referer` origin if it matches the configured
   * allowlist, `null` otherwise (missing header, unparseable, or unlisted).
   * An unconfigured allowlist means every request is rejected — there is no
   * insecure "allow all" default.
   */
  validateRefererOrigin(referer: string | undefined): string | null {
    if (!referer) return null;

    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      return null;
    }

    const allowedOrigins =
      this.configService.get('MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS', {
        infer: true,
      }) ?? [];

    return allowedOrigins.includes(refererOrigin) ? refererOrigin : null;
  }

  buildResponse(validatedHostOrigin: string): {
    html: string;
    cspHeader: string;
  } {
    return {
      html: buildSandboxPageHtml(validatedHostOrigin),
      cspHeader: SANDBOX_CSP_HEADER,
    };
  }
}
