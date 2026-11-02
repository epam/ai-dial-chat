import type { SkillSelectorOption } from '../models/skill-selector-field-props';

/** Returns one `SkillSelectorOption` per skill URL across the given listings, the last listing winning on a duplicate URL. */
export const buildSkillSelectorOptions = (
  ...listings: (readonly { url: string; name: string }[] | undefined)[]
): SkillSelectorOption[] => {
  const options = new Map<string, SkillSelectorOption>();
  for (const listing of listings) {
    for (const skill of listing ?? []) {
      options.set(skill.url, { id: skill.url, name: skill.name });
    }
  }
  return [...options.values()];
};
