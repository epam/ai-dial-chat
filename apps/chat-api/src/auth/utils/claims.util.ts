/**
 * Resolves a dot-notation claim path (e.g. "realm_access.roles") against a
 * claims object. Falls back to a flat key lookup when the path has no dots.
 */
export const resolveClaimPath = (
  claims: Record<string, unknown>,
  path: string,
): unknown => {
  return path
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        value != null && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      claims,
    );
};

/* The roles claim value as a list of role names; anything else holds none. */
export const toRoleList = (rolesValue: unknown): string[] => {
  if (Array.isArray(rolesValue)) {
    return rolesValue.map(String);
  }
  if (typeof rolesValue === 'string') {
    return [rolesValue];
  }
  return [];
};
