import { EventEmitter } from 'node:events';
import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  INestApplication,
  MethodNotAllowedException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { CsrfGuard } from '../../auth/csrf/csrf.guard';
import { SessionGuard } from '../../auth/session/session.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { AUTH_STRATEGIES } from '../../auth/strategies/auth-strategies.token';
import type { AuthStrategy } from '../../auth/strategies/auth-strategy.interface';
import type { EnvironmentVariables } from '../../config/environment.config';
import { CustomApiAdmissionService } from '../custom-api-admission.service';
import { CustomApiRegistryService } from '../custom-api-registry.service';
import { CustomApiController } from '../custom-api.controller';
import { CustomApiService } from '../custom-api.service';

const USER: SessionUser = {
  sub: 'user-1',
  providerId: 'keycloak',
  claims: {},
  at: 'access-token',
  bucket: 'bucket-1',
};

const OPERATION = {
  id: 'data-products',
  method: 'GET' as const,
  corePath: '/data-products',
  timeoutMs: 10_000,
  maxResponseBytes: 1_048_576,
};

const buildController = async (overrides?: {
  registryGet?: ReturnType<typeof vi.fn>;
  callOperation?: ReturnType<typeof vi.fn>;
  tryAcquire?: ReturnType<typeof vi.fn>;
}) => {
  const registry = { get: overrides?.registryGet ?? vi.fn(() => OPERATION) };
  const customApiService = {
    callOperation:
      overrides?.callOperation ??
      vi.fn().mockResolvedValue({ data: [1, 2, 3], bytes: 10 }),
  };
  const admission = {
    tryAcquire: overrides?.tryAcquire ?? vi.fn(() => true),
    release: vi.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [CustomApiController],
    providers: [
      { provide: CustomApiRegistryService, useValue: registry },
      { provide: CustomApiService, useValue: customApiService },
      { provide: CustomApiAdmissionService, useValue: admission },
    ],
  }).compile();

  return {
    controller: moduleRef.get(CustomApiController),
    registry,
    customApiService,
    admission,
  };
};

const requestWith = (user: SessionUser, body: unknown = {}) =>
  ({ user, body }) as unknown as Request;

/* Minimal response double: an emitter whose `close` simulates a disconnect. */
const fakeResponse = () =>
  Object.assign(new EventEmitter(), {
    writableEnded: false,
  }) as unknown as Response & EventEmitter;

