import type {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';

/** Credential status and management context for a catalog item's authentication. */
export interface CatalogItemCredentials {
  /** Authentication mechanism required by the item. */
  authenticationType: ToolsetAuthenticationType;
  /** Sign-in status of the current user's personal (`USER`-level) credentials. */
  userStatus?: CredentialStatus;
  /** Sign-in status of the organization-wide (`GLOBAL`-level) credentials. */
  globalStatus?: CredentialStatus;
  /** Whether the item is shared publicly (affects badge/action wording). Resolved by the app. */
  isPublic?: boolean;
  /** Whether the current user may manage both `USER` and `GLOBAL` credentials (admin on a public item). Resolved by the app. */
  isManageableByAdmin?: boolean;
  /** Name of the API key header, shown as a hint in the login form. Only set for `API_KEY` authentication. */
  apiKeyHeader?: string;
}
