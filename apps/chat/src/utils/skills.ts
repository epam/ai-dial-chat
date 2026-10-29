import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { normalizeDeploymentId } from '@epam/ai-dial-chat-hooks';

/** Skill listings a URL is looked up in, as `SkillsContext` exposes them. */
export interface SkillListingPools {
  skills: SkillMetadataItemDto[];
  sharedWithMe?: SkillMetadataItemDto[];
  publicSkills?: SkillMetadataItemDto[];
}

/**
 * Finds the listed skill a resource URL names, across the personal, shared and
 * organisation listings. Both sides are compared per-segment normalized, so a
 * URL that arrives decoded (e.g. read from a query string) still matches the
 * percent-encoded `url` DIAL Core lists.
 * @param pools - the skill listings to search
 * @param url - `skills/{bucket}/{path}` resource URL, encoded or decoded
 */
export const findSkillByUrl = (
  { skills, sharedWithMe, publicSkills }: SkillListingPools,
  url: string,
): SkillMetadataItemDto | undefined => {
  const normalizedUrl = normalizeDeploymentId(url);
  return [...skills, ...(sharedWithMe ?? []), ...(publicSkills ?? [])].find(
    (skill) => normalizeDeploymentId(skill.url) === normalizedUrl,
  );
};
