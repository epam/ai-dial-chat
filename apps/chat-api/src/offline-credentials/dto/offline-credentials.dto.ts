import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { EnvironmentVariables } from '../../config/environment.config';

/*
 * Allowlisted app-owned OAuth callback paths this endpoint accepts as a
 * `redirectUri`, mirroring `ROUTES.ToolsetSignIn`/`ROUTES.ToolsetEditorCallback`
 * (`apps/chat/src/types/routes.ts`). Kept as a literal list here (rather than
 * importing from `apps/chat`) since `apps/chat-api` must not depend on the
 * frontend app per the library/app isolation rule.
 */
const ALLOWED_REDIRECT_PATHS = [
  '/auth/toolset-signin',
  '/toolset-editor/callback',
];

/*
 * Injectable so it can read `AUTH_CALLBACK_BASE_URL` via `ConfigService`
 * (per `apps/chat-api/AGENTS.md` §7 — no direct `process.env` reads in app
 * code) instead of casting/re-reading the raw env var. Requires
 * `useContainer(app, { fallbackOnErrors: true })` in `main.ts` so
 * class-validator resolves this constraint through Nest's DI container.
 */
@ValidatorConstraint({ name: 'isAllowedRedirectUri', async: false })
@Injectable()
export class IsAllowedRedirectUriConstraint implements ValidatorConstraintInterface {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;

    const baseUrl = this.configService.get('AUTH_CALLBACK_BASE_URL', {
      infer: true,
    });
    if (!baseUrl) return false;

    let candidate: URL;
    let allowedOrigin: URL;
    try {
      candidate = new URL(value);
      allowedOrigin = new URL(baseUrl);
    } catch {
      return false;
    }

    if (candidate.origin !== allowedOrigin.origin) return false;

    return ALLOWED_REDIRECT_PATHS.includes(candidate.pathname);
  }

  defaultMessage(): string {
    return 'redirectUri must be an app-owned callback URL on the configured AUTH_CALLBACK_BASE_URL origin';
  }
}

export class OfflineCredentialsConnectDto {
  @ApiProperty({ example: 'https://identity.example.com/authorize' })
  authorizationEndpoint!: string;

  @ApiProperty({ example: 'dial-chat' })
  clientId!: string;

  @ApiProperty({ example: 'https://chat.example.com/auth/toolset-signin' })
  redirectUri!: string;

  @ApiProperty({ type: [String], example: ['openid', 'offline_access'] })
  scopes!: string[];
}

export class GetOfflineCredentialsResponseDto {
  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({ example: false })
  connected!: boolean;

  @ApiPropertyOptional({ type: OfflineCredentialsConnectDto })
  connect?: OfflineCredentialsConnectDto;
}

export class OfflineCredentialsSigninBodyDto {
  @ApiProperty({ description: 'OAuth authorization code.' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description:
      'OAuth redirect URI used for the code exchange. Must resolve to the ' +
      "configured AUTH_CALLBACK_BASE_URL origin and one of the app's own " +
      'callback paths.',
    example: 'https://chat.example.com/auth/toolset-signin',
  })
  @IsString()
  @IsNotEmpty()
  @Validate(IsAllowedRedirectUriConstraint)
  redirectUri!: string;
}

export class OfflineCredentialsAuthResultDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
