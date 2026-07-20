/**
 * Matches a single, non-nested `[...]` or `(...)` group (e.g. `[DEBUG]`,
 * `(7.18s, Start: 11:21:38, End: 11:21:45)`). Whether the group actually
 * carries a duration is checked separately via {@link DURATION_INNER_RE}, so
 * this regex only needs one unambiguous quantifier and can't backtrack
 * catastrophically on adversarial input.
 */
const BRACKET_GROUP_RE = /[([][^()[\]]*[)\]]/g;

/** Seconds-style duration (e.g. `3.99s`) inside an already-isolated bracket group. */
const DURATION_INNER_RE = /(\d+(?:\.\d+)?)\s*s\b/;

/** A colon at the very end of the (already duration-stripped) string. */
const TRAILING_COLON_RE = /:\s*$/;

/** Result of cleaning a raw backend stage name for display. */
export interface CleanedStageName {
  /** Display name with any duration/timestamp group and trailing colon removed. Casing is preserved as given — never title-cased. */
  name: string;
  /** Extracted duration label (e.g. `'3.99s'`), or `undefined` if the raw name carried none. */
  durationLabel?: string;
}

/**
 * Cleans a raw backend stage name for display: extracts an embedded
 * duration (discarding any accompanying timestamps, which have no
 * structured home in the UI today) and strips a single trailing colon.
 * Never re-cases or rewrites the remaining text.
 */
export const cleanStageName = (rawName: string): CleanedStageName => {
  BRACKET_GROUP_RE.lastIndex = 0;
  let groupMatch: RegExpExecArray | null;
  let durationMatch: RegExpExecArray | null = null;
  let groupIndex = -1;
  let groupLength = 0;

  while ((groupMatch = BRACKET_GROUP_RE.exec(rawName))) {
    const inner = groupMatch[0].slice(1, -1);
    const innerMatch = DURATION_INNER_RE.exec(inner);
    if (innerMatch) {
      durationMatch = innerMatch;
      groupIndex = groupMatch.index;
      groupLength = groupMatch[0].length;
      break;
    }
  }

  const withoutDuration =
    durationMatch && groupIndex >= 0
      ? rawName.slice(0, groupIndex) + rawName.slice(groupIndex + groupLength)
      : rawName;

  const name = withoutDuration
    .replace(TRAILING_COLON_RE, '')
    .trim()
    .replace(/ {2,}/g, ' ');

  return {
    name,
    durationLabel: durationMatch ? `${durationMatch[1]}s` : undefined,
  };
};

/**
 * Heuristic for "this cleaned name is a raw identifier, not prose":
 * no whitespace and at least one underscore (e.g. `My_OMDB_Agent__0_0_1_tool`).
 * Prose with an embedded identifier substring (e.g. `Call My_OMDB_Agent_tool`)
 * still contains a space and is left as normal text.
 */
export const isIdentifierLike = (name: string): boolean =>
  name.length > 0 && !/\s/.test(name) && name.includes('_');

/** Formats a total duration in seconds as `'Xm Ys'` when >= 60s, otherwise `'X.Xs'`. */
export const formatTotalDuration = (totalSeconds: number): string => {
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
  }
  return `${totalSeconds.toFixed(1)}s`;
};

/** Parses a duration label produced by {@link cleanStageName} (e.g. `'3.99s'`) back into seconds. */
export const parseDurationSeconds = (
  durationLabel: string | undefined,
): number | undefined => {
  if (!durationLabel) return undefined;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(durationLabel);
  return match ? parseFloat(match[1]) : undefined;
};
