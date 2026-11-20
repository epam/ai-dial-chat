import type { LottieLayer, LottieProperty } from '../models/lottie-composition';
import type {
  CopyFallOptions,
  CopyTrack,
  CopyTrackOptions,
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
