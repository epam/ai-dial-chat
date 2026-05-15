import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Issuer, type Client } from 'openid-client';
import type { EnvironmentVariables } from '../../config/environment.config';
import { ProviderConfig } from './provider.types';

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

  async onModuleInit(): Promise<void> {
    const raw = this.config.get('AUTH_PROVIDERS', { infer: true });
    let parsed: unknown[];
    try {
      parsed = JSON.parse(raw) as unknown[];
    } catch {
      throw new Error('AUTH_PROVIDERS is not valid JSON');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AUTH_PROVIDERS must be a non-empty JSON array');
    }

    const providerConfigs = parsed.map((entry) => {
      const providerConfig = plainToInstance(ProviderConfig, entry);
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

  listProviders(): Array<{ id: string; label: string }> {
    return Array.from(this.clients.values()).map(({ config }) => ({
      id: config.id,
      label:
        config.label ?? config.id.charAt(0).toUpperCase() + config.id.slice(1),
    }));
  }
}
