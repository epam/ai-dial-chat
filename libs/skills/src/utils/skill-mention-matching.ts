import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import type { SkillListingEntry } from '../models/favorite-skill-item';
import type { SkillMentionAnchor } from '../models/skill-mention-anchor';

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

/**
 * Returns every `/{name}` run in `text` that names one of `skills`, as mention
 * anchors with offsets into `text`. A run must start the text or follow
 * whitespace and end at a word boundary; the longest matching name wins, and
 * a name shared by several skills resolves to the first of them in `skills`.
 */
export const findSkillMentionsInText = (
  text: string,
  skills: Pick<SkillListingEntry, 'url' | 'name'>[],
): SkillMentionAnchor[] => {
  const urlByName = new Map<string, string>();
  skills.forEach((skill) => {
    if (skill.name !== '' && !urlByName.has(skill.name)) {
      urlByName.set(skill.name, skill.url);
    }
  });
  /* Longest first: names may contain spaces, so `/Weekly report` must win over `/Weekly`. */
  const names = [...urlByName.keys()].sort((a, b) => b.length - a.length);

  const result: SkillMentionAnchor[] = [];
  let index = text.indexOf('/');
  while (index !== -1) {
    const isRunStart = index === 0 || /\s/.test(text[index - 1]);
    const nameStart = index + 1;
    const name = isRunStart
      ? names.find(
          (candidate) =>
            text.startsWith(candidate, nameStart) &&
            isWordBoundaryChar(text[nameStart + candidate.length]),
        )
      : undefined;
    const url = name == null ? undefined : urlByName.get(name);

    if (name != null && url != null) {
      result.push({ url, name, start: index, length: name.length + 1 });
      index = text.indexOf('/', nameStart + name.length);
    } else {
      index = text.indexOf('/', nameStart);
    }
  }

  return result;
};
