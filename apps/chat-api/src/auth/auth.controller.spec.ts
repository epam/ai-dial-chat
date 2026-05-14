import { randomUUID } from 'crypto';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { CompactEncrypt } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { KeysService } from './keys.service';
import { ProviderRegistryService } from './provider-registry.service';
import { RefreshService } from './refresh.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import type { SessionPayload } from './session.types';

// supertest is CJS; use require to avoid vite ESM interop issues
const request = require('supertest') as (
  app: Parameters<typeof import('supertest')>[0],
) => import('supertest').SuperTest<import('supertest').Test>;

const ACTIVE_HEX = 'a'.repeat(64);
const ACTIVE_KEY = new Uint8Array(Buffer.from(ACTIVE_HEX, 'hex'));
const COOKIE_NAME = '__Host-chat.sess';
const TX_COOKIE = '__Host-chat.tx';
const CALLBACK_BASE = 'http://localhost:3005';

const MOCK_CLIENT = {
  authorizationUrl: vi
    .fn()
    .mockReturnValue('https://keycloak.example.com/auth?state=s&nonce=n'),
  callbackParams: vi.fn(),
  callback: vi.fn(),
  revoke: vi.fn().mockResolvedValue(undefined),
  endSessionUrl: vi
    .fn()
    .mockReturnValue('https://keycloak.example.com/end-session'),
  issuer: {
    metadata: {} as Record<string, string | undefined>,
  },
};

const MOCK_REFRESH_SERVICE = {
  refresh: vi.fn(),
};

async function buildApp(): Promise<INestApplication> {
  const keysServiceMock: Partial<KeysService> = {
    activeKey: ACTIVE_KEY,
    previousKey: undefined,
  };

  const sessionService = new SessionService(
    keysServiceMock as KeysService,
    {
      get: (key: string) => {
        const map: Record<string, string> = {
          AUTH_SESSION_COOKIE_NAME: COOKIE_NAME,
        };
        return map[key];
      },
    } as unknown as ConfigService,
  );

  const registryMock: Partial<ProviderRegistryService> = {
    listProviders: vi
      .fn()
      .mockReturnValue([{ id: 'keycloak', label: 'Keycloak' }]),
    getProvider: vi.fn().mockImplementation((id: string) => {
      if (id !== 'keycloak') {
        const { NotFoundException } = require('@nestjs/common');
        throw new NotFoundException(`Unknown provider: ${id}`);
      }
      return {
        client: MOCK_CLIENT,
        config: {
          id: 'keycloak',
          issuer: 'https://kc.example.com/realms/chat',
          scope: 'openid email profile',
          rolesClaim: 'roles',
          postLogoutRedirectUri: 'https://app.example.com',
        },
      };
    }),
  };

  const configMock = {
    get: (key: string) => {
      const map: Record<string, string> = {
        AUTH_CALLBACK_BASE_URL: CALLBACK_BASE,
        AUTH_SESSION_COOKIE_NAME: COOKIE_NAME,
      };
      return map[key];
    },
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: KeysService, useValue: keysServiceMock },
      { provide: SessionService, useValue: sessionService },
      { provide: ProviderRegistryService, useValue: registryMock },
      { provide: ConfigService, useValue: configMock },
      { provide: RefreshService, useValue: MOCK_REFRESH_SERVICE },
      { provide: APP_GUARD, useClass: SessionGuard },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

async function makeSessionCookie(payload: SessionPayload): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return new CompactEncrypt(plaintext)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(ACTIVE_KEY);
}

async function makeTxCookie(txData: object): Promise<string> {
  const inner: SessionPayload = {
    v: 1,
    sid: randomUUID(),
    providerId: 'keycloak',
    sub: '',
    at: JSON.stringify(txData),
    rt: '',
    at_exp: 9999999999,
    rt_exp: 9999999999,
    iat: Math.floor(Date.now() / 1000),
    csrf: randomUUID(),
    claims: {},
  };
  return makeSessionCookie(inner);
}

const sampleSession: SessionPayload = {
  v: 1,
  sid: randomUUID(),
  providerId: 'keycloak',
  sub: 'user-1',
  at: 'access-token',
  rt: 'refresh-token',
  at_exp: 9999999999,
  rt_exp: 9999999999,
  iat: Math.floor(Date.now() / 1000),
  csrf: randomUUID(),
  claims: { email: 'u@example.com' },
};

