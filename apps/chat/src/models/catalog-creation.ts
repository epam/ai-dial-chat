import type { CatalogCreationType } from '@epam/ai-dial-chat-api-client';
import type { UserConfigStatus } from '../types/user-config-status';

/** Creation decisions derived from the current client-config. */
export interface CatalogCreationPermissions {
  /**
   * Readiness of the decisions: `Loading` while client-config is loading,
   * refetching, or owned by another identity; `Error` when it failed or was
   * malformed. Every decision is `false` unless this is `Ready`.
   */
  status: UserConfigStatus;
  /** Whether the policy lets the user create entities of this type. */
  canCreateType: (type: CatalogCreationType) => boolean;
  /**
   * Whether the policy lets the user create a schema app from this exact
   * schema id: requires the `schema-app` type and no rule denying the id.
   */
  canCreateSchema: (schemaId: string) => boolean;
}

/** What a create flow asks `useCatalogCreationDecision` to check. */
export interface CatalogCreationCheck {
  /** The kind of entity the flow creates. */
  type: CatalogCreationType;
  /** The exact runner schema id; required for `schema-app`, ignored otherwise. */
  schemaId?: string | null;
  /** Host state that keeps the decision pending, e.g. schemas still loading. */
  isPending?: boolean;
  /** Host state that makes creation unavailable, e.g. an unknown schema id. */
  isUnavailable?: boolean;
}
