import type { LottieProperty } from '../models/lottie-composition';
import type {
  LottieElasticRange,
  LottieLocalRange,
  LottieTimeRemapSegment,
} from '../models/lottie-time-remap';

/** Slowest and fastest playback an elastic window may use. */
export const ELASTIC_SPEED_RANGE = { min: 0.8, max: 1.25 } as const;

/* A step happens this many frames before the next piece, so the hold shows the
   previous piece's last pose and no extra frame is inserted. */
const STEP_FRAMES = 0.001;
const LINEAR_OUT = { x: [0], y: [0] };
const LINEAR_IN = { x: [1], y: [1] };

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed time remap: ${reason}`);
};

const slope = ({ from, to, localFrom, localTo }: LottieTimeRemapSegment) =>
  (localTo - localFrom) / (to - from);

/** Returns the pieces that play `ranges` back to back from composition frame 0. */
export const buildSectionPath = (
  ranges: readonly LottieLocalRange[],
): LottieTimeRemapSegment[] => {
  let from = 0;
  return ranges.map(({ from: localFrom, to: localTo }) => {
    if (!(localTo > localFrom)) malformed('a range has no length');
    const segment = {
      from,
      to: from + localTo - localFrom,
      localFrom,
      localTo,
    };
    from = segment.to;
    return segment;
  });
};

/** Returns the composition frame at which local frame `local` shows, or `undefined` when it never does. */
export const toCompositionFrame = (
  segments: readonly LottieTimeRemapSegment[],
  local: number,
): number | undefined => {
  const segment = segments.find(
    ({ localFrom, localTo }) => local >= localFrom && local <= localTo,
  );
  return segment && segment.from + (local - segment.localFrom) / slope(segment);
};

/**
 * Returns `segments` with the reaction after a landing re-timed to a physical
 * fall: the fall maps onto the authored fall and the elastic window absorbs
 * the difference. Returns `undefined` when that needs a playback speed outside
 * `ELASTIC_SPEED_RANGE`.
 */
export const applyElasticRange = (
  segments: readonly LottieTimeRemapSegment[],
  {
    releaseFrame,
    landingFrame,
    elasticFrames,
    physicalFallFrames,
  }: LottieElasticRange,
): LottieTimeRemapSegment[] | undefined => {
  const release = toCompositionFrame(segments, releaseFrame);
  const windowEnd = toCompositionFrame(segments, landingFrame + elasticFrames);
  if (release === undefined || windowEnd === undefined)
    malformed('the elastic window is not on the section path');
  const index = segments.findIndex(
    ({ from, to }) => release >= from && windowEnd <= to,
  );
  if (index < 0 || Math.abs(slope(segments[index]) - 1) > 1e-9)
    malformed('the elastic window crosses a step');
  const authoredFall = landingFrame - releaseFrame;
  if (!(authoredFall > 0) || !(physicalFallFrames > 0) || !(elasticFrames > 0))
    malformed('the fall or the elastic window has no length');
  const speed =
    elasticFrames / (elasticFrames - (physicalFallFrames - authoredFall));
  if (!(speed >= ELASTIC_SPEED_RANGE.min && speed <= ELASTIC_SPEED_RANGE.max))
    return undefined;
  const segment = segments[index];
  const landing = release + physicalFallFrames;
  const pieces: LottieTimeRemapSegment[] = [
    { ...segment, to: release, localTo: releaseFrame },
    {
      from: release,
      to: landing,
      localFrom: releaseFrame,
      localTo: landingFrame,
    },
    {
      from: landing,
      to: windowEnd,
      localFrom: landingFrame,
      localTo: landingFrame + elasticFrames,
    },
    { ...segment, from: windowEnd, localFrom: landingFrame + elasticFrames },
  ].filter(({ from, to }) => to > from);
  return [...segments.slice(0, index), ...pieces, ...segments.slice(index + 1)];
};

/** Returns the Lottie `tm` property for `segments`, with linear easing and a hold before every step. */
export const toTimeRemapProperty = (
  segments: readonly LottieTimeRemapSegment[],
  frameRate: number,
): LottieProperty => {
  if (!segments.length) malformed('no pieces');
  const seconds = (frame: number) => [frame / frameRate];
  const keyframes: Record<string, unknown>[] = [];
  segments.forEach((segment, index) => {
    keyframes.push({
      t: segment.from,
      s: seconds(segment.localFrom),
      o: LINEAR_OUT,
      i: LINEAR_IN,
    });
    const next = segments[index + 1];
    if (next && next.localFrom !== segment.localTo) {
      const holdAt = segment.to - STEP_FRAMES;
      keyframes.push({
        t: holdAt,
        s: seconds(
          segment.localFrom + (holdAt - segment.from) * slope(segment),
        ),
        h: 1,
      });
    }
  });
  const last = segments[segments.length - 1];
  keyframes.push({ t: last.to, s: seconds(last.localTo) });
  return { a: 1, k: keyframes };
};
