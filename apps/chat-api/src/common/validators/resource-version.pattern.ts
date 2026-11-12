/*
 * The single rule for a version string a request supplies for an application,
 * a toolset or a publish target: 1-64 characters from letters, digits,
 * underscore, dot, plus and hyphen, not ending with a dot. A trailing dot is
 * rejected because the version ends the last path segment (`{name}__{version}`)
 * and DIAL Core answers 400 for a segment that ends with `.`. The chat
 * frontend mirrors this rule in `@epam/ai-dial-chat-shared`
 * (`RESOURCE_VERSION_PATTERN`) so it rejects the same strings inline; keep the
 * two in sync (both are tested against the same corpus).
 */
export const RESOURCE_VERSION_PATTERN = /^(?!.*\.$)[\w.+-]{1,64}$/;

export const RESOURCE_VERSION_VALIDATION_MESSAGE =
  'Version must be 1-64 characters: letters, digits, underscores, dots, plus signs and hyphens, and it cannot end with a dot';
