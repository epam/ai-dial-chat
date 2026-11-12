/*
 * The single rule for a version string a request supplies for an application,
 * a toolset or a publish target: 1-64 characters from letters, digits,
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
