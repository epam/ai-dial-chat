import type {
  LottieFrameRange,
  LottieMarkerScope,
  LottieMarkerVocabulary,
  LottieNamespacedMarker,
} from '../models/lottie-markers';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed marker: ${reason}`);
};

const label = ({ kind, argument }: LottieNamespacedMarker) =>
  argument === undefined ? kind : `${kind}:${argument}`;

const end = (marker: LottieNamespacedMarker) => marker.frame + marker.duration;

/* `ns:kind` or `ns:kind:argument`; anything else in the namespace is malformed. */
const parseMarker = (
  raw: Record<string, unknown>,
  { kinds }: LottieMarkerVocabulary,
  range: LottieFrameRange,
): LottieNamespacedMarker => {
  const comment = raw.cm as string;
  const [, kind, argument, ...rest] = comment.split(':');
  const rule = kinds[kind];
  if (!rule || rest.length) malformed(`unknown "${comment}"`);
  if (
    rule.arguments
      ? argument === undefined || !rule.arguments.includes(argument)
      : argument !== undefined
  )
    malformed(`unknown argument in "${comment}"`);
  const frame = raw.tm;
  const duration = raw.dr ?? 0;
  if (
    typeof frame !== 'number' ||
    typeof duration !== 'number' ||
    !Number.isFinite(frame) ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    frame < range.from ||
    frame + duration > range.to ||
    (duration === 0 && frame >= range.to)
  )
    malformed(`"${comment}" lies outside frames ${range.from}–${range.to}`);
  if (rule.duration === true && duration <= 0)
    malformed(`"${comment}" needs a duration`);
  if (rule.duration === false && duration > 0)
    malformed(`"${comment}" must not have a duration`);
  return { kind, argument, frame, duration };
};

const checkScope = (
  markers: readonly LottieNamespacedMarker[],
  { kinds, order = [] }: LottieMarkerVocabulary,
  where: string,
) => {
  const counts = new Map<string, number>();
  for (const marker of markers) {
    const key = label(marker);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > (kinds[marker.kind].maxPerScope ?? 1))
      malformed(`"${key}" repeats in ${where}`);
  }
  for (const kind of Object.keys(kinds).filter((name) => kinds[name].exclusive))
    markers
      .filter((marker) => marker.kind === kind)
      .forEach((first, index, ranges) => {
        for (const second of ranges.slice(index + 1))
          if (first.frame < end(second) && second.frame < end(first))
            malformed(
              `"${label(first)}" overlaps "${label(second)}" in ${where}`,
            );
      });
  order.forEach((earlier, index) => {
    for (const later of order.slice(index + 1))
      for (const first of markers.filter(({ kind }) => kind === earlier))
        for (const second of markers.filter(({ kind }) => kind === later))
          if (
            (first.argument === second.argument ||
              first.argument === undefined ||
              second.argument === undefined) &&
            second.frame < first.frame
          )
            malformed(
              `"${label(second)}" comes before "${label(first)}" in ${where}`,
            );
  });
};

/**
 * Returns the validated markers of one namespace, grouped by scope; throws
 * when any of them is malformed. Markers of other namespaces are ignored.
 */
export const readNamespacedMarkers = (
  data: unknown,
  vocabulary: LottieMarkerVocabulary,
  range: LottieFrameRange,
): LottieMarkerScope[] => {
  const raw = isRecord(data) ? data.markers : undefined;
  let entries: unknown[] = [];
  if (Array.isArray(raw)) entries = raw;
  else if (raw !== undefined) malformed('`markers` is not a list');
  const prefix = `${vocabulary.namespace}:`;
  const markers = entries
    .filter(
      (entry): entry is Record<string, unknown> =>
        isRecord(entry) &&
        typeof entry.cm === 'string' &&
        entry.cm.startsWith(prefix),
    )
    .map((entry) => parseMarker(entry, vocabulary, range))
    .sort((first, second) => first.frame - second.frame);
  const { scopeKind } = vocabulary;
  if (!scopeKind) {
    checkScope(markers, vocabulary, 'the timeline');
    return [{ markers }];
  }
  const scopeMarkers = markers.filter(({ kind }) => kind === scopeKind);
  checkScope(scopeMarkers, { ...vocabulary, order: [] }, 'the timeline');
  scopeMarkers.forEach((first, index) => {
    const second = scopeMarkers[index + 1];
    if (second && second.frame < end(first))
      malformed(`"${label(first)}" overlaps "${label(second)}"`);
  });
  const scopes = scopeMarkers.map((marker) => ({
    marker,
    markers: [] as LottieNamespacedMarker[],
  }));
  for (const marker of markers) {
    if (marker.kind === scopeKind) continue;
    const fits = (candidate: (typeof scopes)[number]) =>
      marker.frame >= candidate.marker.frame &&
      end(marker) <= end(candidate.marker);
    /* Scopes are half-open: a marker on a shared boundary opens the next scope. */
    const scope =
      scopes.find(
        (candidate) => fits(candidate) && marker.frame < end(candidate.marker),
      ) ?? scopes.find(fits);
    if (!scope) malformed(`"${label(marker)}" lies outside every scope`);
    scope.markers.push(marker);
  }
  scopes.forEach((scope) =>
    checkScope(scope.markers, vocabulary, `"${label(scope.marker)}"`),
  );
  return scopes;
};

/* Frames come from seconds, so boundaries compare within this tolerance. */
const RANGE_EPSILON = 1e-6;

/**
 * Returns the range that holds `frame`: ranges are half-open, so a frame on a
 * shared boundary belongs to the later range, and a frame on an end no range
 * continues belongs to the range it ends; `undefined` when no range holds it.
 */
export const findNamespacedRange = (
  ranges: readonly LottieNamespacedMarker[],
  frame: number,
): LottieNamespacedMarker | undefined =>
  ranges.find(
    (range) =>
      frame >= range.frame - RANGE_EPSILON &&
      frame < end(range) - RANGE_EPSILON,
  ) ?? ranges.find((range) => Math.abs(frame - end(range)) <= RANGE_EPSILON);
