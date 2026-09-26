import type { RequestSkill } from '@epam/ai-dial-chat-shared';

/** One resolved mention location, or omitted for a skill whose text mention could not be found. */
export interface ResolvedSkillMention {
  /** Index into the input `skills` array this location resolves. */
  skillIndex: number;
  /** Character offset of the leading `/` in `text`. */
  start: number;
  /** Length of the matched `/{name}` run. */
  length: number;
}

const isWordBoundaryChar = (char: string | undefined): boolean =>
  char == null || /[\s/]/.test(char);

/**
 * Matches each entry of `skills` (in array order) to the next available
 * `/{name}` occurrence in `text`, where `name` is that entry's display name
 * resolved via `resolveName(url)` — the current listing name, falling back to
 * the url's last path segment (`getSkillFallbackName`). Scans left to right,
 * consuming text as it goes, so two skills with the same resolved name are
 * still matched to distinct, successive occurrences in the text. A skill
 * whose exact `/{name}` cannot be found at or after the current scan position
 * (e.g. the user's later edit broke the mention) is omitted from the result —
 * it still counts as a real `custom_content.skills` entry for sending, it
 * simply renders nowhere in particular, and later entries still get their own
 * independent forward search from the same unmoved cursor.
 */
export const matchSkillMentions = (
  text: string,
  skills: RequestSkill[],
  resolveName: (url: string) => string,
): ResolvedSkillMention[] => {
  const result: ResolvedSkillMention[] = [];
  let scanCursor = 0;

  skills.forEach((skill, skillIndex) => {
    const token = `/${resolveName(skill.url)}`;
    let searchFrom = scanCursor;

    while (searchFrom <= text.length) {
      const foundAt = text.indexOf(token, searchFrom);
      if (foundAt === -1) return;

      const endIndex = foundAt + token.length;
      if (isWordBoundaryChar(text[endIndex])) {
        result.push({ skillIndex, start: foundAt, length: token.length });
        scanCursor = endIndex;
        return;
      }

      /* `token` matched as a prefix of a longer word — keep searching forward
       * for a real, word-boundary-terminated occurrence. */
      searchFrom = foundAt + 1;
    }
  });

  return result;
};
