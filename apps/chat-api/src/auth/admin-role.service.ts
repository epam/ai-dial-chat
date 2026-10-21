import { Injectable } from '@nestjs/common';
import { ProviderRegistryService } from './providers/provider-registry.service';
import type { ProviderConfig } from './providers/provider.types';
import type { SessionUser } from './session/session.types';

/* The roles claim value as a list of role names; anything else holds none. */
const toRoleList = (rolesValue: unknown): string[] => {
  if (Array.isArray(rolesValue)) {
    return rolesValue.map(String);
  }
  if (typeof rolesValue === 'string') {
    return [rolesValue];
  }
  return [];
};

/**
 * The one definition of "administrator" in `chat-api`, shared by
 * `GET /api/v1/auth/me` and every authorization check that grants admins more.
 */
@Injectable()
export class AdminRoleService {
  constructor(private readonly registry: ProviderRegistryService) {}

  /**
   * Whether the session user holds one of their provider's `adminRoles`.
   *
   * Admin status is not persisted in the session — computed on each request
   * from the provider's currently configured `adminRoles`, so a config
   * change takes effect without requiring re-login.
   */
  isAdmin(user: SessionUser): boolean {
    let config: ProviderConfig;
    try {
      ({ config } = this.registry.getProvider(user.providerId));
    } catch {
      return false;
    }

    if (!config.adminRoles?.length) {
      return false;
    }

    const rolesClaim = config.rolesClaim ?? 'roles';
    /* `user.claims` stores the resolved roles claim under the flat
     * `rolesClaim` key (see AuthController.callback()) — not as a nested path. */
    const roles = toRoleList(user.claims[rolesClaim]);

    return roles.some((role) => config.adminRoles?.includes(role));
  }
}
