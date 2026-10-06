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

/*
 * Removes a colon at the very end of the (already duration-stripped) string,
 * along with any whitespace after it. A `/:\s*$/` regex would be equivalent
 * but quadratic: `\s*$` has an unanchored start, so the engine retries from
 * every offset and a long whitespace tail costs O(n²) (CodeQL
 * js/polynomial-redos). Trimming the end first makes the colon the last
 * character, so only one comparison is needed.
 */
const stripTrailingColon = (value: string): string => {
  const trimmed = value.trimEnd();
  return trimmed.endsWith(':') ? trimmed.slice(0, -1) : trimmed;
};

interface DurationMetadata {
  durationLabel: string;
  groupIndex: number;
  groupLength: number;
}

/** Result of cleaning a raw backend stage name for display. */
interface CleanedStageName {
  /** Display name with any duration/timestamp bracket group and trailing colon removed. */
  name: string;
  /** Extracted duration label (e.g. `'3.99s'`), or `undefined` if the raw name carried none. */
  durationLabel?: string;
}

const extractDurationMetadata = (
  rawName: string,
): DurationMetadata | undefined => {
  BRACKET_GROUP_RE.lastIndex = 0;
  let groupMatch: RegExpExecArray | null;

  while ((groupMatch = BRACKET_GROUP_RE.exec(rawName))) {
    const inner = groupMatch[0].slice(1, -1);
    const durationMatch = DURATION_INNER_RE.exec(inner);
    if (durationMatch) {
      return {
        durationLabel: `${durationMatch[1]}s`,
        groupIndex: groupMatch.index,
        groupLength: groupMatch[0].length,
      };
    }
  }

  return undefined;
};

/** Strips an embedded duration bracket group (e.g. `(7.18s, ...)`) and a trailing colon from a raw backend stage name. */
export const cleanStageName = (rawName: string): CleanedStageName => {
  const safeRawName = rawName ?? '';
  const metadata = extractDurationMetadata(safeRawName);

  const withoutDuration = metadata
    ? safeRawName.slice(0, metadata.groupIndex) +
      safeRawName.slice(metadata.groupIndex + metadata.groupLength)
    : safeRawName;

  const name = stripTrailingColon(withoutDuration)
    .trim()
    .replace(/ {2,}/g, ' ');

  return {
    name,
    durationLabel: metadata?.durationLabel,
  };
};

/** Returns true if the name looks like a raw identifier: no whitespace and contains an underscore. */
export const isIdentifierLike = (name: string): boolean =>
  name.length > 0 && !/\s/.test(name) && name.includes('_');