describe('CustomApiController', () => {
  it('resolves a configured ID and returns its data envelope', async () => {
    const { controller, customApiService } = await buildController();

    const result = await controller.getCustomApiOperation(
      requestWith(USER),
      fakeResponse(),
      { id: 'data-products' },
      {},
    );

    expect(result).toEqual({ data: [1, 2, 3] });
    expect(customApiService.callOperation).toHaveBeenCalledWith(
      OPERATION,
      USER.at,
      expect.any(AbortSignal),
    );
  });

  it('aborts the in-flight Core call when the client disconnects, then releases admission', async () => {
    let receivedSignal: AbortSignal | undefined;
    const callOperation = vi.fn(
      (_operation, _token, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          receivedSignal = signal;
          signal.addEventListener('abort', () =>
            reject(new HttpException('Client closed request', 499)),
          );
        }),
    );
    const { controller, admission } = await buildController({
      callOperation,
    });
    const res = fakeResponse();

    const pending = controller.getCustomApiOperation(
      requestWith(USER),
      res,
      { id: 'data-products' },
      {},
    );
    res.emit('close');

    await expect(pending).rejects.toThrow(HttpException);
    expect(receivedSignal?.aborted).toBe(true);
    expect(admission.release).toHaveBeenCalledOnce();
    expect(res.listenerCount('close')).toBe(0);
  });

  it('returns 404 for a valid but unregistered ID without acquiring admission capacity', async () => {
    const { controller, admission } = await buildController({
      registryGet: vi.fn(() => undefined),
    });

    await expect(
      controller.getCustomApiOperation(
        requestWith(USER),
        fakeResponse(),
        { id: 'unregistered' },
        {},
      ),
    ).rejects.toThrow(NotFoundException);
    expect(admission.tryAcquire).not.toHaveBeenCalled();
  });

  it('returns 429 without dispatching to Core when admission is exhausted', async () => {
    const { controller, customApiService } = await buildController({
      tryAcquire: vi.fn(() => false),
    });

    let thrown: unknown;
    try {
      await controller.getCustomApiOperation(
        requestWith(USER),
        fakeResponse(),
        { id: 'data-products' },
        {},
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect(customApiService.callOperation).not.toHaveBeenCalled();
  });

  it('always releases admission capacity, even when the service call fails', async () => {
    const { controller, admission } = await buildController({
      callOperation: vi.fn().mockRejectedValue(new BadGatewayException()),
    });

    await expect(
      controller.getCustomApiOperation(
        requestWith(USER),
        fakeResponse(),
        { id: 'data-products' },
        {},
      ),
    ).rejects.toThrow(BadGatewayException);
    expect(admission.release).toHaveBeenCalledOnce();
  });

  it('rejects every non-GET verb with 405 without calling the service', async () => {
    const { controller, customApiService } = await buildController();

    expect(() => controller.rejectHead()).toThrow(MethodNotAllowedException);
    expect(() => controller.rejectPost()).toThrow(MethodNotAllowedException);
    expect(() => controller.rejectPut()).toThrow(MethodNotAllowedException);
    expect(() => controller.rejectPatch()).toThrow(MethodNotAllowedException);
    expect(() => controller.rejectDelete()).toThrow(MethodNotAllowedException);
    expect(customApiService.callOperation).not.toHaveBeenCalled();
  });
});

/*
 * Real global-guard integration suite: SessionGuard and CsrfGuard are the
 * actual production guards (not faked via middleware), wired as APP_GUARD
 * exactly as AuthModule does. Only the auth strategy layer and Core-facing
 * CustomApiService are test doubles — everything in between (guard
 * dispatch, CSRF double-submit, controller, admission) is real.
 */
const APP_ORIGIN = 'https://app.example.com';

interface FakeCookiePayload extends SessionUser {
  /** Test-only marker: simulate a transparent session refresh during auth. */
  refreshed?: boolean;
}

class FakeHeaderStrategy implements AuthStrategy {
  readonly source = AuthSource.Header;

  supports(req: Request): boolean {
    return typeof req.headers['x-test-header-user'] === 'string';
  }

  async authenticate(req: Request): Promise<SessionUser | null> {
    return JSON.parse(
      req.headers['x-test-header-user'] as string,
    ) as SessionUser;
  }
}

class FakeCookieStrategy implements AuthStrategy {
  readonly source = AuthSource.Cookie;

  supports(req: Request): boolean {
    return typeof req.headers['x-test-cookie-user'] === 'string';
  }

  async authenticate(req: Request, res: Response): Promise<SessionUser | null> {
    const { refreshed, ...user } = JSON.parse(
      req.headers['x-test-cookie-user'] as string,
    ) as FakeCookiePayload;

    if (refreshed) {
      /* Simulates CookieSessionStrategy writing a renewed session cookie
       * during transparent refresh — a BFF-owned header the custom API
       * surface must never strip or overwrite. */
      res.setHeader(
        'Set-Cookie',
        '__Host-chat.sess=refreshed-session-value; Path=/; HttpOnly; Secure; SameSite=Lax',
      );
    }
    return user;
  }
}

const sessionUser = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  sub: 'user-1',
  providerId: 'keycloak',
  claims: {},
  at: 'initial-access-token',
  bucket: 'bucket-1',
  csrf: 'csrf-secret',
  ...overrides,
});

const headerUser = (user: SessionUser) => JSON.stringify(user);

