import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import type { SessionPayload } from '../session/session.types';

@Injectable()
export class RefreshService {
  private readonly logger = new Logger(RefreshService.name);
  // Per-pod mutex: sid → in-flight refresh promise (prevents concurrent RT exchange)
  private readonly inFlight = new Map<string, Promise<SessionPayload>>();

  constructor(private readonly registry: ProviderRegistryService) {}

  refresh(payload: SessionPayload): Promise<SessionPayload> {
    const existing = this.inFlight.get(payload.sid);
    if (existing) {
      return existing;
    }

    const promise = this.doRefresh(payload).finally(() => {
      this.inFlight.delete(payload.sid);
    });

    this.inFlight.set(payload.sid, promise);
    return promise;
  }

  private async doRefresh(payload: SessionPayload): Promise<SessionPayload> {
    const { client } = this.registry.getProvider(payload.providerId);

    let tokenSet: Awaited<ReturnType<typeof client.refresh>>;
    try {
      tokenSet = await client.refresh(payload.rt);
    } catch (err: unknown) {
      const oidcErr = err as { error?: string };
      if (oidcErr?.error === 'invalid_grant') {
        /*
         * A rotated refresh token that another pod (or another near-
         * simultaneous request) already exchanged a moment ago also surfaces
         * as invalid_grant here — there's no shared state to tell the two
         * apart directly. But if this payload's access token hasn't actually
         * expired yet, the session is still good; this pod just lost a race
         * it didn't need to enter. Absorb it and let the next request pick
         * up whichever cookie the browser currently holds instead of forcing
         * a false logout.
         */
        const now = Math.floor(Date.now() / 1000);
        if (payload.at_exp > now) {
          this.logger.log(
            `Absorbed a lost refresh-token race for sid ${payload.sid}; access token is still valid`,
          );
          return payload;
        }
        throw new UnauthorizedException('Refresh token expired or revoked');
      }
      this.logger.error(
        'Token refresh failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw new UnauthorizedException('Token refresh failed');
    }

    const now = Math.floor(Date.now() / 1000);
    const newRt = tokenSet.refresh_token;

    return {
      ...payload,
      at: tokenSet.access_token ?? payload.at,
      at_exp: tokenSet.expires_at ?? now + 3600,
      rt: newRt ?? payload.rt,
      iat: now,
    };
  }
}
