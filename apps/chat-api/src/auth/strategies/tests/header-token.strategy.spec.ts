import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
  type KeyLike,
} from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { BucketService } from '../../bucket/bucket.service';
import { ProviderRegistryService } from '../../providers/provider-registry.service';
import { AuthErrorCode } from '../../session/auth-error-code.enum';
import { HeaderTokenStrategy } from '../header-token.strategy';

const jwksRegistry = new Map<string, JWTVerifyGetKey>();

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn((url: URL) => {
      const getKey = jwksRegistry.get(url.toString());
      if (!getKey) {
        throw new Error(`No JWKS registered for ${url.toString()}`);
      }
      return getKey;
    }),
  };
});

const ISSUER = 'https://issuer.example.com';
const JWKS_URI = 'https://issuer.example.com/.well-known/jwks.json';

async function makeToken(
  privateKey: KeyLike,
  kid: string,
  overrides?: { exp?: string; iss?: string; sub?: string },
): Promise<string> {
  return new SignJWT({
    sub: overrides?.sub ?? 'user-1',
    email: 'u@example.com',
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(overrides?.iss ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(overrides?.exp ?? '1h')
    .sign(privateKey);
}

describe('HeaderTokenStrategy', () => {
  let strategy: HeaderTokenStrategy;
  let registry: {
    findByIssuer: ReturnType<typeof vi.fn>;
  };
  let bucketService: { getUserBucket: ReturnType<typeof vi.fn> };
  let cacheManager: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let configValues: Partial<EnvironmentVariables>;
  let privateKey: KeyLike;
  let kid: string;

  beforeEach(async () => {
    jwksRegistry.clear();

    const { publicKey, privateKey: pk } = await generateKeyPair('RS256');
    privateKey = pk;
    kid = 'test-key-1';
    const jwk = await exportJWK(publicKey);
    jwk.kid = kid;
    jwk.alg = 'RS256';
    jwksRegistry.set(JWKS_URI, createLocalJWKSet({ keys: [jwk] }));

    registry = {
      findByIssuer: vi.fn().mockReturnValue({
        client: { issuer: { metadata: { jwks_uri: JWKS_URI } } },
        config: { id: 'keycloak' },
      }),
    };
    bucketService = {
      getUserBucket: vi.fn().mockResolvedValue({ bucket: 'resolved-bucket' }),
    };
    cacheManager = { get: vi.fn().mockResolvedValue(undefined), set: vi.fn() };
    configValues = {
      AUTH_HEADER_TOKEN_ENABLED: true,
      AUTH_HEADER_TOKEN_ALLOWED_ISSUERS: [ISSUER],
      AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS: 30,
      AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS: 600,
      AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS: 60,
    };

    const module = await Test.createTestingModule({
      providers: [
        HeaderTokenStrategy,
        { provide: ProviderRegistryService, useValue: registry },
        { provide: BucketService, useValue: bucketService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              configValues[key as keyof EnvironmentVariables],
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    strategy = module.get(HeaderTokenStrategy);
  });

  const makeReq = (
    headers: Record<string, string | string[] | undefined>,
  ): Request => ({ headers }) as unknown as Request;

  describe('supports()', () => {
    it('returns false when the feature flag is disabled', () => {
      configValues.AUTH_HEADER_TOKEN_ENABLED = false;
      const req = makeReq({ authorization: 'Bearer x' });
      expect(strategy.supports(req)).toBe(false);
    });

    it('returns false when no Authorization header is present', () => {
      expect(strategy.supports(makeReq({}))).toBe(false);
    });

    it('returns true when enabled and an Authorization header is present', () => {
      const req = makeReq({ authorization: 'Bearer x' });
      expect(strategy.supports(req)).toBe(true);
    });
  });

  describe('authenticate()', () => {
    it('authenticates a valid token from a registered, allowlisted issuer', async () => {
      const token = await makeToken(privateKey, kid);
      const req = makeReq({ authorization: `Bearer ${token}` });

      const user = await strategy.authenticate(req, {} as never);

      expect(user).toMatchObject({
        sub: 'user-1',
        providerId: 'keycloak',
        at: token,
        bucket: 'resolved-bucket',
      });
      expect(user?.sid).toBeUndefined();
      expect(user?.csrf).toBeUndefined();
    });

    it('rejects an expired token with AUTH_HEADER_TOKEN_EXPIRED', async () => {
      const token = await makeToken(privateKey, kid, { exp: '-1h' });
      const req = makeReq({ authorization: `Bearer ${token}` });

      let error: unknown;
      try {
        await strategy.authenticate(req, {} as never);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: AuthErrorCode.HeaderTokenExpired,
        statusCode: 401,
      });
    });

    it('rejects a token with an invalid signature', async () => {
      const { privateKey: otherKey } = await generateKeyPair('RS256');
      const token = await makeToken(otherKey, kid); // signed with a key not in the JWKS
      const req = makeReq({ authorization: `Bearer ${token}` });

      let error: unknown;
      try {
        await strategy.authenticate(req, {} as never);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: AuthErrorCode.HeaderTokenInvalid,
        statusCode: 401,
      });
    });

    it('rejects a token from an issuer that is not on the allowlist', async () => {
      configValues.AUTH_HEADER_TOKEN_ALLOWED_ISSUERS = [
        'https://someone-else.example.com',
      ];
      const token = await makeToken(privateKey, kid);
      const req = makeReq({ authorization: `Bearer ${token}` });

      let error: unknown;
      try {
        await strategy.authenticate(req, {} as never);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: AuthErrorCode.HeaderTokenUntrustedIssuer,
        statusCode: 401,
      });
    });

    it('rejects a token from an issuer with no registered provider', async () => {
      registry.findByIssuer.mockReturnValue(undefined);
      const token = await makeToken(privateKey, kid);
      const req = makeReq({ authorization: `Bearer ${token}` });

      await expect(
        strategy.authenticate(req, {} as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: AuthErrorCode.HeaderTokenUntrustedIssuer,
        }),
      });
    });

    it.each([
      ['no scheme prefix', 'sometoken'],
      ['wrong scheme', 'Basic sometoken'],
      ['empty token', 'Bearer '],
    ])(
      'rejects a malformed Authorization header (%s)',
      async (_label, headerValue) => {
        const req = makeReq({ authorization: headerValue });

        let error: unknown;
        try {
          await strategy.authenticate(req, {} as never);
        } catch (caught) {
          error = caught;
        }

        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).getResponse()).toMatchObject({
          code: AuthErrorCode.HeaderMalformed,
          statusCode: 401,
        });
      },
    );

    it('rejects multiple Authorization header values', async () => {
      const req = makeReq({ authorization: ['Bearer a', 'Bearer b'] });

      let error: unknown;
      try {
        await strategy.authenticate(req, {} as never);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: AuthErrorCode.HeaderMalformed,
      });
    });
  });

  describe('JWKS caching', () => {
    it('fetches the JWKS at most once per provider within the cache TTL', async () => {
      const { createRemoteJWKSet } = await import('jose');
      vi.mocked(createRemoteJWKSet).mockClear();
      const token = await makeToken(privateKey, kid);

      await strategy.authenticate(
        makeReq({ authorization: `Bearer ${token}` }),
        {} as never,
      );
      await strategy.authenticate(
        makeReq({ authorization: `Bearer ${token}` }),
        {} as never,
      );

      expect(vi.mocked(createRemoteJWKSet)).toHaveBeenCalledTimes(1);
    });
  });

  describe('bucket resolution', () => {
    it('resolves and caches the bucket on a cache miss', async () => {
      const token = await makeToken(privateKey, kid);
      await strategy.authenticate(
        makeReq({ authorization: `Bearer ${token}` }),
        {} as never,
      );

      expect(bucketService.getUserBucket).toHaveBeenCalledWith(token);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:bucket:[0-9a-f]{64}$/),
        'resolved-bucket',
        60 * 1000,
      );
    });

    it('uses the cached bucket and skips BucketService on a cache hit', async () => {
      cacheManager.get.mockResolvedValue('cached-bucket');
      const token = await makeToken(privateKey, kid);
      const user = await strategy.authenticate(
        makeReq({ authorization: `Bearer ${token}` }),
        {} as never,
      );

      expect(bucketService.getUserBucket).not.toHaveBeenCalled();
      expect(user?.bucket).toBe('cached-bucket');
    });

    it('throws ServiceUnavailableException when DIAL Core is unavailable and no cache entry exists', async () => {
      bucketService.getUserBucket.mockRejectedValue(
        new Error('DIAL Core down'),
      );
      const token = await makeToken(privateKey, kid);

      await expect(
        strategy.authenticate(
          makeReq({ authorization: `Bearer ${token}` }),
          {} as never,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
