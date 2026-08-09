import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateSync } from 'class-validator';
import { Issuer, type Client } from 'openid-client';
import type { EnvironmentVariables } from '../../config/environment.config';
import { buildProviderConfigs } from './provider-builders';
import { ProviderConfig } from './provider.types';

const PROVIDER_ENV_KEYS = [
  'AUTH_POST_LOGOUT_REDIRECT_URI',
  'ADMIN_ROLE_NAMES',
  'DIAL_ROLES_FIELD',
  'AUTH_AUTH0_CLIENT_ID',
  'AUTH_AUTH0_SECRET',
  'AUTH_AUTH0_HOST',
  'AUTH_AUTH0_AUDIENCE',
  'AUTH_AUTH0_NAME',
  'AUTH_AUTH0_SCOPE',
  'AUTH_AUTH0_ADMIN_ROLE_NAMES',
  'AUTH_AUTH0_DIAL_ROLES_FIELD',
  'AUTH_AZURE_AD_CLIENT_ID',
  'AUTH_AZURE_AD_SECRET',
  'AUTH_AZURE_AD_TENANT_ID',
  'AUTH_AZURE_AD_NAME',
  'AUTH_AZURE_AD_SCOPE',
  'AUTH_AZURE_AD_ADMIN_ROLE_NAMES',
  'AUTH_AZURE_AD_DIAL_ROLES_FIELD',
  'AUTH_AZURE_B2C_TENANT_ID',
  'AUTH_AZURE_B2C_CLIENT_ID',
  'AUTH_AZURE_B2C_CLIENT_SECRET',
  'AUTH_AZURE_B2C_USER_FLOW',
  'AUTH_AZURE_B2C_ISSUER',
  'AUTH_AZURE_B2C_NAME',
  'AUTH_AZURE_B2C_SCOPE',
  'AUTH_AZURE_B2C_ADMIN_ROLE_NAMES',
  'AUTH_AZURE_B2C_DIAL_ROLES_FIELD',
  'AUTH_GITLAB_CLIENT_ID',
  'AUTH_GITLAB_SECRET',
  'AUTH_GITLAB_HOST',
  'AUTH_GITLAB_NAME',
  'AUTH_GITLAB_SCOPE',
  'AUTH_GITLAB_ADMIN_ROLE_NAMES',
  'AUTH_GITLAB_DIAL_ROLES_FIELD',
  'AUTH_GOOGLE_CLIENT_ID',
  'AUTH_GOOGLE_SECRET',
  'AUTH_GOOGLE_NAME',
  'AUTH_GOOGLE_SCOPE',
  'AUTH_KEYCLOAK_CLIENT_ID',
  'AUTH_KEYCLOAK_SECRET',
  'AUTH_KEYCLOAK_HOST',
  'AUTH_KEYCLOAK_NAME',
  'AUTH_KEYCLOAK_SCOPE',
  'AUTH_KEYCLOAK_ADMIN_ROLE_NAMES',
  'AUTH_KEYCLOAK_DIAL_ROLES_FIELD',
  'AUTH_PING_ID_CLIENT_ID',
  'AUTH_PING_ID_SECRET',
  'AUTH_PING_ID_HOST',
  'AUTH_PING_ID_NAME',
  'AUTH_PING_ID_SCOPE',
  'AUTH_PING_ID_ADMIN_ROLE_NAMES',
  'AUTH_PING_ID_DIAL_ROLES_FIELD',
  'AUTH_COGNITO_CLIENT_ID',
  'AUTH_COGNITO_SECRET',
  'AUTH_COGNITO_HOST',
  'AUTH_COGNITO_NAME',
  'AUTH_COGNITO_SCOPE',
  'AUTH_COGNITO_ADMIN_ROLE_NAMES',
  'AUTH_COGNITO_DIAL_ROLES_FIELD',
  'AUTH_OKTA_CLIENT_ID',
  'AUTH_OKTA_CLIENT_SECRET',
  'AUTH_OKTA_ISSUER',
  'AUTH_OKTA_NAME',
  'AUTH_OKTA_SCOPE',
  'AUTH_OKTA_ADMIN_ROLE_NAMES',
  'AUTH_OKTA_DIAL_ROLES_FIELD',
] as const satisfies readonly (keyof EnvironmentVariables)[];

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly clients = new Map<
    string,
    { client: Client; config: ProviderConfig }
  >();

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private readProviderEnv(): EnvironmentVariables {
    const env = {} as EnvironmentVariables;
    for (const key of PROVIDER_ENV_KEYS) {
      env[key] = this.config.get(key, { infer: true }) as never;
    }
    return env;
  }

  async onModuleInit(): Promise<void> {
    this.validateHeaderTokenConfig();

    const env = this.readProviderEnv();

    const rawProviderConfigs = buildProviderConfigs(env);

    const providerConfigs = rawProviderConfigs.map((providerConfig) => {
      const errors = validateSync(providerConfig, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });
      if (errors.length > 0) {
        throw new Error(
          `Invalid provider config: ${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ')}`,
        );
      }
      return providerConfig;
    });

    await Promise.all(
      providerConfigs.map(async (providerConfig) => {
        this.logger.log(
          `Discovering OIDC metadata for provider: ${providerConfig.id}`,
        );
        const issuer = await Issuer.discover(providerConfig.issuer);
        const client = new issuer.Client({
          client_id: providerConfig.clientId,
          client_secret: providerConfig.clientSecret,
          redirect_uris: [],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_basic',
        });
        this.clients.set(providerConfig.id, { client, config: providerConfig });
        this.logger.log(`Provider ${providerConfig.id} registered`);
      }),
    );
  }

  getProvider(id: string): { client: Client; config: ProviderConfig } {
    const entry = this.clients.get(id);
    if (!entry) {
      throw new NotFoundException(`Unknown provider: ${id}`);
    }
    return entry;
  }

  /**
   * Finds the registered provider whose OIDC issuer matches `issuer` exactly.
   * Used by header bearer-token verification to resolve the provider whose
   * JWKS should validate a token's signature (see `HeaderTokenStrategy`).
   */
  findByIssuer(
    issuer: string,
  ): { client: Client; config: ProviderConfig } | undefined {
    return Array.from(this.clients.values()).find(
      (entry) => entry.config.issuer === issuer,
    );
  }

  listProviders(): Array<{ id: string; label: string }> {
    return Array.from(this.clients.values()).map(({ config }) => ({
      id: config.id,
      label: config.label ?? config.id,
    }));
  }

  /**
   * Enabling header bearer-token auth widens the BFF's trust boundary and
   * bypasses CSRF (see design.md Decision 8) — an explicit issuer allowlist
   * is mandatory whenever the feature flag is on, so boot fails loudly
   * instead of silently trusting every registered provider's issuer.
   */
  private validateHeaderTokenConfig(): void {
    const enabled = this.config.get('AUTH_HEADER_TOKEN_ENABLED', {
      infer: true,
    });
    if (!enabled) {
      return;
    }

    const allowedIssuers = this.config.get(
      'AUTH_HEADER_TOKEN_ALLOWED_ISSUERS',
      {
        infer: true,
      },
    );
    if (!allowedIssuers || allowedIssuers.length === 0) {
      throw new Error(
        'AUTH_HEADER_TOKEN_ALLOWED_ISSUERS must be set to a non-empty, comma-separated list of trusted issuers when AUTH_HEADER_TOKEN_ENABLED=true',
      );
    }
  }
}
