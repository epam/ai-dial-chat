/** Whether a selected skill lacks explicitly confirmed support. */
export const isSkillSelectionUnsupported = (
  skillUrl: string | null | undefined,
  isSkillsSupported: boolean | undefined,
): boolean => Boolean(skillUrl?.trim()) && isSkillsSupported !== true;
