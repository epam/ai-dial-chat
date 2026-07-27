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
import type { EnvironmentVariables } from '../config/environment.config';
import { AuthController } from './auth.controller';
import { BucketService } from './bucket/bucket.service';
import { KeysService } from './keys/keys.service';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { RefreshService } from './refresh/refresh.service';
import { SessionGuard } from './session/session.guard';
import { SessionService } from './session/session.service';
import type { SessionPayload } from './session/session.types';

// supertest is CJS; use require to avoid vite ESM interop issues
const request = require('supertest') as (
  app: Parameters<typeof import('supertest')>[0],
) => import('supertest').SuperTest<import('supertest').Test>;

const ACTIVE_HEX = 'a'.repeat(64);
const ACTIVE_KEY = new Uint8Array(Buffer.from(ACTIVE_HEX, 'hex'));
const COOKIE_NAME = '__Host-chat.sess';
const TX_COOKIE = '__Host-chat.tx';
const CALLBACK_BASE = 'http://localhost:3005';
const APP_BASE = 'http://localhost:4207';

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

const MOCK_BUCKET_SERVICE = {
  getUserBucket: vi.fn().mockResolvedValue({ bucket: 'test-bucket' }),
};

let providerConfigOverride: Record<string, unknown> = {};
let configOverride: Partial<EnvironmentVariables> = {};

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
    } as unknown as ConfigService<EnvironmentVariables, true>,
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
          ...providerConfigOverride,
        },
      };
    }),
  };

  const configMock = {
    get: (key: string) => {
      const map: Partial<EnvironmentVariables> = {
        AUTH_CALLBACK_BASE_URL: CALLBACK_BASE,
        AUTH_SESSION_COOKIE_NAME: COOKIE_NAME,
        CORS_ORIGIN: APP_BASE,
        ...configOverride,
      };
      return map[key as keyof EnvironmentVariables];
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
      { provide: BucketService, useValue: MOCK_BUCKET_SERVICE },
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
    bucket: '',
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
  bucket: '',
};

describe('AuthController (integration)', () => {
  let app!: INestApplication;

  beforeEach(async () => {
    providerConfigOverride = {};
    configOverride = {};
    app = await buildApp();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    MOCK_REFRESH_SERVICE.refresh.mockReset();
    await app?.close();
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

    it('accepts a safe callbackUrl query', async () => {
      const callbackUrl = encodeURIComponent(`${APP_BASE}/conversation?x=1`);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/login/keycloak?callbackUrl=${callbackUrl}`)
        .expect(302);

      expect(res.headers.location).toContain('keycloak.example.com');
    });

    it('passes provider audience to authorization request when configured', async () => {
      await app?.close();
      providerConfigOverride = { audience: 'https://dial-core.example.com' };
      app = await buildApp();

      await request(app.getHttpServer())
        .get('/api/v1/auth/login/keycloak')
        .expect(302);

      expect(MOCK_CLIENT.authorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: 'https://dial-core.example.com',
        }),
      );
    });

    it('returns 400 for unsafe callbackUrl query', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/auth/login/keycloak?callbackUrl=${encodeURIComponent('https://evil.example.com')}`,
        )
        .expect(400);
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
    it('sets session cookie and redirects to callbackUrl with valid code+state', async () => {
      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
        callbackUrl: `${APP_BASE}/conversation`,
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

      expect(res.headers.location).toBe(`${APP_BASE}/conversation`);
      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const sessCookie = cookies.find((c) => c.startsWith(COOKIE_NAME));
      expect(sessCookie).toBeDefined();
    });

    it('sets SameSite=None session cookies for secure overlay embedding', async () => {
      await app?.close();
      configOverride = {
        AUTH_COOKIE_SECURE: true,
        OVERLAY_ENABLED: true,
        ALLOWED_IFRAME_ORIGINS: ['https://host.example.com'],
      };
      app = await buildApp();

      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
        callbackUrl: `${APP_BASE}/auth/popup-callback?channel=flow-1`,
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

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const sessCookie = cookies.find((c) => c.startsWith(COOKIE_NAME));
      expect(sessCookie).toContain('SameSite=None');
      expect(sessCookie).toContain('Secure');
    });

    it('splits a large session cookie into chunks', async () => {
      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
        callbackUrl: `${APP_BASE}/conversation`,
      });

      MOCK_CLIENT.callbackParams.mockReturnValue({ code: 'code', state });
      MOCK_CLIENT.callback.mockResolvedValue({
        access_token: 'x'.repeat(5000),
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

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const clearedBaseCookie = cookies.find((c) =>
        c.startsWith(`${COOKIE_NAME}=`),
      );
      const sessionChunks = cookies
        .filter((c) => c.startsWith(`${COOKIE_NAME}.`))
        .sort((a, b) => {
          const aIndex = Number(a.slice(COOKIE_NAME.length + 1).split('=')[0]);
          const bIndex = Number(b.slice(COOKIE_NAME.length + 1).split('=')[0]);
          return aIndex - bIndex;
        });
      const cookieValue = sessionChunks
        .map((c) => c.match(/^[^=]+=([^;]+)/)?.[1] ?? '')
        .join('');

      expect(clearedBaseCookie).toMatch(/Max-Age=0/i);
      expect(sessionChunks.length).toBeGreaterThan(1);
      const payload = await app.get(SessionService).decrypt(cookieValue);
      expect(payload.at).toBe('x'.repeat(5000));
      expect(payload.at_exp).toBe(9999999999);
      expect(payload.rt).toBe('rt');
    });

    it('defaults callback redirect to app root when tx cookie has no callbackUrl', async () => {
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

      expect(res.headers.location).toBe(`${APP_BASE}/`);
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

      expect(res.headers.location).toBe(`${APP_BASE}/`);
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

    it('returns 400 when transaction cookie is expired', async () => {
      const state = 'valid-state';
      const expiredTxCookie = await (async () => {
        const inner = {
          v: 1 as const,
          sid: randomUUID(),
          providerId: 'keycloak',
          sub: '',
          at: JSON.stringify({
            state,
            nonce: 'nonce',
            codeVerifier: 'verifier',
            providerId: 'keycloak',
          }),
          rt: '',
          at_exp: Math.floor(Date.now() / 1000) - 1, // already expired
          rt_exp: 0,
          iat: Math.floor(Date.now() / 1000) - 700,
          csrf: randomUUID(),
          claims: {},
          bucket: '',
        };
        return makeSessionCookie(inner);
      })();

      await request(app.getHttpServer())
        .get(`/api/v1/auth/callback/keycloak?code=code&state=${state}`)
        .set('Cookie', `${TX_COOKIE}=${expiredTxCookie}`)
        .expect(400);
    });

    it('stores only allowlisted claims in session cookie', async () => {
      const state = 'valid-state';
      const txCookieValue = await makeTxCookie({
        state,
        nonce: 'nonce',
        codeVerifier: 'verifier',
        providerId: 'keycloak',
        callbackUrl: `${APP_BASE}/conversation`,
      });

      MOCK_CLIENT.callbackParams.mockReturnValue({ code: 'code', state });
      MOCK_CLIENT.callback.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_at: 9999999999,
        claims: () => ({
          sub: 'user-1',
          email: 'u@example.com',
          name: 'Test User',
          phone_number: '+1234567890', // should NOT be stored
          address: { formatted: '123 St' }, // should NOT be stored
          roles: ['admin'],
        }),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/callback/keycloak?code=code&state=${state}`)
        .set('Cookie', `${TX_COOKIE}=${txCookieValue}`)
        .expect(302);

      const rawCookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      const sessCookieHeader = rawCookies.find((c) =>
        c.startsWith(COOKIE_NAME),
      );
      expect(sessCookieHeader).toBeDefined();
      if (!sessCookieHeader) {
        throw new Error('Expected session cookie header to be present');
      }
      const cookieValue = sessCookieHeader.split(';')[0].split('=')[1];
      const payload = await app.get(SessionService).decrypt(cookieValue);

      expect(payload.claims['email']).toBe('u@example.com');
      expect(payload.claims['name']).toBe('Test User');
      expect(payload.claims['roles']).toEqual(['admin']);
      expect(payload.claims['phone_number']).toBeUndefined();
      expect(payload.claims['address']).toBeUndefined();
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
      expect(res.body.isAdmin).toBe(false);
    });

    it('returns isAdmin true when the roles claim intersects adminRoles', async () => {
      providerConfigOverride = { adminRoles: ['org-admin'] };
      const sessCookie = await makeSessionCookie({
        ...sampleSession,
        claims: { ...sampleSession.claims, roles: ['member', 'org-admin'] },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(200);
      expect(res.body.isAdmin).toBe(true);
    });

    it('returns isAdmin false when the roles claim does not intersect adminRoles', async () => {
      providerConfigOverride = { adminRoles: ['org-admin'] };
      const sessCookie = await makeSessionCookie({
        ...sampleSession,
        claims: { ...sampleSession.claims, roles: ['member'] },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(200);
      expect(res.body.isAdmin).toBe(false);
    });

    it('returns isAdmin true for a dot-notation rolesClaim stored as a flat key', async () => {
      providerConfigOverride = {
        rolesClaim: 'realm_access.roles',
        adminRoles: ['admin'],
      };
      const sessCookie = await makeSessionCookie({
        ...sampleSession,
        claims: {
          ...sampleSession.claims,
          'realm_access.roles': ['admin'],
        },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(200);
      expect(res.body.isAdmin).toBe(true);
    });

    it('returns isAdmin false when the provider has no adminRoles configured', async () => {
      const sessCookie = await makeSessionCookie({
        ...sampleSession,
        claims: { ...sampleSession.claims, roles: ['org-admin'] },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(200);
      expect(res.body.isAdmin).toBe(false);
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
        .set('Origin', CALLBACK_BASE)
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
        .set('Origin', CALLBACK_BASE)
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
        .set('Origin', CALLBACK_BASE)
        .expect(302);

      expect(res.headers.location).toBe('/');
    });

    it('returns 403 when Origin header is absent (CSRF logout protection)', async () => {
      const sessCookie = await makeSessionCookie(sampleSession);
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(403);
    });

    it('returns 403 when Origin is from an untrusted domain', async () => {
      const sessCookie = await makeSessionCookie(sampleSession);
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Origin', 'https://evil.example.com')
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(403);
    });

    it('accepts Referer as fallback for Origin check', async () => {
      const sessCookie = await makeSessionCookie(sampleSession);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Referer', `${CALLBACK_BASE}/some/page`)
        .set('Cookie', `${COOKIE_NAME}=${sessCookie}`)
        .expect(302);

      expect(res.headers.location).toBe('/');
    });

    it('decrypts and clears chunked session cookies on logout', async () => {
      const sessCookie = await makeSessionCookie({
        ...sampleSession,
        at: 'x'.repeat(5000),
      });
      const splitAt = 3800;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Origin', CALLBACK_BASE)
        .set('Cookie', [
          `${COOKIE_NAME}.0=${sessCookie.slice(0, splitAt)}`,
          `${COOKIE_NAME}.1=${sessCookie.slice(splitAt)}`,
        ])
        .expect(302);

      expect(res.headers.location).toBe('/');
      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? (res.headers['set-cookie'] as string[])
        : [res.headers['set-cookie'] as string];
      expect(cookies.find((c) => c.startsWith(`${COOKIE_NAME}.0=`))).toMatch(
        /Max-Age=0/i,
      );
      expect(cookies.find((c) => c.startsWith(`${COOKIE_NAME}.1=`))).toMatch(
        /Max-Age=0/i,
      );
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
