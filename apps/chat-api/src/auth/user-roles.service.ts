import { Injectable } from '@nestjs/common';
import { ProviderRegistryService } from './providers/provider-registry.service';
import type { ProviderConfig } from './providers/provider.types';
import type { SessionUser } from './session/session.types';
import { resolveClaimPath, toRoleList } from './utils/claims.util';

const DEFAULT_ROLES_CLAIM = 'roles';

/**
 * The one place in `chat-api` that turns a session user into role names, so
 * admin detection, feature gates, and client-config agree on a user's roles.
 */
@Injectable()
export class UserRolesService {
  constructor(private readonly registry: ProviderRegistryService) {}

  /**
   * The session user's roles, read through their provider's `rolesClaim`.
   *
   * Returns `[]` with no session or for a provider the registry does not know.
   */
  getRoles(user: SessionUser | undefined): string[] {
    const config = this.getProviderConfig(user);
    if (!user || !config) {
      return [];
    }

    const rolesClaim = config.rolesClaim ?? DEFAULT_ROLES_CLAIM;
    /* A cookie session stores the resolved claim under the flat `rolesClaim`
     * key (see AuthController.callback()); a header-token session keeps the
     * verified payload as-is, so a dotted claim is still nested there. */
    const rolesValue =
      rolesClaim in user.claims
        ? user.claims[rolesClaim]
        : resolveClaimPath(user.claims, rolesClaim);

    return toRoleList(rolesValue);
  }

  /** The session user's provider config, or `undefined` when it cannot be resolved. */
  getProviderConfig(user: SessionUser | undefined): ProviderConfig | undefined {
    if (!user) {
      return undefined;
    }
    try {
      return this.registry.getProvider(user.providerId).config;
    } catch {
      return undefined;
    }
  }
}
