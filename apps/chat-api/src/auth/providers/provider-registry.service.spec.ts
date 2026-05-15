import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Issuer } from 'openid-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRegistryService } from '../../providers/provider-registry.service';

const VALID_PROVIDER = {
  id: 'keycloak',
  issuer: 'https://keycloak.example.com/realms/test',
  clientId: 'chat-app',
  clientSecret: 'secret',
  scope: 'openid email profile',
  postLogoutRedirectUri: 'https://app.example.com',
};

function buildModule(authProviders: string) {
  return Test.createTestingModule({
    providers: [
      ProviderRegistryService,
      {
        provide: ConfigService,
        useValue: { get: () => authProviders },
      },
    ],
  }).compile();
}

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
    const module = await buildModule(JSON.stringify([VALID_PROVIDER]));
    await module.init();
    const svc = module.get(ProviderRegistryService);
    const entry = svc.getProvider('keycloak');
    expect(entry).toBeDefined();
    expect(entry.client).toBeDefined();
  });

  it('unknown provider id throws NotFoundException', async () => {
    const module = await buildModule(JSON.stringify([VALID_PROVIDER]));
    await module.init();
    const svc = module.get(ProviderRegistryService);
    expect(() => svc.getProvider('unknown')).toThrow(NotFoundException);
  });

  it('malformed AUTH_PROVIDERS JSON throws on init', async () => {
    const module = await buildModule('not-json');
    await expect(module.init()).rejects.toThrow();
  });

  it('structurally invalid entry (missing clientSecret) throws on init via validateSync', async () => {
    const invalid = { ...VALID_PROVIDER, clientSecret: undefined };
    const module = await buildModule(JSON.stringify([invalid]));
    await expect(module.init()).rejects.toThrow();
    expect(discoverSpy).not.toHaveBeenCalled();
  });

  it('provider id violating allowlist regex throws on init', async () => {
    const invalid = { ...VALID_PROVIDER, id: '../traversal' };
    const module = await buildModule(JSON.stringify([invalid]));
    await expect(module.init()).rejects.toThrow();
    expect(discoverSpy).not.toHaveBeenCalled();
  });

  it('listProviders returns registered provider ids', async () => {
    const module = await buildModule(JSON.stringify([VALID_PROVIDER]));
    await module.init();
    const svc = module.get(ProviderRegistryService);
    const list = svc.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('keycloak');
  });

  describe('Auth0-style provider (audience + rolesClaim)', () => {
    const AUTH0_PROVIDER = {
      id: 'auth0',
      issuer: 'https://tenant.auth0.com/',
      clientId: 'auth0-client-id',
      clientSecret: 'auth0-secret',
      scope: 'openid email profile',
      audience: 'https://api.example.com',
      rolesClaim: 'https://example.com/roles',
      postLogoutRedirectUri: 'https://app.example.com',
    };

    it('preserves audience in the stored config', async () => {
      const module = await buildModule(JSON.stringify([AUTH0_PROVIDER]));
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('auth0');
      expect(config.audience).toBe('https://api.example.com');
    });

    it('preserves custom rolesClaim in the stored config', async () => {
      const module = await buildModule(JSON.stringify([AUTH0_PROVIDER]));
      await module.init();
      const svc = module.get(ProviderRegistryService);
      const { config } = svc.getProvider('auth0');
      expect(config.rolesClaim).toBe('https://example.com/roles');
    });

    it('two providers registered simultaneously route independently', async () => {
      const module = await buildModule(
        JSON.stringify([VALID_PROVIDER, AUTH0_PROVIDER]),
      );
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
});
