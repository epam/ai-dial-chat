import { randomUUID } from 'crypto';
import {
  BadRequestException,
  BadGatewayException,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { decodeJwt } from 'jose';
import { generators, type AuthorizationParameters } from 'openid-client';
import { Public } from '../common/decorators/public.decorator';
import type { EnvironmentVariables } from '../config/environment.config';
import {
  ProviderInfoDto,
  UserProfileDto,
} from '../openapi/openapi-response.dto';
import { BucketService } from './bucket/bucket.service';
import {
  clearCookieValue,
  getCookieOptions,
  getSessionCookieName,
  getTransactionCookieName,
  readCookieValue,
  setCookieValue,
} from './cookies/cookie-options';
import { AuthCallbackQueryDto } from './dto/auth-callback.query.dto';
import { LoginQueryDto } from './dto/login-query.dto';
import { ProviderIdParamDto } from './dto/provider-id-param.dto';
import { ProviderRegistryService } from './providers/provider-registry.service';
import type { ProviderConfig } from './providers/provider.types';
import { SessionService } from './session/session.service';
import type { SessionPayload, SessionUser } from './session/session.types';
import { resolveCallbackUrl } from './utils/callback-url.util';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly session: SessionService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly bucketService: BucketService,
  ) {}

  private isOriginAllowed(origin: string): boolean {
    const callbackBase = this.config.get('AUTH_CALLBACK_BASE_URL', {
      infer: true,
    });
    const corsOrigin = this.config.get('CORS_ORIGIN', { infer: true });

    const allowed = new Set<string>([new URL(callbackBase).origin]);
    for (const candidate of (corsOrigin ?? '').split(',')) {
      const trimmed = candidate.trim();
      if (trimmed && trimmed !== '*') {
        try {
          allowed.add(new URL(trimmed).origin);
        } catch {
          /* skip unparseable entries */
        }
      }
    }
    return allowed.has(origin);
  }

  @Get('providers')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List configured identity providers' })
  @ApiResponse({
    status: 200,
    description: 'Array of provider descriptors',
    type: [ProviderInfoDto],
  })
  listProviders() {
    return this.registry.listProviders();
  }

  @Get('login/:providerId')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Start OIDC login flow' })
  @ApiParam({
    name: 'providerId',
    description: 'Configured identity provider ID',
    type: String,
    example: 'local',
  })
  @ApiResponse({ status: 302, description: 'Redirect to identity provider' })
  @ApiResponse({ status: 400, description: 'Unsafe callback URL' })
  @ApiResponse({ status: 404, description: 'Unknown provider' })
  async login(
    @Param() params: ProviderIdParamDto,
    @Query() query: LoginQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.debug(
      `login() start providerId=${params.providerId} callbackUrl=${query.callbackUrl ?? 'none'}`,
    );
    const { client, config: providerConfig } = this.registry.getProvider(
      params.providerId,
    );

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    const callbackBase = this.config.get('AUTH_CALLBACK_BASE_URL', {
      infer: true,
    });
    const corsOrigin = this.config.get('CORS_ORIGIN', { infer: true });
    const redirectUri = `${callbackBase}/api/v1/auth/callback/${params.providerId}`;
    const callbackUrl = resolveCallbackUrl(query.callbackUrl, {
      authCallbackBaseUrl: callbackBase,
      corsOrigin,
    });

    const authorizationParams: AuthorizationParameters = {
      redirect_uri: redirectUri,
      scope: providerConfig.scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...(providerConfig.audience ? { audience: providerConfig.audience } : {}),
    };

    const authUrl = client.authorizationUrl(authorizationParams);

    const txPayload = {
      state,
      nonce,
      codeVerifier,
      providerId: params.providerId,
      callbackUrl,
    };
    const txToken = await this.session.encrypt({
      v: 1,
      sid: randomUUID(),
      providerId: params.providerId,
      sub: '',
      at: JSON.stringify(txPayload),
      rt: '',
      at_exp: Math.floor(Date.now() / 1000) + 600,
      rt_exp: Math.floor(Date.now() / 1000) + 600,
      iat: Math.floor(Date.now() / 1000),
      csrf: randomUUID(),
      claims: {},
      bucket: '',
    });

    this.logger.debug(
      `login() redirecting to IdP redirectUri=${redirectUri} authUrl=${authUrl}`,
    );
    res.cookie(getTransactionCookieName(this.config), txToken, {
      ...getCookieOptions(this.config),
      maxAge: 600 * 1000,
    });
    res.redirect(authUrl);
  }

  @Get('callback/:providerId')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'OIDC authorization callback' })
  @ApiParam({
    name: 'providerId',
    description: 'Configured identity provider ID',
    type: String,
    example: 'local',
  })
  @ApiResponse({ status: 302, description: 'Redirect to app after login' })
  @ApiResponse({
    status: 400,
    description: 'State mismatch or missing tx cookie',
  })
  @ApiResponse({ status: 502, description: 'Token exchange failed' })
  async callback(
    @Param() params: ProviderIdParamDto,
    @Query() query: AuthCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.debug(`callback() start providerId=${params.providerId}`);
    if (query.error) {
      this.logger.warn(
        `IdP returned error for provider=${params.providerId}: ${query.error} - ${query.error_description ?? 'no description'}`,
      );
      throw new BadRequestException(
        `Authentication failed: ${query.error_description ?? query.error}`,
      );
    }

    if (!query.code || !query.state) {
      throw new BadRequestException(
        'Missing required callback parameters (code, state)',
      );
    }

    const txToken: string | undefined = (
      req.cookies as Record<string, string> | undefined
    )?.[getTransactionCookieName(this.config)];
    if (!txToken) {
      throw new BadRequestException('Missing transaction cookie');
    }

    let txData: {
      state: string;
      nonce: string;
      codeVerifier: string;
      providerId: string;
      callbackUrl: string;
    };
    try {
      const txPayload = await this.session.decrypt(txToken);
      if (txPayload.at_exp < Math.floor(Date.now() / 1000)) {
        throw new BadRequestException('Transaction expired');
      }
      txData = JSON.parse(txPayload.at) as typeof txData;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid transaction cookie');
    }

    if (txData.state !== query.state) {
      throw new BadRequestException('State mismatch');
    }

    if (txData.providerId !== params.providerId) {
      throw new BadRequestException('Provider mismatch');
    }

    const { client, config: providerConfig } = this.registry.getProvider(
      params.providerId,
    );

    /*
     * RFC 9207: if the IdP advertises iss in the callback, it MUST match the
     * configured issuer for this provider. Defends against IdP mix-up attacks.
     */
    if (query.iss && query.iss !== providerConfig.issuer) {
      this.logger.warn(
        `Issuer mismatch on callback: expected ${providerConfig.issuer}, got ${query.iss}`,
      );
      throw new BadRequestException('Issuer mismatch');
    }

    const callbackBase = this.config.get('AUTH_CALLBACK_BASE_URL', {
      infer: true,
    });
    const corsOrigin = this.config.get('CORS_ORIGIN', { infer: true });
    const redirectUri = `${callbackBase}/api/v1/auth/callback/${params.providerId}`;
    const callbackUrl = resolveCallbackUrl(txData.callbackUrl, {
      authCallbackBaseUrl: callbackBase,
      corsOrigin,
    });

    this.logger.debug(
      `callback() exchanging code for tokens redirectUri=${redirectUri}`,
    );
    let tokenSet;
    try {
      const params2 = client.callbackParams(req);
      tokenSet = await client.callback(redirectUri, params2, {
        state: txData.state,
        nonce: txData.nonce,
        code_verifier: txData.codeVerifier,
      });
    } catch (err) {
      this.logger.error('Token exchange failed', err);
      throw new BadGatewayException('Token exchange failed');
    }
    this.logger.debug(
      `callback() token exchange succeeded sub=${tokenSet.claims().sub} at_exp=${tokenSet.expires_at ?? 'none'}`,
    );

    const claims = tokenSet.claims();
    const now = Math.floor(Date.now() / 1000);

    /*
     * Only store a defined allowlist of OIDC claims — never spread all claims,
     * which could include sensitive IdP-specific data (phone, address, etc.).
     */
    const ALLOWED_CLAIM_KEYS = new Set([
      'sub',
      'email',
      'email_verified',
      'name',
      'given_name',
      'family_name',
      'middle_name',
      'nickname',
      'preferred_username',
      'picture',
      'locale',
      'zoneinfo',
    ]);
    const allClaims = claims as Record<string, unknown>;
    const filteredClaims: Record<string, unknown> = {};
    for (const key of ALLOWED_CLAIM_KEYS) {
      if (key in allClaims) filteredClaims[key] = allClaims[key];
    }
    /*
     * Roles are typically issued on the access token, not the ID token —
     * decode it (unverified; it came directly from the IdP over TLS, same
     * trust boundary as the ID token) and prefer that as the roles source.
     */
    let accessTokenClaims: Record<string, unknown> = {};
    try {
      accessTokenClaims = tokenSet.access_token
        ? (decodeJwt(tokenSet.access_token) as Record<string, unknown>)
        : {};
    } catch {
      accessTokenClaims = {};
    }

    const rolesClaim = providerConfig.rolesClaim ?? 'roles';
    const rolesClaimValue =
      resolveClaimPath(accessTokenClaims, rolesClaim) ??
      resolveClaimPath(allClaims, rolesClaim);
    if (rolesClaimValue !== undefined) {
      filteredClaims[rolesClaim] = rolesClaimValue;
    }
    this.logger.debug(
      `callback() rolesClaim="${rolesClaim}" resolved=${rolesClaimValue !== undefined}`,
    );

    const accessToken = tokenSet.access_token ?? '';
    let bucket = '';
    try {
      ({ bucket } = await this.bucketService.getUserBucket(accessToken));
    } catch (err) {
      this.logger.warn(
        'Bucket fetch failed during callback — will retry on first authenticated request',
        err,
      );
    }

    const payload: SessionPayload = {
      v: 1,
      sid: randomUUID(),
      providerId: params.providerId,
      sub: claims.sub,
      at: accessToken,
      rt: tokenSet.refresh_token ?? '',
      it: tokenSet.id_token,
      at_exp: tokenSet.expires_at ?? now + 3600,
      rt_exp:
        now +
        (providerConfig.scope.includes('offline_access') ? 86400 * 30 : 3600),
      iat: now,
      csrf: randomUUID(),
      claims: filteredClaims,
      bucket,
    };

    this.logger.debug(
      `callback() session created sid=${payload.sid} sub=${payload.sub} bucket=${payload.bucket || 'empty'} providerId=${payload.providerId}`,
    );

    const sessionToken = await this.session.encrypt(payload);
    const cookieName = getSessionCookieName(this.config);

    setCookieValue(
      res,
      cookieName,
      sessionToken,
      {
        ...getCookieOptions(this.config),
        maxAge: (payload.rt_exp - now) * 1000,
      },
      req.cookies as Record<string, string> | undefined,
    );
    res.cookie(getTransactionCookieName(this.config), '', {
      ...getCookieOptions(this.config),
      maxAge: 0,
    });

    this.logger.debug(
      `callback() done, redirecting to callbackUrl=${callbackUrl}`,
    );
    res.redirect(callbackUrl);
  }

  @Post('logout')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Log out and clear session cookie' })
  @ApiResponse({ status: 302, description: 'Redirect after logout' })
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.logger.debug('logout() start');
    /*
     * Protect against CSRF logout even though this route is @Public().
     * Native HTML form POSTs always carry an Origin header the browser sets.
     */
    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    const candidate =
      origin ?? (referer ? new URL(referer as string).origin : undefined);
    if (!candidate || !this.isOriginAllowed(candidate)) {
      this.logger.debug(
        `logout() blocked: origin check failed candidate=${candidate ?? 'none'}`,
      );
      throw new ForbiddenException('Origin check failed');
    }

    const cookieName = getSessionCookieName(this.config);
    const requestCookies = req.cookies as Record<string, string> | undefined;

    const sessionToken = readCookieValue(requestCookies, cookieName);

    // Clear the session cookie unconditionally so even an expired session can log out.
    clearCookieValue(
      res,
      cookieName,
      getCookieOptions(this.config),
      requestCookies,
    );

    let endSessionUrl: string | undefined;

    if (sessionToken) {
      let payload: SessionPayload | undefined;
      try {
        payload = await this.session.decrypt(sessionToken);
      } catch {
        // Expired or tampered cookie — proceed to plain redirect.
      }

      if (payload) {
        const { client, config: providerConfig } = this.registry.getProvider(
          payload.providerId,
        );

        // Best-effort revocation — do not block logout on failure.
        const revocationEndpoint =
          client.issuer.metadata['revocation_endpoint'];
        if (revocationEndpoint && payload.rt) {
          this.logger.debug(
            `logout() revoking token for sub=${payload.sub} providerId=${payload.providerId}`,
          );
          try {
            await client.revoke(payload.rt);
            this.logger.debug('logout() token revocation succeeded');
          } catch (err) {
            this.logger.warn('Token revocation failed (non-fatal)', err);
          }
        }

        const endSession = client.issuer.metadata['end_session_endpoint'];
        if (endSession) {
          endSessionUrl = client.endSessionUrl({
            post_logout_redirect_uri: providerConfig.postLogoutRedirectUri,
            ...(payload.it ? { id_token_hint: payload.it } : {}),
          });
        }
      }
    }

    this.logger.debug(
      `logout() done, redirecting to endSessionUrl=${endSessionUrl ?? '/'}`,
    );
    res.redirect(endSessionUrl ?? '/');
  }

  @Get('me')
  @ApiCookieAuth('session')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'No valid session' })
  getCurrentUser(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as SessionUser;
    res.setHeader('X-CSRF-Token', user.csrf);
    return {
      sub: user.sub,
      providerId: user.providerId,
      claims: user.claims,
      bucket: user.bucket,
      isAdmin: this.computeIsAdmin(user),
    };
  }

  /**
   * Admin status is not persisted in the session — computed on each request
   * from the provider's currently configured `adminRoles`, so a config
   * change takes effect without requiring re-login.
   */
  private computeIsAdmin(user: SessionUser): boolean {
    let config: ProviderConfig;
    try {
      ({ config } = this.registry.getProvider(user.providerId));
    } catch {
      this.logger.debug(
        `computeIsAdmin() no provider config for providerId=${user.providerId}`,
      );

      return false;
    }

    if (!config.adminRoles?.length) {
      this.logger.debug(
        `computeIsAdmin() providerId=${user.providerId} has no adminRoles configured`,
      );

      return false;
    }

    const rolesClaim = config.rolesClaim ?? 'roles';
    // `user.claims` stores the resolved roles claim under the flat
    // `rolesClaim` key (see callback()) — not as a nested path.
    const rolesValue = user.claims[rolesClaim];
    const roles = Array.isArray(rolesValue)
      ? rolesValue.map(String)
      : typeof rolesValue === 'string'
        ? [rolesValue]
        : [];

    const isAdmin = roles.some((role) => config.adminRoles?.includes(role));
    this.logger.debug(
      `computeIsAdmin() providerId=${user.providerId} rolesClaim="${rolesClaim}" adminRoles=${JSON.stringify(config.adminRoles)} userRoles=${JSON.stringify(roles)} isAdmin=${isAdmin}`,
    );

    return isAdmin;
  }
}

/**
 * Resolves a dot-notation claim path (e.g. "realm_access.roles") against a
 * claims object. Falls back to a flat key lookup when the path has no dots.
 */
const resolveClaimPath = (
  claims: Record<string, unknown>,
  path: string,
): unknown => {
  return path
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        value != null && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      claims,
    );
};
