/*
 * Fallback display name for a skill url that matches no loaded listing entry
 * (e.g. a skill the current viewer cannot read): its last non-empty
 * `/`-separated segment, so `skills/my-bucket/team-a/docs-helper` shows as
 * `docs-helper`.
 */
export const getSkillFallbackName = (url: string): string => {
  const segments = url.split('/').filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? url;
};

/*
 * The bucket segment of a `skills/{bucket}/{path}` url — the second
 * non-empty `/`-separated segment. Returns `null` for a url that does not
 * start with the `skills/` resource prefix. Used only to compare against the
 * viewer's own bucket when a url is otherwise unresolved; this lib takes
 * that bucket as a plain string parameter and has no auth/user knowledge of
 * its own.
 */
export const getSkillUrlBucket = (url: string): string | null => {
  const segments = url.split('/').filter((segment) => segment.length > 0);
  if (segments[0] !== 'skills' || segments.length < 3) return null;
  return segments[1];
};
