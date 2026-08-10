import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment.config';
import { buildSandboxCspHeader } from './csp';
import { buildSandboxPageHtml } from './sandbox-page';

@Injectable()
export class SandboxService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /**
   * Returns the request's validated host origin if it matches the configured
   * allowlist, `null` otherwise (missing header, unparseable, or unlisted).
   * An unconfigured allowlist means every request is rejected — there is no
   * insecure "allow all" default. When the `Origin` header is present, it is
   * checked first and must itself be allowlisted — this closes a bypass
   * where a same-site request supplies a different, allowlisted `Referer`
   * while its actual `Origin` is not the legitimate chat host.
   */
  validateRefererOrigin(
    referer: string | undefined,
    origin: string | undefined,
  ): string | null {
    const allowedOrigins =
      this.configService.get('MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS', {
        infer: true,
      }) ?? [];

    if (origin) {
      return allowedOrigins.includes(origin) ? origin : null;
    }

    if (!referer) return null;

    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      return null;
    }

    return allowedOrigins.includes(refererOrigin) ? refererOrigin : null;
  }

  buildResponse(validatedHostOrigin: string): {
    html: string;
    cspHeader: string;
  } {
    const scriptNonce = randomBytes(16).toString('base64');
    return {
      html: buildSandboxPageHtml(validatedHostOrigin, scriptNonce),
      cspHeader: buildSandboxCspHeader(scriptNonce),
    };
  }
}
