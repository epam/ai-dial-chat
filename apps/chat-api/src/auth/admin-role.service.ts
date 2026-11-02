import { Injectable } from '@nestjs/common';
import type { SessionUser } from './session/session.types';
import { UserRolesService } from './user-roles.service';

/**
 * The one definition of "administrator" in `chat-api`, shared by
 * `GET /api/v1/auth/me` and every authorization check that grants admins more.
 */
@Injectable()
export class AdminRoleService {
  constructor(private readonly userRoles: UserRolesService) {}

  /**
   * Whether the session user holds one of their provider's `adminRoles`.
   *
   * Admin status is not persisted in the session — computed on each request
   * from the provider's currently configured `adminRoles`, so a config
   * change takes effect without requiring re-login.
   */
  isAdmin(user: SessionUser): boolean {
    const adminRoles = this.userRoles.getProviderConfig(user)?.adminRoles;
    if (!adminRoles?.length) {
      return false;
    }

    return this.userRoles
      .getRoles(user)
      .some((role) => adminRoles.includes(role));
  }
}
