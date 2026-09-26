import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  AUTH_OUTCOME_ATTRIBUTE,
  AUTH_PROVIDER_ATTRIBUTE,
  AuthRefreshOutcome,
  authRefreshCoalesced,
  authRefreshDuration,
  elapsedSeconds,
  resolveAuthProvider,
} from '../auth-metrics';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import {
  getSessionCookieMaxAge,
  resolveRefreshTokenExpiry,
  SessionExpiredDuringRefreshException,
} from '../session/session-expiration';
import type { SessionPayload } from '../session/session.types';

export interface SessionRefreshResult {
  payload: SessionPayload;
  /** False for an absorbed race: callers must not overwrite the winning cookie. */
  refreshed: boolean;
}

@Injectable()
export class RefreshService {
  private readonly logger = new Logger(RefreshService.name);
  // Per-pod mutex: sid → in-flight refresh promise (prevents concurrent RT exchange)
  private readonly inFlight = new Map<string, Promise<SessionRefreshResult>>();

  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async refresh(payload: SessionPayload): Promise<SessionRefreshResult> {
    getSessionCookieMaxAge(payload);
    if (!payload.rt) {
      throw new UnauthorizedException('No refresh token');
    }
    const existing = this.inFlight.get(payload.sid);
    if (existing) {
      /*
       * This caller performs no token exchange of its own, so it contributes no duration
       * observation — counting it here keeps `authRefreshDuration`'s count equal to the
       * number of exchanges actually made against the identity provider, while the work
       * the mutex saved stays visible.
       */
      authRefreshCoalesced.add(1, {
        [AUTH_PROVIDER_ATTRIBUTE]: resolveAuthProvider(payload.providerId),
      });
      return existing;
    }

    const promise = this.doRefresh(payload).finally(() => {
      this.inFlight.delete(payload.sid);
    });

    this.inFlight.set(payload.sid, promise);
    return promise;
  }

  private async doRefresh(
    payload: SessionPayload,
  ): Promise<SessionRefreshResult> {
    const startedAt = process.hrtime.bigint();
    /*
     * One terminal observation per real exchange. `record` is called on every exit path,
     * including every failure branch, so an identity-provider outage and a genuinely
     * dead session stay distinguishable instead of both reading as "refresh missing".
     */
    const record = (outcome: AuthRefreshOutcome): void => {
      const durationSeconds = elapsedSeconds(startedAt);
      authRefreshDuration.record(durationSeconds, {
        [AUTH_PROVIDER_ATTRIBUTE]: resolveAuthProvider(payload.providerId),
        [AUTH_OUTCOME_ATTRIBUTE]: outcome,
      });
    };

    let client: ReturnType<ProviderRegistryService['getProvider']>['client'];
    try {
      ({ client } = this.registry.getProvider(payload.providerId));
    } catch (err) {
      record(AuthRefreshOutcome.UpstreamError);
      throw err;
    }

    const exchangeStartedAt = Math.floor(Date.now() / 1000);
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
        try {
          getSessionCookieMaxAge(payload, now);
        } catch (expired) {
          record(AuthRefreshOutcome.InvalidGrant);
          throw expired;
        }
        if (payload.at_exp > now) {
          record(AuthRefreshOutcome.RaceAbsorbed);
          return { payload, refreshed: false };
        }
        record(AuthRefreshOutcome.InvalidGrant);
        throw new UnauthorizedException('Refresh token expired or revoked');
      }
      /* Provider error messages can contain tokens or request bodies. */
      this.logger.error(
        JSON.stringify({
          event: 'auth.refresh.failed',
          sessionId: payload.sid,
          providerId: payload.providerId,
          outcome: AuthRefreshOutcome.UpstreamError,
        }),
      );
      record(AuthRefreshOutcome.UpstreamError);
      throw new UnauthorizedException('Token refresh failed');
    }

    const now = Math.floor(Date.now() / 1000);
    const newRt = tokenSet.refresh_token;

    const refreshed: SessionPayload = {
      ...payload,
      at: tokenSet.access_token ?? payload.at,
      at_exp: tokenSet.expires_at ?? now + 3600,
      rt: newRt ?? payload.rt,
      rt_exp: resolveRefreshTokenExpiry(
        payload.providerId,
        tokenSet,
        exchangeStartedAt,
        payload,
      ),
      iat: now,
    };
    /*
     * Validate the existing deadline before renewal; an expired session cannot revive.
     * A slow exchange can land past the deadline, so this outcome is recorded before
     * `Refreshed`: the tokens are new but unusable, and the call throws.
     */
    try {
      getSessionCookieMaxAge(refreshed, now);
    } catch {
      record(AuthRefreshOutcome.SessionExpired);
      /*
       * The exchange itself succeeded — this session was valid when the
       * request started. Surfacing the underlying InvalidSessionException
       * here would make the caller clear the cookie, forcing a hard logout
       * for what is really just a slow round-trip.
       */
      throw new SessionExpiredDuringRefreshException('Session expired');
    }
    record(AuthRefreshOutcome.Refreshed);
    const renewed: SessionPayload = {
      ...refreshed,
      session_exp:
        now + this.config.get('AUTH_SESSION_MAX_AGE_SECONDS', { infer: true }),
    };
    return {
      payload: renewed,
      refreshed: true,
    };
  }
}
