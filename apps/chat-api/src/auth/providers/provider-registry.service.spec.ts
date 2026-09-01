import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Issuer } from 'openid-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRegistryService } from './provider-registry.service';

const BASE_ENV: Record<string, unknown> = {
  AUTH_POST_LOGOUT_REDIRECT_URI: 'https://app.example.com',
};

const KEYCLOAK_ENV = {
  AUTH_KEYCLOAK_CLIENT_ID: 'chat-app',
  AUTH_KEYCLOAK_SECRET: 'secret',
  AUTH_KEYCLOAK_HOST: 'keycloak.example.com/realms/test',
  AUTH_KEYCLOAK_SCOPE: 'openid email profile',
};

const AUTH0_ENV = {
  AUTH_AUTH0_CLIENT_ID: 'auth0-client-id',
  AUTH_AUTH0_SECRET: 'auth0-secret',
  AUTH_AUTH0_HOST: 'tenant.auth0.com',
  AUTH_AUTH0_AUDIENCE: 'https://api.example.com',
  AUTH_AUTH0_DIAL_ROLES_FIELD: 'https://example.com/roles',
};

const buildModule = (env: Record<string, unknown>) => {
  const merged = { ...BASE_ENV, ...env };
  return Test.createTestingModule({
    providers: [
      ProviderRegistryService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => merged[key] },
      },
    ],
  }).compile();
};

