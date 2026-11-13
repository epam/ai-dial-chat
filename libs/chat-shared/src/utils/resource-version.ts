/*
 * Mirror of `RESOURCE_VERSION_PATTERN` in
 * `apps/chat-api/src/common/validators/resource-version.pattern.ts`. The
 * backend is a `type:backend` project and cannot import this library, so the
 * rule is kept in both places and `resource-version-pattern.spec.ts` compares
 * this constant with that file and runs that project's corpus, so the UI never
 * accepts a version the API rejects.
 * A version cannot end with a dot (DIAL Core answers 400 for a path segment
 * ending with `.`), and cannot contain `__` or start with `_`: `__` separates
 * the name from the version in the stored path `{name}__{version}`, which is
 * split at its last occurrence, so such a version would split the versions of
 * one resource into different groups.
 */

/** Accepts a resource version of 1-64 letters, digits, `_`, `.`, `+` or `-` that does not end with a dot, does not contain `__` and does not start with `_`. */
export const RESOURCE_VERSION_PATTERN = /^(?!.*\.$)(?!.*__)(?!_)[\w.+-]{1,64}$/;

/*
 * Mirror of `STORED_RESOURCE_VERSION_PATTERN` in the same API file: the rule
 * for a version that already exists or does not create a path (an update, a
 * publish), so a version stored under the earlier, looser rules still saves
 * unchanged and publishes.
 */

/** Accepts a version of 1-64 letters, digits, `_`, `.`, `+` or `-` that is not made of dots only. */
export const STORED_RESOURCE_VERSION_PATTERN = /^(?!\.+$)[\w.+-]{1,64}$/;
