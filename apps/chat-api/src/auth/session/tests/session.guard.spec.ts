import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth-source.enum';
import { AUTH_STRATEGIES } from '../../strategies/auth-strategies.token';
import type { AuthStrategy } from '../../strategies/auth-strategy.interface';
import { AuthErrorCode } from '../auth-error-code.enum';
import { SessionGuard } from '../session.guard';
import type { SessionUser } from '../session.types';

const SESSION_USER: SessionUser = {
  sid: 'sid-1',
  sub: 'user-1',
  providerId: 'keycloak',
  claims: {},
  at: 'access-token',
  bucket: 'user-bucket',
  csrf: 'csrf-secret',
};

function makeStrategy(overrides: Partial<AuthStrategy>): AuthStrategy {
  return {
    source: AuthSource.Cookie,
    supports: vi.fn().mockReturnValue(false),
    authenticate: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeContext(): {
  context: ExecutionContext;
  req: Record<string, unknown>;
} {
  const req: Record<string, unknown> = { user: undefined };
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('SessionGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
  });

  const buildGuard = async (
    strategies: AuthStrategy[],
  ): Promise<SessionGuard> => {
    const module = await Test.createTestingModule({
      providers: [
        SessionGuard,
        { provide: AUTH_STRATEGIES, useValue: strategies },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    return module.get(SessionGuard);
  };

  it('allows public routes without consulting any strategy', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const strategy = makeStrategy({});
    const guard = await buildGuard([strategy]);
    const { context } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(strategy.supports).not.toHaveBeenCalled();
  });

  it('uses the first strategy that supports the request, in registration order', async () => {
    const header = makeStrategy({
      source: AuthSource.Header,
      supports: vi.fn().mockReturnValue(true),
      authenticate: vi.fn().mockResolvedValue(SESSION_USER),
    });
    const cookie = makeStrategy({ source: AuthSource.Cookie });
    const guard = await buildGuard([header, cookie]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toBe(SESSION_USER);
    expect(req.authSource).toBe(AuthSource.Header);
    expect(cookie.supports).not.toHaveBeenCalled();
  });

  it('falls through to the next strategy when the first does not support the request', async () => {
    const header = makeStrategy({
      source: AuthSource.Header,
      supports: vi.fn().mockReturnValue(false),
    });
    const cookie = makeStrategy({
      source: AuthSource.Cookie,
      supports: vi.fn().mockReturnValue(true),
      authenticate: vi.fn().mockResolvedValue(SESSION_USER),
    });
    const guard = await buildGuard([header, cookie]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.authSource).toBe(AuthSource.Cookie);
  });

  it('propagates an exception thrown by a supporting strategy instead of falling through', async () => {
    const header = makeStrategy({
      source: AuthSource.Header,
      supports: vi.fn().mockReturnValue(true),
      authenticate: vi.fn().mockRejectedValue(new UnauthorizedException()),
    });
    const cookie = makeStrategy({
      source: AuthSource.Cookie,
      supports: vi.fn().mockReturnValue(true),
      authenticate: vi.fn().mockResolvedValue(SESSION_USER),
    });
    const guard = await buildGuard([header, cookie]);
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(cookie.authenticate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException with AUTH_NO_CREDENTIALS when no strategy supports the request', async () => {
    const guard = await buildGuard([makeStrategy({}), makeStrategy({})]);
    const { context } = makeContext();

    let error: unknown;
    try {
      await guard.canActivate(context);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      code: AuthErrorCode.NoCredentials,
      statusCode: 401,
    });
  });
});
