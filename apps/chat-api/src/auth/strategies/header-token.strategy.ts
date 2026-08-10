import { createHash } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';
import {
  createRemoteJWKSet,
  decodeJwt,
  errors as joseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import type { EnvironmentVariables } from '../../config/environment.config';
import { AuthSource } from '../auth-source.enum';
import { BucketService } from '../bucket/bucket.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { AuthErrorCode } from '../session/auth-error-code.enum';
import type { SessionUser } from '../session/session.types';
import type { AuthStrategy } from './auth-strategy.interface';

const BUCKET_CACHE_KEY_PREFIX = 'auth:bucket:';

interface CachedJwks {
  getKey: JWTVerifyGetKey;
  createdAt: number;
}

const parseBearerToken = (req: Request): string => {
  const raw = req.headers['authorization'];
  if (Array.isArray(raw)) {
    throw new UnauthorizedException({
      code: AuthErrorCode.HeaderMalformed,
      error: 'Unauthorized',
      message: 'Multiple Authorization headers supplied',
      statusCode: 401,
    });
  }
  const match = raw?.match(/^Bearer (.+)$/);
  const token = match?.[1]?.trim();
  if (!token) {
    throw new UnauthorizedException({
      code: AuthErrorCode.HeaderMalformed,
      error: 'Unauthorized',
      message: 'Authorization header must be "Bearer <token>"',
      statusCode: 401,
    });
  }
  return token;
};

@Injectable()
export class HeaderTokenStrategy implements AuthStrategy {
  readonly source = AuthSource.Header;

  private readonly logger = new Logger(HeaderTokenStrategy.name);
  private readonly jwksByProviderId = new Map<string, CachedJwks>();

  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly bucket: BucketService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  supports(req: Request): boolean {
    if (!this.config.get('AUTH_HEADER_TOKEN_ENABLED', { infer: true })) {
      return false;
    }
    return Boolean(req.headers['authorization']);
  }

  async authenticate(req: Request): Promise<SessionUser> {
    const token = parseBearerToken(req);
    const claims = this.decodeUnverifiedClaims(token);

    const entry = this.registry.findByIssuer(claims.iss);
    const allowedIssuers =
      this.config.get('AUTH_HEADER_TOKEN_ALLOWED_ISSUERS', { infer: true }) ??
      [];
    if (!entry || !allowedIssuers.includes(claims.iss)) {
      throw new UnauthorizedException({
        code: AuthErrorCode.HeaderTokenUntrustedIssuer,
        error: 'Unauthorized',
        message: 'Token issuer is not a trusted, allowlisted provider',
        statusCode: 401,
      });
    }

    const verifiedClaims = await this.verifySignature(
      token,
      entry.config.id,
      entry.client.issuer.metadata['jwks_uri'],
      claims.iss,
    );

    const bucket = await this.resolveBucket(token);

    return {
      sub: String(verifiedClaims.sub ?? ''),
      providerId: entry.config.id,
      claims: verifiedClaims as Record<string, unknown>,
      at: token,
      bucket,
    };
  }

  private decodeUnverifiedClaims(token: string): { iss: string } {
    let claims: Record<string, unknown>;
    try {
      claims = decodeJwt(token);
    } catch {
      throw new UnauthorizedException({
        code: AuthErrorCode.HeaderMalformed,
        error: 'Unauthorized',
        message: 'Authorization bearer token is not a valid JWT',
        statusCode: 401,
      });
    }

    const iss = claims['iss'];
    if (typeof iss !== 'string' || !iss) {
      throw new UnauthorizedException({
        code: AuthErrorCode.HeaderTokenInvalid,
        error: 'Unauthorized',
        message: 'Token is missing an "iss" claim',
        statusCode: 401,
      });
    }
    return { iss };
  }

  private getJwks(providerId: string, jwksUri: string): JWTVerifyGetKey {
    const ttlSeconds =
      this.config.get('AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS', {
        infer: true,
      }) ?? 600;
    const cached = this.jwksByProviderId.get(providerId);
    const now = Date.now();
    if (cached && now - cached.createdAt < ttlSeconds * 1000) {
      return cached.getKey;
    }

    const getKey = createRemoteJWKSet(new URL(jwksUri));
    this.jwksByProviderId.set(providerId, { getKey, createdAt: now });
    return getKey;
  }

  private async verifySignature(
    token: string,
    providerId: string,
    jwksUri: string | undefined,
    issuer: string,
  ): Promise<Record<string, unknown>> {
    if (!jwksUri) {
      throw new UnauthorizedException({
        code: AuthErrorCode.HeaderTokenInvalid,
        error: 'Unauthorized',
        message: 'Provider has no JWKS endpoint to verify against',
        statusCode: 401,
      });
    }

    const clockTolerance = this.config.get(
      'AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS',
      { infer: true },
    );

    try {
      const { payload } = await jwtVerify(
        token,
        this.getJwks(providerId, jwksUri),
        { issuer, clockTolerance },
      );
      return payload;
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        throw new UnauthorizedException({
          code: AuthErrorCode.HeaderTokenExpired,
          error: 'Unauthorized',
          message: 'Bearer token has expired',
          statusCode: 401,
        });
      }
      this.logger.debug(
        `Header token verification failed for provider=${providerId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new UnauthorizedException({
        code: AuthErrorCode.HeaderTokenInvalid,
        error: 'Unauthorized',
        message: 'Bearer token failed signature verification',
        statusCode: 401,
      });
    }
  }

  private async resolveBucket(token: string): Promise<string> {
    const cacheKey = `${BUCKET_CACHE_KEY_PREFIX}${createHash('sha256').update(token).digest('hex')}`;
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached != null) {
      return cached;
    }

    try {
      const { bucket } = await this.bucket.getUserBucket(token);
      const ttlSeconds =
        this.config.get('AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS', {
          infer: true,
        }) ?? 60;
      await this.cacheManager.set(cacheKey, bucket, ttlSeconds * 1000);
      return bucket;
    } catch (err) {
      this.logger.error(
        'Bucket resolution failed for header-authenticated request',
        err,
      );
      throw new ServiceUnavailableException(
        'Unable to resolve user bucket — DIAL Core unavailable',
      );
    }
  }
}
