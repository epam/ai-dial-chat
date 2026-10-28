import { describe, expect, it } from 'vitest';
import type { ProviderRegistryService } from '../providers/provider-registry.service';
import type { ProviderConfig } from '../providers/provider.types';
import type { SessionUser } from '../session/session.types';
import { UserRolesService } from '../user-roles.service';

const makeService = (config: Partial<ProviderConfig> | null) => {
  const registry = {
    getProvider: () => {
      if (config == null) {
        throw new Error('Unknown provider');
      }
      return { client: {}, config };
    },
  } as unknown as ProviderRegistryService;
  return new UserRolesService(registry);
};

const makeUser = (claims: Record<string, unknown>): SessionUser =>
  ({
    sub: 'user-1',
    providerId: 'keycloak',
    claims,
  }) as unknown as SessionUser;

describe('UserRolesService', () => {
  it('reads the default dial_roles claim of a cookie session', () => {
    const service = makeService({ rolesClaim: 'dial_roles' });

    expect(service.getRoles(makeUser({ dial_roles: ['R'] }))).toEqual(['R']);
  });

  it('falls back to the roles claim when the provider configures none', () => {
    const service = makeService({});

    expect(
      service.getRoles(makeUser({ roles: ['R'], dial_roles: ['X'] })),
    ).toEqual(['R']);
  });

  it('reads a dotted claim nested in a header-token payload', () => {
    const service = makeService({ rolesClaim: 'realm_access.roles' });

    expect(
      service.getRoles(makeUser({ realm_access: { roles: ['R'] } })),
    ).toEqual(['R']);
  });

  it('prefers the flat key over the nested path', () => {
    const service = makeService({ rolesClaim: 'realm_access.roles' });

    expect(
      service.getRoles(
        makeUser({
          'realm_access.roles': ['A'],
          realm_access: { roles: ['B'] },
        }),
      ),
    ).toEqual(['A']);
  });

  it('keeps a present but empty flat key instead of reading the nested path', () => {
    const service = makeService({ rolesClaim: 'realm_access.roles' });

    expect(
      service.getRoles(
        makeUser({
          'realm_access.roles': [],
          realm_access: { roles: ['B'] },
        }),
      ),
    ).toEqual([]);
  });

  it('turns a string claim into a one-element list', () => {
    const service = makeService({ rolesClaim: 'dial_roles' });

    expect(service.getRoles(makeUser({ dial_roles: 'R' }))).toEqual(['R']);
  });

  it('coerces mixed array entries to strings', () => {
    const service = makeService({ rolesClaim: 'dial_roles' });

    expect(service.getRoles(makeUser({ dial_roles: ['R', 7] }))).toEqual([
      'R',
      '7',
    ]);
  });

  it('returns no roles when the claim is absent', () => {
    const service = makeService({ rolesClaim: 'dial_roles' });

    expect(service.getRoles(makeUser({ roles: ['R'] }))).toEqual([]);
  });

  it('returns no roles for an unknown provider', () => {
    const service = makeService(null);

    expect(service.getRoles(makeUser({ roles: ['R'] }))).toEqual([]);
  });

  it('returns no roles without a session', () => {
    const service = makeService({});

    expect(service.getRoles(undefined)).toEqual([]);
  });
});