describe('AuthController (integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    MOCK_REFRESH_SERVICE.refresh.mockReset();
    await app.close();
  });

  describe('GET /api/v1/auth/providers', () => {
    it('returns provider list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/providers')
        .expect(200);
      expect(res.body).toEqual([{ id: 'keycloak', label: 'Keycloak' }]);
    });
  });

  describe('GET /api/v1/auth/login/:providerId', () => {
    it('redirects to IdP and sets tx cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/login/keycloak')
        .expect(302);
      expect(res.headers.location).toContain('keycloak.example.com');
      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const txCookie = cookies.find((c) => c.startsWith(TX_COOKIE));
      expect(txCookie).toBeDefined();
      expect(txCookie).toContain('HttpOnly');
      expect(txCookie).toContain('Secure');
      expect(txCookie).toContain('SameSite=Lax');
      expect(txCookie).toContain('Path=/');
    });

    it('returns 404 for unknown provider', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/login/unknown')
        .expect(404);
    });

    it('returns 400 for path traversal attempt', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/login/..%2Ftraversal')
        .expect(400);
    });
  });

  describe('GET /api/v1/auth/callback/:providerId', () => {
    it('sets session cookie and redirects to / with valid code+state', async () => {
      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
      });

      MOCK_CLIENT.callbackParams.mockReturnValue({ code: 'code', state });
      MOCK_CLIENT.callback.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_at: 9999999999,
        claims: () => ({
          sub: 'user-1',
          email: 'u@example.com',
        }),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/callback/keycloak?code=code&state=${state}`)
        .set('Cookie', `${TX_COOKIE}=${txCookieValue}`)
        .expect(302);

      expect(res.headers.location).toBe('/');
      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const sessCookie = cookies.find((c) => c.startsWith(COOKIE_NAME));
      expect(sessCookie).toBeDefined();
    });

    it('returns 400 on state mismatch', async () => {
      const txCookieValue = await makeTxCookie({
        state: 'correct-state',
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
      });
      MOCK_CLIENT.callbackParams.mockReturnValue({
        code: 'code',
        state: 'wrong-state',
      });

      await request(app.getHttpServer())
        .get('/api/v1/auth/callback/keycloak?code=code&state=wrong-state')
        .set('Cookie', `${TX_COOKIE}=${txCookieValue}`)
        .expect(400);
    });

    it('accepts Keycloak-style extra query params (iss, session_state)', async () => {
      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
      });
      MOCK_CLIENT.callbackParams.mockReturnValue({ code: 'code', state });
      MOCK_CLIENT.callback.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_at: 9999999999,
        claims: () => ({ sub: 'user-1', email: 'u@example.com' }),
      });

      const issEncoded = encodeURIComponent(
        'https://kc.example.com/realms/chat',
      );
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/auth/callback/keycloak?code=code&state=${state}&iss=${issEncoded}&session_state=abc-123`,
        )
        .set('Cookie', `${TX_COOKIE}=${txCookieValue}`)
        .expect(302);

      expect(res.headers.location).toBe('/');
    });

    it('returns 400 with descriptive message on IdP error parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/auth/callback/keycloak?error=access_denied&error_description=User%20cancelled',
        )
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('User cancelled');
    });

    it('returns 400 on issuer mismatch (RFC 9207)', async () => {
      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
      });

      await request(app.getHttpServer())
        .get(
          `/api/v1/auth/callback/keycloak?code=code&state=${state}&iss=https%3A%2F%2Fevil.example.com`,
        )
        .set('Cookie', `${TX_COOKIE}=${txCookieValue}`)
        .expect(400);
    });

    it('returns 400 when code is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/callback/keycloak?state=some-state')
        .expect(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns UserProfile with valid session cookie', async () => {
      const sessCookie = await makeSessionCookie(sampleSession);
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(200);
      expect(res.body.sub).toBe('user-1');
      expect(res.body.providerId).toBe('keycloak');
    });

    it('returns 401 without session cookie', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns 401 with tampered cookie', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=tampered.value.here`)
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    afterEach(() => {
      MOCK_CLIENT.issuer.metadata = {};
    });

    it('clears session cookie and redirects to / when provider has no end_session_endpoint', async () => {
      const sessCookie = await makeSessionCookie(sampleSession);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(302);

      expect(res.headers.location).toBe('/');
      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const cleared = cookies.find((c) => c?.startsWith(COOKIE_NAME));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Max-Age=0/i);
    });

    it('redirects to end_session_endpoint when provider supports it', async () => {
      MOCK_CLIENT.issuer.metadata = {
        end_session_endpoint: 'https://keycloak.example.com/end-session',
      };
      const sessCookie = await makeSessionCookie(sampleSession);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(302);

      expect(res.headers.location).toContain(
        'keycloak.example.com/end-session',
      );
      expect(MOCK_CLIENT.endSessionUrl).toHaveBeenCalledTimes(1);
    });

    it('responds 302 gracefully with no session cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(302);

      expect(res.headers.location).toBe('/');
    });
  });

  describe('Global SessionGuard (Slice 2)', () => {
    it('allows GET /api/v1/auth/providers without session (public route)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/providers')
        .expect(200);
    });

    it('blocks a protected route without session cookie', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('triggers refresh and sets new cookie when at is near-expired', async () => {
      const now = Math.floor(Date.now() / 1000);
      const nearExpiredSession: SessionPayload = {
        ...sampleSession,
        sid: randomUUID(),
        at_exp: now + 30, // below the 60-second threshold
      };
      const refreshedSession: SessionPayload = {
        ...nearExpiredSession,
        at: 'refreshed-access-token',
        at_exp: now + 3600,
        csrf: randomUUID(),
      };
      MOCK_REFRESH_SERVICE.refresh.mockResolvedValue(refreshedSession);

      const sessCookie = await makeSessionCookie(nearExpiredSession);
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(200);

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const newSessCookie = cookies.find((c) => c?.startsWith(COOKIE_NAME));
      expect(newSessCookie).toBeDefined();
      expect(MOCK_REFRESH_SERVICE.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
