import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth-source.enum';
import { AUTH_STRATEGIES } from '../../strategies/auth-strategies.token';
import type { AuthStrategy } from '../../strategies/auth-strategy.interface';
import { OptionalSessionGuard } from '../optional-session.guard';
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
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('OptionalSessionGuard', () => {
  const buildGuard = async (
    strategies: AuthStrategy[],
  ): Promise<OptionalSessionGuard> => {
    const module = await Test.createTestingModule({
      providers: [
        OptionalSessionGuard,
        { provide: AUTH_STRATEGIES, useValue: strategies },
      ],
    }).compile();
    return module.get(OptionalSessionGuard);
  };

  it('populates req.user and req.authSource via authenticateOptional when a strategy supports it', async () => {
    const strategy = makeStrategy({
      source: AuthSource.Cookie,
      supports: vi.fn().mockReturnValue(true),
      authenticateOptional: vi.fn().mockResolvedValue(SESSION_USER),
    });
    const guard = await buildGuard([strategy]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toBe(SESSION_USER);
    expect(req.authSource).toBe(AuthSource.Cookie);
  });

  it('falls back to authenticate() for a strategy with no authenticateOptional', async () => {
    const strategy = makeStrategy({
      source: AuthSource.Header,
      supports: vi.fn().mockReturnValue(true),
      authenticate: vi.fn().mockResolvedValue(SESSION_USER),
    });
    const guard = await buildGuard([strategy]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toBe(SESSION_USER);
    expect(req.authSource).toBe(AuthSource.Header);
  });

  it('continues without a user, without throwing, when authenticateOptional returns null', async () => {
    const strategy = makeStrategy({
      supports: vi.fn().mockReturnValue(true),
      authenticateOptional: vi.fn().mockResolvedValue(null),
    });
    const guard = await buildGuard([strategy]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('continues without a user, without throwing, when the fallback authenticate() throws', async () => {
    const strategy = makeStrategy({
      supports: vi.fn().mockReturnValue(true),
      authenticate: vi.fn().mockRejectedValue(new Error('invalid or expired')),
    });
    const guard = await buildGuard([strategy]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('continues without a user when no strategy supports the request', async () => {
    const guard = await buildGuard([makeStrategy({}), makeStrategy({})]);
    const { context, req } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toBeUndefined();
  });
});
