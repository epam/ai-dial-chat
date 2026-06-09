export const resolveUniqueConversationName = (
  base: string,
  existingTitles: Set<string>,
): string => {
  if (!existingTitles.has(base)) return base;
  let index = 1;
  while (existingTitles.has(`${base} ${index}`)) {
    index++;
  }
  return `${base} ${index}`;
};
