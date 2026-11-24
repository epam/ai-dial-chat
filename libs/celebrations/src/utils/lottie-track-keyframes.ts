import type { LottieLayer, LottieProperty } from '../models/lottie-composition';
import type { LottieTimeRemapSegment } from '../models/lottie-time-remap';
import type {
  CopyFallOptions,
  CopyPathOptions,
  CopyTrack,
  CopyTrackOptions,
  CopyTravelOptions,
} from '../models/lottie-track-keyframes';

/** Screen-space gravity of a falling copy, in px/s², as in the compiled Cat. */
export const COPY_GRAVITY_PX_PER_S2 = 2000;
/** Largest tilt of a falling copy, in degrees. */
export const COPY_MAX_TILT_DEG = 12;
/** Share of the timeline over which a copy fades back to its original. */
export const COPY_RESTORE_SHARE = 0.04;

const FALL_SAMPLES = 18;
const REBOUND_SAMPLES = 20;
const REBOUND_TILT_DEG = 8;
const TILT_PER_DROP_RATIO = 65;

interface ScalarKeyframe {
  t: number;
  s: number[];
  h?: number;
  o?: { x: number | number[]; y: number | number[] };
  i?: { x: number | number[]; y: number | number[] };
}

/** One sample of a copy: displacement, rotation and opacity at a time. */
interface CopySample {
  ms: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  easing: string;
}

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed copy track: ${reason}`);
};

const first = (value: number | number[]) =>
  Array.isArray(value) ? value[0] : value;

const easingOf = (keyframe: ScalarKeyframe) => {
  if (keyframe.h === 1) return 'steps(1, end)';
  if (!keyframe.o || !keyframe.i) return 'linear';
  const curve = [keyframe.o.x, keyframe.o.y, keyframe.i.x, keyframe.i.y].map(
    (value) => Number(first(value).toFixed(4)),
  );
  return curve[0] === curve[1] && curve[2] === curve[3]
    ? 'linear'
    : `cubic-bezier(${curve.join(', ')})`;
};

const keyframesOf = (property: LottieProperty | undefined) =>
  property?.a === 1 ? (property.k as ScalarKeyframe[]) : undefined;

const staticValue = (property: LottieProperty | undefined, fallback: number) =>
  property && property.a !== 1
    ? Number(first(property.k as number | number[]))
    : fallback;

const format = (value: number) => Number(value.toFixed(3));

const toKeyframe = (
  { ms, x, y, rotation, opacity, easing }: CopySample,
  durationMs: number,
): Keyframe => ({
  offset: Math.min(1, Math.max(0, ms / durationMs)),
  opacity: format(opacity),
  transform: `translate(${format(x)}px, ${format(y)}px) rotate(${format(rotation)}deg)`,
  easing,
});

/* The position, rotation and opacity tracks of a copy layer, which must share keyframe times and easing. */
const sharedKeyframes = (layer: LottieLayer) => {
  const position = layer.ks?.p;
  const rotation = layer.ks?.r;
  const opacity = layer.ks?.o;
  if (layer.ks?.s?.a === 1) malformed(`"${layer.nm}" animates its scale`);
  const tracks = [position, rotation, opacity]
    .map(keyframesOf)
    .filter((track): track is ScalarKeyframe[] => Boolean(track));
  if (!tracks.length) malformed(`"${layer.nm}" has no keyframes`);
  const [reference] = tracks;
  for (const track of tracks)
    if (
      track.length !== reference.length ||
      track.some(
        (keyframe, index) =>
          keyframe.t !== reference[index].t ||
          easingOf(keyframe) !== easingOf(reference[index]),
      )
    )
      malformed(`"${layer.nm}" tracks do not share keyframe times and easing`);
  return { position, rotation, opacity, reference };
};

const readSamples = (
  layer: LottieLayer,
  {
    toCompositionMs,
    releaseFrame,
    fromFrame = 0,
    mirror,
    scale,
  }: CopyTrackOptions,
): CopySample[] => {
  const { position, rotation, opacity, reference } = sharedKeyframes(layer);
  if (!reference.some(({ t }) => t === releaseFrame))
    malformed(`"${layer.nm}" has no keyframe at the release`);
  const positions = keyframesOf(position);
  const played = reference.flatMap((keyframe, index) =>
    keyframe.t >= fromFrame && keyframe.t <= releaseFrame
      ? [{ keyframe, index }]
      : [],
  );
  if (!played.length) malformed(`"${layer.nm}" has no keyframe in the story`);
  const restX = positions
    ? positions[played[0].index].s[0]
    : first((position?.k as number[] | undefined) ?? [0]);
  return played.map(({ keyframe, index }) => ({
    ms: toCompositionMs(keyframe.t),
    x: positions ? (positions[index].s[0] - restX) * mirror * scale : 0,
    y: 0,
    rotation:
      (keyframesOf(rotation)?.[index].s[0] ?? staticValue(rotation, 0)) *
      mirror,
    opacity:
      (keyframesOf(opacity)?.[index].s[0] ?? staticValue(opacity, 100)) / 100,
    easing: easingOf(keyframe),
  }));
};

/** Returns the copy's WAAPI keyframes from the authored track, up to and including the release. */
export const copyTrackKeyframes = (
  layer: LottieLayer,
  options: CopyTrackOptions,
): CopyTrack => {
  const samples = readSamples(layer, options);
  const head = samples[0];
  const withStart = head.ms > 0 ? [{ ...head, ms: 0 }, ...samples] : samples;
  return {
    keyframes: withStart.map((sample) =>
      toKeyframe(sample, options.durationMs),
    ),
    releaseX: samples[samples.length - 1].x,
  };
};

/** Milliseconds a copy needs to fall `dropPx` under `COPY_GRAVITY_PX_PER_S2`. */
export const copyFallMs = (dropPx: number): number =>
  Math.sqrt((2 * Math.max(0, dropPx)) / COPY_GRAVITY_PX_PER_S2) * 1000;

/**
 * Returns the track's keyframes followed by the physical fall after the
 * release: an accelerating drop with a bounded tilt, an optional rebound, then
 * a fade at the restore time. Only translation, rotation and opacity change.
 */
export const appendCopyFall = (
  { keyframes, releaseX: x }: CopyTrack,
  {
    durationMs,
    releaseMs,
    dropPx,
    widthPx,
    side,
    restoreMs,
    reboundHeightPx,
  }: CopyFallOptions,
): Keyframe[] => {
  const fallMs = copyFallMs(dropPx);
  const landingMs = releaseMs + fallMs;
  const tilt = Math.min(
    COPY_MAX_TILT_DEG,
    (dropPx / Math.max(1, widthPx)) * TILT_PER_DROP_RATIO,
  );
  const sample = (
    ms: number,
    y: number,
    rotation: number,
    opacity = 1,
    easing = 'linear',
  ): CopySample => ({ ms, x, y, rotation, opacity, easing });
  const samples: CopySample[] = [];
  for (let step = 1; step <= FALL_SAMPLES; step++) {
    const progress = step / FALL_SAMPLES;
    samples.push(
      sample(
        releaseMs + fallMs * progress,
        dropPx * progress * progress,
        side * tilt * Math.sin(progress * Math.PI),
      ),
    );
  }
  let restingMs = landingMs;
  if (reboundHeightPx !== undefined && reboundHeightPx > 0) {
    const reboundMs = copyFallMs(reboundHeightPx) * 2;
    for (let step = 1; step <= REBOUND_SAMPLES; step++) {
      const progress = step / REBOUND_SAMPLES;
      samples.push(
        sample(
          landingMs + reboundMs * progress,
          dropPx - 4 * reboundHeightPx * progress * (1 - progress),
          -side * REBOUND_TILT_DEG * Math.sin(progress * Math.PI),
        ),
      );
    }
    restingMs = landingMs + reboundMs;
  }
  if (restingMs > restoreMs)
    malformed('the copy is still moving at the restore');
  const fadeEndMs = Math.min(
    durationMs,
    restoreMs + durationMs * COPY_RESTORE_SHARE,
  );
  samples.push(sample(restoreMs, dropPx, 0, 1, 'ease-in-out'));
  samples.push(sample(fadeEndMs, dropPx, 0, 0));
  if (fadeEndMs < durationMs) samples.push(sample(durationMs, dropPx, 0, 0));
  return [
    ...keyframes,
    ...samples.map((entry) => toKeyframe(entry, durationMs)),
  ];
};

/* Local frames are compared with this tolerance, since remap pieces come from seconds. */
const FRAME_EPSILON = 1e-6;

const isStep = (
  segment: LottieTimeRemapSegment,
  next: LottieTimeRemapSegment | undefined,
) =>
  next !== undefined &&
  Math.abs(next.localFrom - segment.localTo) > FRAME_EPSILON;

/**
 * Returns the copy's WAAPI keyframes for the whole section path: every authored
 * keyframe once per remap piece that shows it, in composition time, as a
 * translation from `origin` plus rotation and opacity. A piece that starts or
 * ends at a step must have a keyframe there.
 */
export const copyPathKeyframes = (
  layer: LottieLayer,
  {
    durationMs,
    frameRate,
    segments,
    origin,
    scale,
    mirror = 1,
  }: CopyPathOptions,
): Keyframe[] => {
  const { position, rotation, opacity, reference } = sharedKeyframes(layer);
  const positions = keyframesOf(position);
  if (!positions) malformed(`"${layer.nm}" has no position keyframes`);
  const hasKeyAt = (frame: number) =>
    reference.some(({ t }) => Math.abs(t - frame) <= FRAME_EPSILON);
  const samples: CopySample[] = [];
  let lastLocal: number | undefined;
  let lastMs: number | undefined;
  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    const next = segments[index + 1];
    if (previous && isStep(previous, segment) && !hasKeyAt(segment.localFrom))
      malformed(
        `"${layer.nm}" has no keyframe at local frame ${segment.localFrom}`,
      );
    if (isStep(segment, next) && !hasKeyAt(segment.localTo))
      malformed(
        `"${layer.nm}" has no keyframe at local frame ${segment.localTo}`,
      );
    const rate =
      (segment.to - segment.from) / (segment.localTo - segment.localFrom);
    reference.forEach((keyframe, keyIndex) => {
      if (
        keyframe.t < segment.localFrom - FRAME_EPSILON ||
        keyframe.t > segment.localTo + FRAME_EPSILON
      )
        return;
      const ms =
        ((segment.from + (keyframe.t - segment.localFrom) * rate) / frameRate) *
        1000;
      /* A continuous join shows the same keyframe at the same time twice. */
      if (
        lastLocal !== undefined &&
        lastMs !== undefined &&
        Math.abs(lastLocal - keyframe.t) <= FRAME_EPSILON &&
        Math.abs(lastMs - ms) <= 1e-3
      )
        return;
      const [x, y] = positions[keyIndex].s;
      samples.push({
        ms,
        x: (x - origin.x) * scale * mirror,
        y: (y - origin.y) * scale,
        rotation:
          (keyframesOf(rotation)?.[keyIndex].s[0] ?? staticValue(rotation, 0)) *
          mirror,
        opacity:
          (keyframesOf(opacity)?.[keyIndex].s[0] ?? staticValue(opacity, 100)) /
          100,
        easing: easingOf(keyframe),
      });
      lastLocal = keyframe.t;
      lastMs = ms;
    });
  });
  if (!samples.length) malformed(`"${layer.nm}" has no keyframe in the story`);
  return withEnds(samples, durationMs).map((sample) =>
    toKeyframe(sample, durationMs),
  );
};

/* Holds the first sample from offset 0 and the last to offset 1, so WAAPI never
   makes up an end keyframe from the element's underlying value. */
const withEnds = <T extends { ms: number }>(
  samples: readonly T[],
  durationMs: number,
): T[] => {
  const head = samples[0];
  const tail = samples[samples.length - 1];
  return [
    ...(head.ms > 0 ? [{ ...head, ms: 0 }] : []),
    ...samples,
    ...(tail.ms < durationMs ? [{ ...tail, ms: durationMs }] : []),
  ];
};

/** Returns the WAAPI keyframes of a travel null, in composition time, as a translation from `origin`. */
export const copyTravelKeyframes = (
  layer: LottieLayer,
  { durationMs, frameRate, origin, scale, mirror = 1 }: CopyTravelOptions,
): Keyframe[] => {
  const positions = keyframesOf(layer.ks?.p);
  if (!positions?.length) malformed(`"${layer.nm}" has no position keyframes`);
  const samples = positions.map((keyframe) => ({
    ms: (keyframe.t / frameRate) * 1000,
    x: (keyframe.s[0] - origin.x) * scale * mirror,
    y: (keyframe.s[1] - origin.y) * scale,
    rotation: 0,
    opacity: 1,
    easing: easingOf(keyframe),
  }));
  return withEnds(samples, durationMs).map(({ ms, x, y, easing }) => ({
    offset: Math.min(1, Math.max(0, ms / durationMs)),
    transform: `translate(${format(x)}px, ${format(y)}px)`,
    easing,
  }));
};
