import { describe, expect, it } from 'vitest';
import { AdminRoleService } from '../admin-role.service';
import type { ProviderRegistryService } from '../providers/provider-registry.service';
import type { ProviderConfig } from '../providers/provider.types';
import type { SessionUser } from '../session/session.types';

const makeService = (config: Partial<ProviderConfig> | null) => {
  const registry = {
    getProvider: () => {
      if (config == null) {
        throw new Error('Unknown provider');
      }
      return { client: {}, config };
    },
  } as unknown as ProviderRegistryService;
  return new AdminRoleService(registry);
};

const makeUser = (claims: Record<string, unknown>): SessionUser =>
  ({
    sub: 'user-1',
    providerId: 'keycloak',
    claims,
  }) as unknown as SessionUser;

describe('AdminRoleService', () => {
  it('reports an administrator when the roles claim holds an admin role', () => {
    const service = makeService({ adminRoles: ['admin'] });

    expect(service.isAdmin(makeUser({ roles: ['user', 'admin'] }))).toBe(true);
  });

  it('accepts a roles claim stored as a single string', () => {
    const service = makeService({ adminRoles: ['admin'] });

    expect(service.isAdmin(makeUser({ roles: 'admin' }))).toBe(true);
  });

  it('reads the provider-configured roles claim key', () => {
    const service = makeService({
      adminRoles: ['admin'],
      rolesClaim: 'realm_access.roles',
    });

    expect(service.isAdmin(makeUser({ 'realm_access.roles': ['admin'] }))).toBe(
      true,
    );
  });

  it('reports a non-administrator when no role matches', () => {
    const service = makeService({ adminRoles: ['admin'] });

    expect(service.isAdmin(makeUser({ roles: ['user'] }))).toBe(false);
  });

  it('reports a non-administrator when the provider configures no admin roles', () => {
    const service = makeService({});

    expect(service.isAdmin(makeUser({ roles: ['admin'] }))).toBe(false);
  });

  it('reports a non-administrator when the provider is unknown', () => {
    const service = makeService(null);

    expect(service.isAdmin(makeUser({ roles: ['admin'] }))).toBe(false);
  });
});