async function buildIntegrationApp(callOperation: ReturnType<typeof vi.fn>) {
  const registry = { get: vi.fn(() => OPERATION) };
  const customApiService = { callOperation };

  const configStub = {
    get: () => APP_ORIGIN,
  } as unknown as ConfigService<EnvironmentVariables, true>;

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [CustomApiController],
    providers: [
      { provide: CustomApiRegistryService, useValue: registry },
      { provide: CustomApiService, useValue: customApiService },
      CustomApiAdmissionService,
      Reflector,
      { provide: ConfigService, useValue: configStub },
      {
        provide: AUTH_STRATEGIES,
        useValue: [new FakeHeaderStrategy(), new FakeCookieStrategy()],
      },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return { app, registry, customApiService };
}

describe('CustomApiController (real guards, integration)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const PATH = '/api/v1/custom-api/data-products';

  it('returns 401 when no auth strategy supports the request', async () => {
    const callOperation = vi.fn();
    ({ app } = await buildIntegrationApp(callOperation));

    await request(app.getHttpServer()).get(PATH).expect(401);
    expect(callOperation).not.toHaveBeenCalled();
  });

  it('uses the header strategy over the cookie strategy when both are present (configured precedence)', async () => {
    const callOperation = vi
      .fn()
      .mockResolvedValue({ data: { ok: true }, bytes: 2 });
    ({ app } = await buildIntegrationApp(callOperation));

    await request(app.getHttpServer())
      .get(PATH)
      .set(
        'x-test-header-user',
        headerUser(sessionUser({ at: 'header-token' })),
      )
      .set(
        'x-test-cookie-user',
        headerUser(sessionUser({ at: 'cookie-token' })),
      )
      .expect(200);

    expect(callOperation).toHaveBeenCalledWith(
      OPERATION,
      'header-token',
      expect.any(AbortSignal),
    );
  });

  it('dispatches using the refreshed session token and preserves the BFF refresh cookie', async () => {
    const callOperation = vi
      .fn()
      .mockResolvedValue({ data: { ok: true }, bytes: 2 });
    ({ app } = await buildIntegrationApp(callOperation));

    const res = await request(app.getHttpServer())
      .get(PATH)
      .set(
        'x-test-cookie-user',
        headerUser({
          ...sessionUser({ at: 'refreshed-token' }),
          refreshed: true,
        } as SessionUser),
      )
      .expect(200);

    expect(callOperation).toHaveBeenCalledWith(
      OPERATION,
      'refreshed-token',
      expect.any(AbortSignal),
    );
    const setCookie = res.headers['set-cookie'] as unknown as
      string[] | string | undefined;
    expect(
      Array.isArray(setCookie) ? setCookie.join(';') : setCookie,
    ).toContain('refreshed-session-value');
  });

  it('does not require CSRF for GET but enforces it for a mutating method', async () => {
    const callOperation = vi.fn().mockResolvedValue({ data: {}, bytes: 2 });
    ({ app } = await buildIntegrationApp(callOperation));
    const user = sessionUser();

    // GET: no Origin/X-CSRF-Token supplied, still succeeds — safe method.
    await request(app.getHttpServer())
      .get(PATH)
      .set('x-test-cookie-user', headerUser(user))
      .expect(200);

    // POST: mutating method, no CSRF — real CsrfGuard rejects before the
    // controller's own method-rejection logic ever runs.
    await request(app.getHttpServer())
      .post(PATH)
      .set('x-test-cookie-user', headerUser(user))
      .expect(403);
  });

  it('returns 405 for a mutating verb once CSRF passes, without dispatching to Core', async () => {
    const callOperation = vi.fn();
    ({ app } = await buildIntegrationApp(callOperation));
    const user = sessionUser();

    await request(app.getHttpServer())
      .post(PATH)
      .set('x-test-cookie-user', headerUser(user))
      .set('Origin', APP_ORIGIN)
      .set('x-csrf-token', user.csrf as string)
      .expect(405);

    expect(callOperation).not.toHaveBeenCalled();
  });

  it('never dispatches to Core for an implicit HEAD request', async () => {
    const callOperation = vi.fn();
    ({ app } = await buildIntegrationApp(callOperation));

    await request(app.getHttpServer())
      .head(PATH)
      .set('x-test-cookie-user', headerUser(sessionUser()))
      .expect(405);

    expect(callOperation).not.toHaveBeenCalled();
  });

  it('rejects any query parameter with 400 before dispatch', async () => {
    const callOperation = vi.fn();
    ({ app } = await buildIntegrationApp(callOperation));
    const user = sessionUser();

    await request(app.getHttpServer())
      .get(`${PATH}?parameters=anything`)
      .set('x-test-cookie-user', headerUser(user))
      .expect(400);

    expect(callOperation).not.toHaveBeenCalled();
  });

  it('rejects a nonempty JSON body with 400 before dispatch', async () => {
    const callOperation = vi.fn();
    ({ app } = await buildIntegrationApp(callOperation));
    const user = sessionUser();

    await request(app.getHttpServer())
      .get(PATH)
      .set('x-test-cookie-user', headerUser(user))
      .send({ parameters: { page: 2 } })
      .expect(400);

    expect(callOperation).not.toHaveBeenCalled();
  });

  it('rejects a nonempty body no parser reads (text/plain) with 400 before dispatch', async () => {
    const callOperation = vi.fn();
    ({ app } = await buildIntegrationApp(callOperation));

    await request(app.getHttpServer())
      .get(PATH)
      .set('x-test-cookie-user', headerUser(sessionUser()))
      .set('Content-Type', 'text/plain')
      .send('parameters=anything')
      .expect(400);

    expect(callOperation).not.toHaveBeenCalled();
  });

  it('returns 404 for a disabled/unknown operation ID without acquiring admission', async () => {
    const callOperation = vi.fn();
    const registry = { get: vi.fn(() => undefined) };
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomApiController],
      providers: [
        { provide: CustomApiRegistryService, useValue: registry },
        { provide: CustomApiService, useValue: { callOperation } },
        CustomApiAdmissionService,
        Reflector,
        {
          provide: ConfigService,
          useValue: { get: () => APP_ORIGIN } as unknown as ConfigService<
            EnvironmentVariables,
            true
          >,
        },
        { provide: AUTH_STRATEGIES, useValue: [new FakeCookieStrategy()] },
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');

    await request(app.getHttpServer())
      .get('/api/v1/custom-api/unknown-operation')
      .set('x-test-cookie-user', headerUser(sessionUser()))
      .expect(404);

    expect(callOperation).not.toHaveBeenCalled();
  });

  it('propagates mocked Core outcomes — success, 401, 403, 404, 429 — without retrying or switching identity, using only the current token', async () => {
    const callOperation = vi
      .fn()
      .mockResolvedValueOnce({ data: { page: 1 }, bytes: 2 })
      .mockRejectedValueOnce(new UnauthorizedException())
      .mockRejectedValueOnce(new ForbiddenException())
      .mockRejectedValueOnce(new NotFoundException())
      .mockRejectedValueOnce(new HttpException('Too many requests', 429));
    ({ app } = await buildIntegrationApp(callOperation));
    const user = sessionUser({ at: 'stable-token' });

    const expectations = [200, 401, 403, 404, 429];
    for (const expected of expectations) {
      await request(app.getHttpServer())
        .get(PATH)
        .set('x-test-cookie-user', headerUser(user))
        .expect(expected);
    }

    expect(callOperation).toHaveBeenCalledTimes(expectations.length);
    for (const call of callOperation.mock.calls) {
      expect(call).toEqual([
        OPERATION,
        'stable-token',
        expect.any(AbortSignal),
      ]);
    }
  });
});