describe('ProviderRegistryService', () => {
  let discoverSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    discoverSpy = vi.spyOn(Issuer, 'discover').mockResolvedValue({
      Client: class {},
      metadata: {},
    } as unknown as Issuer<never>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('known provider id returns a Client', async () => {
    const module = await buildModule(KEYCLOAK_ENV);
    await module.init();
    const svc = module.get(ProviderRegistryService);
    const entry = svc.getProvider('keycloak');
    expect(entry).toBeDefined();
    expect(entry.client).toBeDefined();
  });

  it('unknown provider id throws NotFoundException', async () => {
    const module = await buildModule(KEYCLOAK_ENV);
    await module.init();
    const svc = module.get(ProviderRegistryService);
    expect(() => svc.getProvider('unknown')).toThrow(NotFoundException);
  });

  it('unconfigured provider is skipped without error', async () => {
    const module = await buildModule(KEYCLOAK_ENV);
    await module.init();
    const svc = module.get(ProviderRegistryService);
    expect(() => svc.getProvider('okta')).toThrow(NotFoundException);
  });

  it('missing secret for a configured provider throws on init', async () => {
    const module = await buildModule({
      ...KEYCLOAK_ENV,
      AUTH_KEYCLOAK_SECRET: undefined,
    });
    await expect(module.init()).rejects.toThrow(
      /AUTH_KEYCLOAK_SECRET is missing/,
    );
    expect(discoverSpy).not.toHaveBeenCalled();
  });

  it('missing host for a configured provider throws on init', async () => {
    const module = await buildModule({
      ...KEYCLOAK_ENV,
      AUTH_KEYCLOAK_HOST: undefined,
    });
    await expect(module.init()).rejects.toThrow(
      /AUTH_KEYCLOAK_HOST is missing/,
    );
    expect(discoverSpy).not.toHaveBeenCalled();
  });

  it('missing AUTH_POST_LOGOUT_REDIRECT_URI throws on init when a provider is configured', async () => {
    const module = await buildModule({
      ...KEYCLOAK_ENV,
      AUTH_POST_LOGOUT_REDIRECT_URI: undefined,
    });
    await expect(module.init()).rejects.toThrow(
      /AUTH_POST_LOGOUT_REDIRECT_URI is missing/,
    );
  });

  it('listProviders returns registered provider ids', async () => {
    const module = await buildModule(KEYCLOAK_ENV);
    await module.init();
    const svc = module.get(ProviderRegistryService);
    const list = svc.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('keycloak');
  });

  it('applies AUTH_POST_LOGOUT_REDIRECT_URI to every configured provider', async () => {
    const module = await buildModule({ ...KEYCLOAK_ENV, ...AUTH0_ENV });
    await module.init();
    const svc = module.get(ProviderRegistryService);
    expect(svc.getProvider('keycloak').config.postLogoutRedirectUri).toBe(
      'https://app.example.com',
    );
    expect(svc.getProvider('auth0').config.postLogoutRedirectUri).toBe(
      'https://app.example.com',
    );
  });

  describe('Auth0-style provider (audience + rolesClaim)', () => {
    it('derives the issuer from AUTH_AUTH0_HOST', async () => {
      const module = await buildModule(AUTH0_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('auth0');
      expect(config.issuer).toBe('https://tenant.auth0.com/');
    });

    it('preserves audience in the stored config', async () => {
      const module = await buildModule(AUTH0_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('auth0');
      expect(config.audience).toBe('https://api.example.com');
    });

    it('preserves custom rolesClaim in the stored config', async () => {
      const module = await buildModule(AUTH0_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('auth0');
      expect(config.rolesClaim).toBe('https://example.com/roles');
    });

    it('falls back to the default scope when AUTH_AUTH0_SCOPE is unset', async () => {
      const module = await buildModule(AUTH0_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('auth0');
      expect(config.scope).toBe('openid email profile offline_access');
    });

    it('falls back to the default label when AUTH_AUTH0_NAME is unset', async () => {
      const module = await buildModule(AUTH0_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const list = svc.listProviders();
      expect(list[0].label).toBe('Auth0');
    });

    it('two providers registered simultaneously route independently', async () => {
      const module = await buildModule({ ...KEYCLOAK_ENV, ...AUTH0_ENV });
      await module.init();
      const svc = module.get(ProviderRegistryService);

      const keycloak = svc.getProvider('keycloak');
      const auth0 = svc.getProvider('auth0');

      expect(keycloak.config.id).toBe('keycloak');
      expect(auth0.config.id).toBe('auth0');
      expect(keycloak.client).not.toBe(auth0.client);
      expect(discoverSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Azure B2C issuer derivation', () => {
    const AZURE_B2C_ENV = {
      AUTH_AZURE_B2C_CLIENT_ID: 'b2c-client',
      AUTH_AZURE_B2C_CLIENT_SECRET: 'b2c-secret',
      AUTH_AZURE_B2C_TENANT_ID: 'acme',
      AUTH_AZURE_B2C_USER_FLOW: 'B2C_1_signupsignin',
    };

    it('derives the issuer from tenantId/userFlow when AUTH_AZURE_B2C_ISSUER is unset', async () => {
      const module = await buildModule(AZURE_B2C_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('azure-b2c');
      expect(config.issuer).toBe(
        'https://acme.b2clogin.com/acme.onmicrosoft.com/B2C_1_signupsignin/v2.0',
      );
    });

    it('uses AUTH_AZURE_B2C_ISSUER directly when set', async () => {
      const module = await buildModule({
        ...AZURE_B2C_ENV,
        AUTH_AZURE_B2C_ISSUER: 'https://custom.example.com/b2c',
      });
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('azure-b2c');
      expect(config.issuer).toBe('https://custom.example.com/b2c');
    });
  });

  describe('Okta direct issuer', () => {
    it('reads the issuer directly from AUTH_OKTA_ISSUER', async () => {
      const module = await buildModule({
        AUTH_OKTA_CLIENT_ID: 'okta-client',
        AUTH_OKTA_CLIENT_SECRET: 'okta-secret',
        AUTH_OKTA_ISSUER: 'https://dev-123.okta.com/oauth2/default',
      });
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('okta');
      expect(config.issuer).toBe('https://dev-123.okta.com/oauth2/default');
    });
  });

  describe('admin roles fallback chain', () => {
    it('provider-specific admin roles override the app-wide default', async () => {
      const module = await buildModule({
        ...KEYCLOAK_ENV,
        ADMIN_ROLE_NAMES: ['admin'],
        AUTH_KEYCLOAK_ADMIN_ROLE_NAMES: ['super-admin', 'admin'],
      });
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('keycloak');
      expect(config.adminRoles).toEqual(['super-admin', 'admin']);
    });

    it('falls back to the app-wide admin roles when no override is set', async () => {
      const module = await buildModule({
        AUTH_GOOGLE_CLIENT_ID: 'google-client',
        AUTH_GOOGLE_SECRET: 'google-secret',
        ADMIN_ROLE_NAMES: ['admin'],
      });
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('google');
      expect(config.adminRoles).toEqual(['admin']);
    });

    it('falls back to the app-wide roles claim when no override is set', async () => {
      const module = await buildModule({
        ...KEYCLOAK_ENV,
        DIAL_ROLES_FIELD: 'dial_roles',
      });
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('keycloak');
      expect(config.rolesClaim).toBe('dial_roles');
    });
  });

  describe('findByIssuer', () => {
    const AZURE_AD_ENV = {
      AUTH_AZURE_AD_CLIENT_ID: 'azure-client',
      AUTH_AZURE_AD_SECRET: 'azure-secret',
      AUTH_AZURE_AD_TENANT_ID: 'tenant-123',
    };

    it('matches a non-Azure-AD provider by exact issuer', async () => {
      const module = await buildModule(KEYCLOAK_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('keycloak');
      // eslint-disable-next-line testing-library/await-async-queries -- ProviderRegistryService.findByIssuer is synchronous, not an async testing-library query
      const entry = svc.findByIssuer(config.issuer);
      expect(entry?.config.id).toBe('keycloak');
    });

    it('resolves an Azure AD v1 issuer to the registered v2 provider for the same tenant', async () => {
      const module = await buildModule(AZURE_AD_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      // eslint-disable-next-line testing-library/await-async-queries -- ProviderRegistryService.findByIssuer is synchronous, not an async testing-library query
      const entry = svc.findByIssuer('https://sts.windows.net/tenant-123/');
      expect(entry?.config.id).toBe('azure-ad');
      expect(entry?.config.issuer).toBe(
        'https://login.microsoftonline.com/tenant-123/v2.0',
      );
    });

    it('does not match a v1 issuer for a different tenant than the registered v2 provider', async () => {
      const module = await buildModule(AZURE_AD_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      // eslint-disable-next-line testing-library/await-async-queries -- ProviderRegistryService.findByIssuer is synchronous, not an async testing-library query
      const entry = svc.findByIssuer('https://sts.windows.net/other-tenant/');
      expect(entry).toBeUndefined();
    });

    it('returns undefined for a v1 issuer when no Azure AD provider is registered', async () => {
      const module = await buildModule(KEYCLOAK_ENV);
      await module.init();
      const svc = module.get(ProviderRegistryService);
      // eslint-disable-next-line testing-library/await-async-queries -- ProviderRegistryService.findByIssuer is synchronous, not an async testing-library query
      const entry = svc.findByIssuer('https://sts.windows.net/tenant-123/');
      expect(entry).toBeUndefined();
    });
  });

  describe('issuer derivation from host variables', () => {
    const issuerOf = async (env: Record<string, unknown>, id: string) => {
      const module = await buildModule(env);
      await module.init();
      return module.get(ProviderRegistryService).getProvider(id).config.issuer;
    };

    it('prefixes https:// when the host carries no scheme', async () => {
      await expect(issuerOf(KEYCLOAK_ENV, 'keycloak')).resolves.toBe(
        'https://keycloak.example.com/realms/test',
      );
    });

    it('preserves an explicit https:// URL instead of prefixing it again', async () => {
      await expect(
        issuerOf(
          {
            ...KEYCLOAK_ENV,
            AUTH_KEYCLOAK_HOST: 'https://keycloak.example.com/realms/test',
          },
          'keycloak',
        ),
      ).resolves.toBe('https://keycloak.example.com/realms/test');
    });

    it('preserves an explicit http:// URL for a provider without TLS', async () => {
      await expect(
        issuerOf(
          {
            ...KEYCLOAK_ENV,
            AUTH_KEYCLOAK_HOST: 'http://keycloak.internal:8080/realms/test',
          },
          'keycloak',
        ),
      ).resolves.toBe('http://keycloak.internal:8080/realms/test');
    });

    it('strips a trailing slash from the configured URL', async () => {
      await expect(
        issuerOf(
          {
            ...KEYCLOAK_ENV,
            AUTH_KEYCLOAK_HOST: 'https://keycloak.example.com/realms/test/',
          },
          'keycloak',
        ),
      ).resolves.toBe('https://keycloak.example.com/realms/test');
    });

    it('keeps exactly one trailing slash on the Auth0 issuer given a full URL', async () => {
      await expect(
        issuerOf(
          { ...AUTH0_ENV, AUTH_AUTH0_HOST: 'https://tenant.auth0.com/' },
          'auth0',
        ),
      ).resolves.toBe('https://tenant.auth0.com/');
    });

    it('fails boot when the host uses a non-http(s) scheme', async () => {
      const module = await buildModule({
        ...KEYCLOAK_ENV,
        AUTH_KEYCLOAK_HOST: 'ftp://keycloak.example.com/realms/test',
      });
      await expect(module.init()).rejects.toThrow(
        /AUTH_KEYCLOAK_HOST must be a bare host or an http/,
      );
    });
  });

  describe('header-token auth config validation', () => {
    it('boots successfully when the feature is disabled (default) and no allowlist is set', async () => {
      const module = await buildModule({});
      await expect(module.init()).resolves.toBeDefined();
    });

    it('boots successfully when enabled with a non-empty issuer allowlist', async () => {
      const module = await buildModule({
        AUTH_HEADER_TOKEN_ENABLED: true,
        AUTH_HEADER_TOKEN_ALLOWED_ISSUERS: ['https://accounts.google.com'],
      });
      await expect(module.init()).resolves.toBeDefined();
    });

    it('fails boot naming AUTH_HEADER_TOKEN_ALLOWED_ISSUERS when enabled without an allowlist', async () => {
      const module = await buildModule({ AUTH_HEADER_TOKEN_ENABLED: true });
      await expect(module.init()).rejects.toThrow(
        /AUTH_HEADER_TOKEN_ALLOWED_ISSUERS/,
      );
    });
  });
});
