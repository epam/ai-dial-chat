import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { metrics } from '@opentelemetry/api';
import {
  type DataPoint,
  type ExponentialHistogram,
  type Histogram,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type * as AuthMetricsModule from '../auth-metrics';
import { AuthSource } from '../auth-source.enum';
import type { AuthController as AuthControllerClass } from '../auth.controller';
import type { BucketService } from '../bucket/bucket.service';
import type { ProviderRegistryService } from '../providers/provider-registry.service';
import { AuthProviderId } from '../providers/provider.types';
import type { RefreshService as RefreshServiceClass } from '../refresh/refresh.service';
import { AuthErrorCode } from '../session/auth-error-code.enum';
import type { SessionGuard as SessionGuardClass } from '../session/session.guard';
import type { SessionService } from '../session/session.service';
import type { SessionPayload, SessionUser } from '../session/session.types';
import type { AuthStrategy } from '../strategies/auth-strategy.interface';

/*
 * `MetricData` (the element type of `ScopeMetrics.metrics[number].dataPoints`)
 * is a discriminated union, so `dataPoints` widens to a union of array types
 * that `Array.prototype.flatMap` cannot infer a single element type through.
 * This alias gives the traversal below an explicit, sound element type.
 */
type AuthDataPoint =
  DataPoint<number> | DataPoint<Histogram> | DataPoint<ExponentialHistogram>;

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* this reader owns no external resources */
  }
}

const PROVIDER = AuthProviderId.Keycloak;

const configStub = {
  get: (key: string) => {
    const values: Record<string, unknown> = {
      AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
      CORS_ORIGIN: 'http://localhost:4207',
      AUTH_COOKIE_SECURE: true,
      OVERLAY_ENABLED: false,
    };
    return values[key];
  },
} as unknown as ConfigService<EnvironmentVariables, true>;

const sessionPayload = (overrides: Partial<SessionPayload> = {}) =>
  ({
    v: 1,
    sid: 'sid-1',
    providerId: PROVIDER,
    sub: 'user-1',
    at: 'access-token',
    rt: 'refresh-token',
    at_exp: Math.floor(Date.now() / 1000) + 3600,
    rt_exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
    csrf: 'csrf-1',
    claims: {},
    bucket: 'bucket-1',
    ...overrides,
  }) as SessionPayload;

const responseStub = () =>
  ({
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    redirect: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  }) as unknown as Response;

/*
 * `auth-metrics` resolves its meter once at module scope, so the in-memory reader must be
 * registered as the global meter provider before that module — or anything importing it —
 * is loaded. Every module under test is therefore imported dynamically inside `beforeAll`.
 */
