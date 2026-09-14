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
