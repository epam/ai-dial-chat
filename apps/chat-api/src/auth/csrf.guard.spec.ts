import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { CsrfGuard } from './csrf.guard';
import type { SessionUser } from './session.types';

const APP_ORIGIN = 'https://app.example.com';

const VALID_USER: SessionUser = {
  sid: 'sid-1',
  sub: 'user-1',
  providerId: 'keycloak',
  claims: {},
  at: 'access-token',
  csrf: 'csrf-secret-token',
};

function buildGuard(isPublic = false): CsrfGuard {
  const config = {
    get: () => APP_ORIGIN,
  } as unknown as ConfigService;

  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;

  return new CsrfGuard(config, reflector);
}

function buildContext(options: {
  method?: string;
  origin?: string;
  referer?: string;
  csrfHeader?: string;
  user?: SessionUser | null;
  isPublic?: boolean;
}): ExecutionContext {
  const req = {
    method: options.method ?? 'POST',
    headers: {
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.referer ? { referer: options.referer } : {}),
      ...(options.csrfHeader ? { 'x-csrf-token': options.csrfHeader } : {}),
    },
    user: options.user !== undefined ? options.user : VALID_USER,
  };

  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  it('allows GET requests without any CSRF check', () => {
    const guard = buildGuard();
    const ctx = buildContext({ method: 'GET', user: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows HEAD requests without any CSRF check', () => {
    const guard = buildGuard();
    const ctx = buildContext({ method: 'HEAD', user: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows OPTIONS requests without any CSRF check', () => {
    const guard = buildGuard();
    const ctx = buildContext({ method: 'OPTIONS', user: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('skips CSRF check for @Public() routes', () => {
    const guard = buildGuard(true);
    const ctx = buildContext({ method: 'POST', user: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when Origin header is missing', () => {
    const guard = buildGuard();
    const ctx = buildContext({ csrfHeader: VALID_USER.csrf });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when Origin does not match app origin', () => {
    const guard = buildGuard();
    const ctx = buildContext({
      origin: 'https://evil.example.com',
      csrfHeader: VALID_USER.csrf,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('accepts Referer as fallback when Origin is absent', () => {
    const guard = buildGuard();
    const ctx = buildContext({
      referer: `${APP_ORIGIN}/some/page`,
      csrfHeader: VALID_USER.csrf,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when X-CSRF-Token header is missing', () => {
    const guard = buildGuard();
    const ctx = buildContext({ origin: APP_ORIGIN });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when X-CSRF-Token does not match session csrf', () => {
    const guard = buildGuard();
    const ctx = buildContext({
      origin: APP_ORIGIN,
      csrfHeader: 'wrong-token',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('passes when Origin matches and X-CSRF-Token is correct', () => {
    const guard = buildGuard();
    const ctx = buildContext({
      origin: APP_ORIGIN,
      csrfHeader: VALID_USER.csrf,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
