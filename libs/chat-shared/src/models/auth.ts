/** Authenticated user's profile as returned by the identity provider. */
export interface UserProfile {
  /** Subject identifier — unique, stable ID for the user within the provider. */
  sub: string;
  /** ID of the identity provider that authenticated the user. */
  providerId: string;
  /**
   * Allowlisted claims, keyed by claim name. A dot-notation provider
   * `rolesClaim` (e.g. `"realm_access.roles"`) is stored under one flat key
   * equal to that literal string, never as a nested object — look it up
   * with `claims[rolesClaim]`, not a nested path.
   */
  claims: Record<string, unknown>;
  /** DIAL Core storage bucket for the authenticated user. Empty string when the bucket has not been resolved yet. */
  bucket?: string;
  /** Whether the user's roles claim intersects the provider's configured adminRoles. */
  isAdmin: boolean;
}

/** Describes an available identity provider. */
export interface ProviderInfo {
  /** Unique provider identifier used in API calls. */
  id: string;
  /** Human-readable display name shown in the UI. */
  label: string;
}
