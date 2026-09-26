/** Keep configured prompt formatting intact while treating blank overrides as unset. */
export const resolvePrompt = (
  override: string | undefined,
  defaultPrompt: string,
): string => (override?.trim() ? override : defaultPrompt);
