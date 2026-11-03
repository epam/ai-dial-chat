import { useScheduledTaskSkillDetails } from './useUnavailableScheduledTaskSkills';

/** Resolves names using the current host catalog and configured metadata API. */
export const useScheduledTaskSkillDisplayNames = (skillUrls?: string[]) =>
  useScheduledTaskSkillDetails(skillUrls).map((skill) => skill.name);
