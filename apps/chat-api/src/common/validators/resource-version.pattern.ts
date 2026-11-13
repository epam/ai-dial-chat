/*
 * The rule for a version that creates a path: a new application, a new
 * toolset, a fork or a "Save as new version". 1-64 characters from letters, digits,
 * underscore, dot, plus and hyphen, with three exclusions that come from how
 * the version is stored in the path `{name}__{version}`:
 * - it cannot end with a dot, because DIAL Core answers 400 for a path
 *   segment that ends with `.`;
 * - it cannot contain `__` and cannot start with `_`, because `__` is the
 *   separator between the name and the version and the path is split at its
 *   last occurrence, so such a version would move part of itself into the
 *   name and split the versions of one resource into different groups.
 * The chat frontend mirrors this rule in `@epam/ai-dial-chat-shared`
 * (`RESOURCE_VERSION_PATTERN`) so it rejects the same strings inline; keep the
 * two in sync (the shared-library spec checks the mirror against this file and
 * the corpus below).
 */
export const RESOURCE_VERSION_PATTERN = /^(?!.*\.$)(?!.*__)(?!_)[\w.+-]{1,64}$/;

export const RESOURCE_VERSION_VALIDATION_MESSAGE =
  'Version must be 1-64 characters: letters, digits, underscores, dots, plus signs and hyphens; it cannot end with a dot, contain two underscores in a row, or start with an underscore';

/*
 * The rule for a version that already exists or does not create a path: an
 * update (which rewrites only `displayVersion`; the stored path keeps the
 * version the resource was created with) and a publish (which resends the
 * stored version). It is the previous toolset and publish-target rule, so a
 * version stored under the earlier, looser rules, such as `_beta` or `1__2`,
 * can still be saved unchanged and published. Mirrored in
 * `@epam/ai-dial-chat-shared` as `STORED_RESOURCE_VERSION_PATTERN`.
 */
export const STORED_RESOURCE_VERSION_PATTERN = /^(?!\.+$)[\w.+-]{1,64}$/;

export const STORED_RESOURCE_VERSION_VALIDATION_MESSAGE =
  'Version must be 1-64 characters: letters, digits, underscores, dots, plus signs and hyphens';
