import type { OrgUnit } from '@epam/ai-dial-chat-shared';

/** What the host's org-units read resolves to. */
export interface OrgUnitsListResult {
  /** `false` when DIAL Core has org units turned off. */
  enabled: boolean;
  /** `true` when the current user is a DIAL admin. */
  hasAdminAccess: boolean;
  /** The units the current user may see, each with their permissions. */
  units: OrgUnit[];
}
