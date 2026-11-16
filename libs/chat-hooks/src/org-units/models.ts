import type { OrgUnit } from '@epam/ai-dial-chat-shared';

/** What the host's org-units read resolves to. */
export interface OrgUnitsListResult {
  /** `false` when DIAL Core has org units turned off. */
  enabled: boolean;
  /** The units the current user may see. */
  units: OrgUnit[];
}
