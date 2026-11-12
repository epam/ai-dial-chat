/*
 * Mirror of `RESOURCE_VERSION_PATTERN` in
 * `apps/chat-api/src/common/validators/resource-version.pattern.ts`. The
 * backend is a `type:backend` project and cannot import this library, so the
 * rule is kept in both places and `resource-version-pattern.spec.ts` runs the
 * same corpus against both, so the UI never accepts a version the API rejects.
 * A trailing dot is rejected because DIAL Core answers 400 for a path segment
 * ending with `.`.
 */

/** Accepts a resource version of 1-64 letters, digits, `_`, `.`, `+` or `-` that does not end with a dot. */
export const RESOURCE_VERSION_PATTERN = /^(?!.*\.$)[\w.+-]{1,64}$/;
