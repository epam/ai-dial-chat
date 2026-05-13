import {
  BadRequestException,
  BadGatewayException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { generators } from 'openid-client';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import type { EnvironmentVariables } from '../config/environment.config';
import { Public } from '../common/decorators/public.decorator';
import { AuthCallbackQueryDto } from './dto/auth-callback.query.dto';
import { ProviderIdParamDto } from './dto/provider-id-param.dto';
import { ProviderRegistryService } from './provider-registry.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import type { SessionPayload, SessionUser } from './session.types';

const TX_COOKIE = '__Host-chat.tx';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly session: SessionService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('providers')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List configured identity providers' })
  @ApiResponse({ status: 200, description: 'Array of provider descriptors' })
  listProviders() {
    return this.registry.listProviders();
  }

  @Get('login/:providerId')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Start OIDC login flow' })
  @ApiResponse({ status: 302, description: 'Redirect to identity provider' })
  @ApiResponse({ status: 404, description: 'Unknown provider' })
  async login(
    @Param() params: ProviderIdParamDto,
    @Res() res: Response,
  ): Promise<void> {
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
    const redirectUri = `${callbackBase}/api/v1/auth/callback/${params.providerId}`;

    const authUrl = client.authorizationUrl({
      redirect_uri: redirectUri,
      scope: providerConfig.scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const txPayload = { state, nonce, codeVerifier, providerId: params.providerId };
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
    });

    res.cookie(TX_COOKIE, txToken, { ...COOKIE_OPTS, maxAge: 600 * 1000 });
    res.redirect(authUrl);
  }

  @Get('callback/:providerId')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'OIDC authorization callback' })
  @ApiResponse({ status: 302, description: 'Redirect to app after login' })
  @ApiResponse({ status: 400, description: 'State mismatch or missing tx cookie' })
  @ApiResponse({ status: 502, description: 'Token exchange failed' })
  async callback(
    @Param() params: ProviderIdParamDto,
    @Query() query: AuthCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const txToken: string | undefined = (req.cookies as Record<string, string>)[TX_COOKIE];
    if (!txToken) {
      throw new BadRequestException('Missing transaction cookie');
    }

    let txData: { state: string; nonce: string; codeVerifier: string; providerId: string };
    try {
      const txPayload = await this.session.decrypt(txToken);
      txData = JSON.parse(txPayload.at) as typeof txData;
    } catch {
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

    const callbackBase = this.config.get('AUTH_CALLBACK_BASE_URL', {
      infer: true,
    });
    const redirectUri = `${callbackBase}/api/v1/auth/callback/${params.providerId}`;

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

    const claims = tokenSet.claims();
    const now = Math.floor(Date.now() / 1000);

    const payload: SessionPayload = {
      v: 1,
      sid: randomUUID(),
      providerId: params.providerId,
      sub: claims.sub,
      at: tokenSet.access_token ?? '',
      rt: tokenSet.refresh_token ?? '',
      at_exp: tokenSet.expires_at ?? now + 3600,
      rt_exp: now + (providerConfig.scope.includes('offline_access') ? 86400 * 30 : 3600),
      iat: now,
      csrf: randomUUID(),
      claims: {
        email: claims.email,
        roles: (claims as Record<string, unknown>)[providerConfig.rolesClaim ?? 'roles'],
        ...(claims as Record<string, unknown>),
      },
    };

    const sessionToken = await this.session.encrypt(payload);
    const cookieName = this.config.get('AUTH_SESSION_COOKIE_NAME', { infer: true }) as string;

    if (Buffer.byteLength(sessionToken) > 3800) {
      this.logger.warn('Session cookie exceeds 3800 bytes; storing rt-only');
    }

    res.cookie(cookieName, sessionToken, {
      ...COOKIE_OPTS,
      maxAge: (payload.rt_exp - now) * 1000,
    });
    res.cookie(TX_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
    res.redirect('/');
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  me(@Req() req: Request) {
    const user = req.user as SessionUser;
    return {
      sub: user.sub,
      providerId: user.providerId,
      claims: user.claims,
    };
  }
}
