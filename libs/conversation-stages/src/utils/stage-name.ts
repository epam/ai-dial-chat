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

/** Start time emitted alongside a stage duration (e.g. `Start: 11:21:38`). */
const START_TIME_INNER_RE =
  /\bStart:\s*(\d{1,2}):([0-5]\d):([0-5]\d(?:\.\d+)?)\b/i;

/** A colon at the very end of the (already duration-stripped) string. */
const TRAILING_COLON_RE = /:\s*$/;

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_HALF_DAY = SECONDS_PER_DAY / 2;

interface DurationMetadata {
  durationLabel: string;
  groupIndex: number;
  groupLength: number;
  startTimeSeconds?: number;
}

/** Result of cleaning a raw backend stage name for display. */
interface CleanedStageName {
  /** Display name with any duration/timestamp bracket group and trailing colon removed. */
  name: string;
  /** Extracted duration label (e.g. `'3.99s'`), or `undefined` if the raw name carried none. */
  durationLabel?: string;
}

const parseStartTimeSeconds = (inner: string): number | undefined => {
  const match = START_TIME_INNER_RE.exec(inner);
  if (!match) return undefined;

  const hours = Number(match[1]);
  if (hours > 23) return undefined;

  return hours * 60 * 60 + Number(match[2]) * 60 + Number(match[3]);
};

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
        startTimeSeconds: parseStartTimeSeconds(inner),
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

  const name = withoutDuration
    .replace(TRAILING_COLON_RE, '')
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

/** Returns the elapsed duration represented by stage names, without double-counting overlapping timed stages. */
export const calculateStagesDurationSeconds = (
  stageNames: string[],
): number => {
  const timings = stageNames.flatMap((stageName) => {
    const metadata = extractDurationMetadata(stageName ?? '');
    const durationSeconds = parseDurationSeconds(metadata?.durationLabel);

    return durationSeconds == null
      ? []
      : [{ durationSeconds, startTimeSeconds: metadata?.startTimeSeconds }];
  });

  if (timings.length === 0) return 0;

  if (timings.some(({ startTimeSeconds }) => startTimeSeconds == null)) {
    return timings.reduce(
      (sum, { durationSeconds }) => sum + durationSeconds,
      0,
    );
  }

  /*
   * Time-of-day values carry no date. Preserve stage order and unwrap only a
   * large backward jump; a global min/max check cannot distinguish a real
   * midnight rollover from a wide, forward-moving range within one day.
   */
  let dayOffset = 0;
  let previousStart: number | undefined;
  const intervals = timings
    .flatMap(({ durationSeconds, startTimeSeconds }) => {
      if (startTimeSeconds == null) return [];

      let normalizedStart = startTimeSeconds + dayOffset;
      if (
        previousStart != null &&
        previousStart - normalizedStart > SECONDS_PER_HALF_DAY
      ) {
        dayOffset += SECONDS_PER_DAY;
        normalizedStart += SECONDS_PER_DAY;
      }
      previousStart = normalizedStart;

      return { start: normalizedStart, end: normalizedStart + durationSeconds };
    })
    .sort((a, b) => a.start - b.start);

  let totalSeconds = 0;
  let currentStart = intervals[0].start;
  let currentEnd = intervals[0].end;

  for (const interval of intervals.slice(1)) {
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      totalSeconds += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }

  return totalSeconds + currentEnd - currentStart;
};