describe('auth and session metrics', () => {
  let reader: TestMetricReader;
  let authMetrics: typeof AuthMetricsModule;
  let AuthController: typeof AuthControllerClass;
  let RefreshService: typeof RefreshServiceClass;
  let SessionGuard: typeof SessionGuardClass;

  beforeAll(async () => {
    reader = new TestMetricReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));

    authMetrics = await import('../auth-metrics');
    ({ AuthController } = await import('../auth.controller'));
    ({ RefreshService } = await import('../refresh/refresh.service'));
    ({ SessionGuard } = await import('../session/session.guard'));
  });

  afterAll(() => {
    metrics.disable();
  });

  const collect = async (name: string) => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === name);
  };

  /* Data points accumulate across the whole file, so assertions select by attributes. */
  const pointFor = async (name: string, attributes: Record<string, string>) => {
    const metric = await collect(name);
    return metric?.dataPoints.find((point) =>
      Object.entries(attributes).every(
        ([key, value]) => point.attributes[key] === value,
      ),
    );
  };

  const buildController = (
    overrides: {
      registry?: Partial<ProviderRegistryService>;
      session?: Partial<SessionService>;
    } = {},
  ) =>
    new AuthController(
      (overrides.registry ?? {}) as ProviderRegistryService,
      (overrides.session ?? {}) as SessionService,
      configStub,
      {
        getUserBucket: vi.fn().mockResolvedValue({ bucket: 'bucket-1' }),
      } as unknown as BucketService,
    );

  const executionContext = (request: Request, response: Response) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => AuthController,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    }) as never;

  describe('instrument contracts', () => {
    it('declares the six auth instruments with their units and duration boundaries', async () => {
      authMetrics.authLoginStarted.add(0, {});
      authMetrics.authRefreshCoalesced.add(0, {});
      authMetrics.authAuthorization.add(0, {});
      authMetrics.authLogout.add(0, {});
      authMetrics.authCallbackDuration.record(0.05, {});
      authMetrics.authRefreshDuration.record(0.05, {});

      expect(
        (await collect('dial.chat.auth.login.started'))?.descriptor.unit,
      ).toBe('{operation}');
      expect(
        (await collect('dial.chat.auth.refresh.coalesced'))?.descriptor.unit,
      ).toBe('{request}');
      expect(
        (await collect('dial.chat.auth.authorization'))?.descriptor.unit,
      ).toBe('{request}');
      expect((await collect('dial.chat.auth.logout'))?.descriptor.unit).toBe(
        '{operation}',
      );

      for (const name of [
        'dial.chat.auth.callback.duration',
        'dial.chat.auth.refresh.duration',
      ]) {
        const metric = await collect(name);
        expect(metric?.descriptor.unit).toBe('s');
        const point = metric?.dataPoints[0] as DataPoint<Histogram>;
        expect(point.value.buckets.boundaries).toEqual(
          authMetrics.AUTH_DURATION_BOUNDARIES,
        );
      }
    });

    it('keeps the largest finite duration boundary at 60s so the dashboard guard matches the HTTP histogram', () => {
      expect(authMetrics.AUTH_DURATION_BOUNDARIES.at(-1)).toBe(60);
    });
  });

  describe('bounded label values', () => {
    it('passes through a provider id this build can construct', () => {
      expect(authMetrics.resolveAuthProvider(AuthProviderId.Auth0)).toBe(
        'auth0',
      );
    });

    it('collapses an unrecognized or absent provider id to unknown', () => {
      expect(authMetrics.resolveAuthProvider('../../etc/passwd')).toBe(
        'unknown',
      );
      expect(authMetrics.resolveAuthProvider(undefined)).toBe('unknown');
    });

    it('classifies callback failures by what failed, not by exception text', () => {
      const { classifyCallbackFailure, AuthCallbackOutcome } = authMetrics;
      expect(classifyCallbackFailure(new BadRequestException())).toBe(
        AuthCallbackOutcome.ValidationRejected,
      );
      expect(classifyCallbackFailure(new NotFoundException())).toBe(
        AuthCallbackOutcome.ValidationRejected,
      );
      expect(classifyCallbackFailure(new BadGatewayException())).toBe(
        AuthCallbackOutcome.ExchangeFailed,
      );
      expect(classifyCallbackFailure(new TypeError('boom'))).toBe(
        AuthCallbackOutcome.InternalError,
      );
    });

    it('maps each strategy AuthErrorCode to its own rejection reason', () => {
      const { classifyAuthorizationFailure, AuthAuthorizationReason } =
        authMetrics;
      const withCode = (code: AuthErrorCode) =>
        classifyAuthorizationFailure(new UnauthorizedException({ code }));

      expect(withCode(AuthErrorCode.HeaderTokenExpired)).toBe(
        AuthAuthorizationReason.TokenExpired,
      );
      expect(withCode(AuthErrorCode.HeaderTokenInvalid)).toBe(
        AuthAuthorizationReason.TokenInvalid,
      );
      expect(withCode(AuthErrorCode.HeaderTokenUntrustedIssuer)).toBe(
        AuthAuthorizationReason.UntrustedIssuer,
      );
      expect(withCode(AuthErrorCode.HeaderProviderNotFound)).toBe(
        AuthAuthorizationReason.ProviderNotFound,
      );
      expect(withCode(AuthErrorCode.HeaderMalformed)).toBe(
        AuthAuthorizationReason.Malformed,
      );
      expect(withCode(AuthErrorCode.NoCredentials)).toBe(
        AuthAuthorizationReason.NoCredentials,
      );
    });

    it('reads a bare UnauthorizedException as an invalid session and a bucket failure as its own reason', () => {
      const { classifyAuthorizationFailure, AuthAuthorizationReason } =
        authMetrics;
      expect(classifyAuthorizationFailure(new UnauthorizedException())).toBe(
        AuthAuthorizationReason.SessionInvalid,
      );
      expect(
        classifyAuthorizationFailure(new ServiceUnavailableException()),
      ).toBe(AuthAuthorizationReason.BucketUnavailable);
      expect(classifyAuthorizationFailure(new Error('boom'))).toBe(
        AuthAuthorizationReason.InternalError,
      );
    });
  });

  describe('login', () => {
    it('counts a login only once the redirect to the identity provider is issued', async () => {
      const controller = buildController({
        registry: {
          getProvider: vi.fn().mockReturnValue({
            client: {
              authorizationUrl: vi.fn().mockReturnValue('https://idp/auth'),
            },
            config: { id: PROVIDER, scope: 'openid' },
          }),
        } as unknown as Partial<ProviderRegistryService>,
        session: { encrypt: vi.fn().mockResolvedValue('tx-token') },
      });
      const res = responseStub();

      await controller.login({ providerId: PROVIDER }, {}, res);

      expect(res.redirect).toHaveBeenCalledWith('https://idp/auth');
      const point = await pointFor('dial.chat.auth.login.started', {
        'dial.chat.auth.provider': PROVIDER,
      });
      expect(point?.value).toBe(1);
    });

    it('does not count a login for an unconfigured provider', async () => {
      const controller = buildController({
        registry: {
          getProvider: vi.fn(() => {
            throw new NotFoundException('Unknown provider');
          }),
        } as unknown as Partial<ProviderRegistryService>,
      });

      await expect(
        controller.login({ providerId: 'nope' }, {}, responseStub()),
      ).rejects.toThrow(NotFoundException);

      expect(
        await pointFor('dial.chat.auth.login.started', {
          'dial.chat.auth.provider': 'unknown',
        }),
      ).toBeUndefined();
    });
  });

  describe('callback', () => {
    const callbackRequest = { cookies: {} } as unknown as Request;

    it('records a rejected callback as validation_rejected without a code exchange', async () => {
      const controller = buildController();

      await expect(
        controller.callback(
          { providerId: PROVIDER },
          { error: 'access_denied' },
          callbackRequest,
          responseStub(),
        ),
      ).rejects.toThrow(BadRequestException);

      const point = await pointFor('dial.chat.auth.callback.duration', {
        'dial.chat.auth.provider': PROVIDER,
        'dial.chat.auth.outcome': 'validation_rejected',
      });
      expect((point?.value as Histogram).count).toBe(1);
    });

    it('records a failed token exchange as exchange_failed', async () => {
      const controller = buildController({
        registry: {
          getProvider: vi.fn().mockReturnValue({
            client: {
              callbackParams: vi.fn().mockReturnValue({}),
              callback: vi.fn().mockRejectedValue(new Error('idp down')),
              issuer: { metadata: {} },
            },
            config: { id: PROVIDER, issuer: 'https://idp', scope: 'openid' },
          }),
        } as unknown as Partial<ProviderRegistryService>,
        session: {
          decrypt: vi.fn().mockResolvedValue(
            sessionPayload({
              at: JSON.stringify({
                state: 'state-1',
                nonce: 'nonce-1',
                codeVerifier: 'verifier-1',
                providerId: PROVIDER,
                callbackUrl: 'http://localhost:4207/',
              }),
            }),
          ),
        },
      });

      await expect(
        controller.callback(
          { providerId: PROVIDER },
          { code: 'code-1', state: 'state-1' },
          { cookies: { '__Host-chat.tx': 'tx-token' } } as unknown as Request,
          responseStub(),
        ),
      ).rejects.toThrow(BadGatewayException);

      const point = await pointFor('dial.chat.auth.callback.duration', {
        'dial.chat.auth.provider': PROVIDER,
        'dial.chat.auth.outcome': 'exchange_failed',
      });
      expect((point?.value as Histogram).count).toBe(1);
    });
  });

  describe('logout', () => {
    it('records a header-authenticated logout as a no-op with no revocation attempt', async () => {
      const controller = buildController();
      const res = responseStub();

      await controller.logout(
        { headers: { authorization: 'Bearer t' } } as unknown as Request,
        res,
      );

      const point = await pointFor('dial.chat.auth.logout', {
        'dial.chat.auth.result': 'header_noop',
        'dial.chat.auth.revocation': 'not_attempted',
      });
      expect(point?.value).toBe(1);
    });

    it('records a rejected origin separately from a cleared cookie', async () => {
      const controller = buildController();

      await expect(
        controller.logout(
          { headers: { origin: 'https://evil.example' } } as unknown as Request,
          responseStub(),
        ),
      ).rejects.toThrow(ForbiddenException);

      const point = await pointFor('dial.chat.auth.logout', {
        'dial.chat.auth.result': 'origin_rejected',
        'dial.chat.auth.revocation': 'not_attempted',
      });
      expect(point?.value).toBe(1);
    });

    it('records a successful best-effort revocation alongside the cleared cookie', async () => {
      const controller = buildController({
        registry: {
          getProvider: vi.fn().mockReturnValue({
            client: {
              issuer: {
                metadata: { revocation_endpoint: 'https://idp/revoke' },
              },
              revoke: vi.fn().mockResolvedValue(undefined),
            },
            config: { id: PROVIDER, postLogoutRedirectUri: 'http://app/' },
          }),
        } as unknown as Partial<ProviderRegistryService>,
        session: { decrypt: vi.fn().mockResolvedValue(sessionPayload()) },
      });

      await controller.logout(
        {
          headers: { origin: 'http://localhost:4207' },
          cookies: { '__Host-chat.sess': 'session-token' },
        } as unknown as Request,
        responseStub(),
      );

      const point = await pointFor('dial.chat.auth.logout', {
        'dial.chat.auth.result': 'cookie_cleared',
        'dial.chat.auth.revocation': 'success',
      });
      expect(point?.value).toBe(1);
    });

    it('records a failed revocation without failing the logout', async () => {
      const controller = buildController({
        registry: {
          getProvider: vi.fn().mockReturnValue({
            client: {
              issuer: {
                metadata: { revocation_endpoint: 'https://idp/revoke' },
              },
              revoke: vi.fn().mockRejectedValue(new Error('revoke failed')),
            },
            config: { id: PROVIDER, postLogoutRedirectUri: 'http://app/' },
          }),
        } as unknown as Partial<ProviderRegistryService>,
        session: { decrypt: vi.fn().mockResolvedValue(sessionPayload()) },
      });
      const res = responseStub();

      await controller.logout(
        {
          headers: { origin: 'http://localhost:4207' },
          cookies: { '__Host-chat.sess': 'session-token' },
        } as unknown as Request,
        res,
      );

      expect(res.redirect).toHaveBeenCalled();
      const point = await pointFor('dial.chat.auth.logout', {
        'dial.chat.auth.result': 'cookie_cleared',
        'dial.chat.auth.revocation': 'failed',
      });
      expect(point?.value).toBe(1);
    });
  });

  describe('refresh', () => {
    const buildRefreshService = (
      client: Record<string, unknown>,
    ): RefreshServiceClass =>
      new RefreshService({
        getProvider: vi.fn().mockReturnValue({ client, config: {} }),
      } as unknown as ProviderRegistryService);

    const invalidGrant = () =>
      Object.assign(new Error('invalid_grant'), { error: 'invalid_grant' });

    it('records one refreshed exchange', async () => {
      const service = buildRefreshService({
        refresh: vi
          .fn()
          .mockResolvedValue({ access_token: 'new-at', expires_at: 1 }),
      });

      await service.refresh(sessionPayload({ sid: 'refresh-ok' }));

      const point = await pointFor('dial.chat.auth.refresh.duration', {
        'dial.chat.auth.provider': PROVIDER,
        'dial.chat.auth.outcome': 'refreshed',
      });
      expect((point?.value as Histogram).count).toBe(1);
    });

    it('records an absorbed rotation race separately from a lost session', async () => {
      const service = buildRefreshService({
        refresh: vi.fn().mockRejectedValue(invalidGrant()),
      });

      await service.refresh(
        sessionPayload({
          sid: 'refresh-race',
          at_exp: Math.floor(Date.now() / 1000) + 300,
        }),
      );

      const absorbed = await pointFor('dial.chat.auth.refresh.duration', {
        'dial.chat.auth.outcome': 'race_absorbed',
      });
      expect((absorbed?.value as Histogram).count).toBe(1);
      expect(
        await pointFor('dial.chat.auth.refresh.duration', {
          'dial.chat.auth.outcome': 'invalid_grant',
        }),
      ).toBeUndefined();
    });

    it('records invalid_grant when the access token has already expired', async () => {
      const service = buildRefreshService({
        refresh: vi.fn().mockRejectedValue(invalidGrant()),
      });

      await expect(
        service.refresh(
          sessionPayload({
            sid: 'refresh-dead',
            at_exp: Math.floor(Date.now() / 1000) - 300,
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      const point = await pointFor('dial.chat.auth.refresh.duration', {
        'dial.chat.auth.outcome': 'invalid_grant',
      });
      expect((point?.value as Histogram).count).toBe(1);
    });

    it('records any other exchange failure as upstream_error', async () => {
      const service = buildRefreshService({
        refresh: vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT')),
      });

      await expect(
        service.refresh(sessionPayload({ sid: 'refresh-timeout' })),
      ).rejects.toThrow(UnauthorizedException);

      const point = await pointFor('dial.chat.auth.refresh.duration', {
        'dial.chat.auth.outcome': 'upstream_error',
      });
      expect((point?.value as Histogram).count).toBe(1);
    });

    it('counts a coalesced caller without adding a second duration observation', async () => {
      let release: (value: unknown) => void = () => undefined;
      const service = buildRefreshService({
        refresh: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            release = resolve;
          }),
        ),
      });
      const payload = sessionPayload({ sid: 'refresh-coalesced' });

      const before = (
        (
          await pointFor('dial.chat.auth.refresh.duration', {
            'dial.chat.auth.outcome': 'refreshed',
          })
        )?.value as Histogram
      ).count;

      const first = service.refresh(payload);
      const second = service.refresh(payload);
      release({ access_token: 'new-at', expires_at: 1 });
      await Promise.all([first, second]);

      const coalesced = await pointFor('dial.chat.auth.refresh.coalesced', {
        'dial.chat.auth.provider': PROVIDER,
      });
      expect(coalesced?.value).toBe(1);

      const after = (
        (
          await pointFor('dial.chat.auth.refresh.duration', {
            'dial.chat.auth.outcome': 'refreshed',
          })
        )?.value as Histogram
      ).count;
      expect(after - before).toBe(1);
    });
  });

  describe('authorization decisions', () => {
    const strategy = (
      source: AuthSource,
      behaviour: Partial<AuthStrategy> = {},
    ): AuthStrategy => ({
      source,
      supports: () => true,
      authenticate: vi.fn().mockResolvedValue({ sub: 'user-1' } as SessionUser),
      ...behaviour,
    });

    const buildGuard = (strategies: AuthStrategy[]) =>
      new SessionGuard(strategies, {
        getAllAndOverride: vi.fn().mockReturnValue(false),
      } as unknown as Reflector);

    it('counts an accepted decision against the matching credential source', async () => {
      const guard = buildGuard([strategy(AuthSource.Cookie)]);

      await expect(
        guard.canActivate(
          executionContext({} as Request, responseStub()),
        ) as Promise<boolean>,
      ).resolves.toBe(true);

      const point = await pointFor('dial.chat.auth.authorization', {
        'dial.chat.auth.source': 'cookie',
        'dial.chat.auth.outcome': 'accepted',
        'dial.chat.auth.reason': 'accepted',
      });
      expect(point?.value).toBe(1);
    });

    it('attributes a strategy rejection to that strategy and its error code', async () => {
      const guard = buildGuard([
        strategy(AuthSource.Header, {
          authenticate: vi.fn().mockRejectedValue(
            new UnauthorizedException({
              code: AuthErrorCode.HeaderTokenExpired,
            }),
          ),
        }),
      ]);

      await expect(
        guard.canActivate(executionContext({} as Request, responseStub())),
      ).rejects.toThrow(UnauthorizedException);

      const point = await pointFor('dial.chat.auth.authorization', {
        'dial.chat.auth.source': 'header',
        'dial.chat.auth.outcome': 'rejected',
        'dial.chat.auth.reason': 'token_expired',
      });
      expect(point?.value).toBe(1);
    });

    it('records a missing credential under source none', async () => {
      const guard = buildGuard([
        strategy(AuthSource.Cookie, { supports: () => false }),
      ]);

      await expect(
        guard.canActivate(executionContext({} as Request, responseStub())),
      ).rejects.toThrow(UnauthorizedException);

      const point = await pointFor('dial.chat.auth.authorization', {
        'dial.chat.auth.source': 'none',
        'dial.chat.auth.outcome': 'rejected',
        'dial.chat.auth.reason': 'no_credentials',
      });
      expect(point?.value).toBe(1);
    });

    it('does not count a decision for a public route', async () => {
      const guard = new SessionGuard([strategy(AuthSource.Cookie)], {
        getAllAndOverride: vi.fn().mockReturnValue(true),
      } as unknown as Reflector);
      const before = (
        await collect('dial.chat.auth.authorization')
      )?.dataPoints.reduce((total, point) => total + Number(point.value), 0);

      await expect(
        guard.canActivate(executionContext({} as Request, responseStub())),
      ).resolves.toBe(true);

      const after = (
        await collect('dial.chat.auth.authorization')
      )?.dataPoints.reduce((total, point) => total + Number(point.value), 0);
      expect(after).toBe(before);
    });
  });

  it('never records a request-scoped identifier as an attribute value', async () => {
    const forbidden = ['sid-1', 'user-1', 'access-token', 'refresh-token'];
    const { resourceMetrics } = await reader.collect();
    const authAttributeValues = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name.startsWith('dial.chat.auth.'))
      .flatMap<AuthDataPoint>(
        (metric) => metric.dataPoints as readonly AuthDataPoint[],
      )
      .flatMap((point) => Object.values(point.attributes))
      .map(String);

    for (const value of forbidden) {
      expect(authAttributeValues).not.toContain(value);
    }
  });
});
