/*
 * Full `skills/{bucket}/{path}` DIAL Core resource URL, the form
 * `parseSkillResourceUrl` accepts and the form the frontend uses as a skill
 * catalog item's id. The bucket segment allows letters, digits, `_`, `.`,
 * and `-`; each path segment also allows spaces. No segment — bucket
 * included — may be `.` or `..`, so a validated value can
 * never carry a traversal into a path or a log line. Trailing slashes are
 * rejected: a skill is an item, never a grouping folder.
 */
export const SKILL_RESOURCE_URL_PATTERN =
  /^skills\/(?!\.{1,2}\/)[\w.-]+\/(?!\.{1,2}(?:\/|$))[a-zA-Z0-9 _.-]+(?:\/(?!\.{1,2}(?:\/|$))[a-zA-Z0-9 _.-]+)*$/;

export const SKILL_RESOURCE_URL_VALIDATION_MESSAGE =
  'id must be a skills/{bucket}/{path} resource URL with safe slash-separated segments and no traversal segments';
