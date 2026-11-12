/**
 * Applies a feature's deployment role restriction to the value the provider
 * chain selected. With a non-empty `allowedRoles` list, a caller holding none
 * of those roles (an anonymous caller included) gets `false`; otherwise the
 * selected value is returned unchanged. The gate only ever turns a value off,
 * so no source can bypass it by returning `true`.
 *
 * `allowedRoles` is `undefined` when the feature has no restriction or its
 * roles variable was not set explicitly.
 */
export const applyDeploymentRoleGate = (
  selectedValue: unknown,
  allowedRoles: readonly string[] | undefined,
  callerRoles: readonly string[] | undefined,
): unknown => {
  if (!allowedRoles?.length) {
    return selectedValue;
  }
  const roles = callerRoles ?? [];
  return allowedRoles.some((role) => roles.includes(role))
    ? selectedValue
    : false;
};
