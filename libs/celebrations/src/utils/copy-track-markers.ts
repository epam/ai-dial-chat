import {
  COPY_TRACK_MARKERS,
  COPY_TRACK_SECTIONS,
} from '../constants/copy-track';
import type { CopyTrackMarkers } from '../models/copy-track';
import type {
  LottieFrameRange,
  LottieNamespacedMarker,
} from '../models/lottie-markers';
import type { LottieSplice } from '../models/lottie-time-remap';
import { CopyTrackMarker, CopyTrackSectionKind } from '../types/copy-track';
import { readNamespacedMarkers } from './lottie-markers';

/* Frames are compared with this tolerance, since markers come from seconds. */
const FRAME_EPSILON = 1e-6;

const malformed: (reason: string) => never = (reason) => {
  throw new Error(`Malformed copy-track markers: ${reason}`);
};

const end = ({ frame, duration }: LottieNamespacedMarker) => frame + duration;

const overlaps = (
  first: LottieNamespacedMarker,
  second: LottieNamespacedMarker,
) =>
  first.frame < end(second) - FRAME_EPSILON &&
  second.frame < end(first) - FRAME_EPSILON;

const inside = (
  inner: LottieNamespacedMarker,
  outer: { from: number; to: number },
) =>
  inner.frame >= outer.from - FRAME_EPSILON &&
  end(inner) <= outer.to + FRAME_EPSILON;

/**
 * Returns the validated `ct:` markers of a copy-track asset; throws when the
 * grammar, the splice pairing, the range coverage or the cycles are malformed.
 */
export const readCopyTrackMarkers = (
  data: unknown,
  range: LottieFrameRange,
): CopyTrackMarkers => {
  const [{ markers }] = readNamespacedMarkers(data, COPY_TRACK_MARKERS, range);
  const of = (kind: CopyTrackMarker) =>
    markers.filter((marker) => marker.kind === kind);
  const sectionMarkers = of(CopyTrackMarker.Section);
  if (!sectionMarkers.length) malformed('no section is declared');
  const trunks = of(CopyTrackMarker.Trunk);
  if (trunks.length !== 1)
    malformed(`expected one trunk, found ${trunks.length}`);
  const [trunkMarker] = trunks;
  const trunk = { from: trunkMarker.frame, to: end(trunkMarker) };
  const sections = sectionMarkers.map(({ argument }) => {
    const kind = argument as CopyTrackSectionKind;
    return { kind, ...COPY_TRACK_SECTIONS[kind] };
  });

  const cuts = of(CopyTrackMarker.Cut);
  const fills = of(CopyTrackMarker.Fill);
  const splices: Partial<Record<CopyTrackSectionKind, LottieSplice[]>> = {};
  for (const kind of Object.values(CopyTrackSectionKind)) {
    const kindCuts = cuts.filter(({ argument }) => argument === kind);
    const kindFills = fills.filter(({ argument }) => argument === kind);
    if (kindCuts.length !== kindFills.length)
      malformed(
        `"${kind}" has ${kindCuts.length} cuts and ${kindFills.length} fills`,
      );
    if (!kindCuts.length) continue;
    if (!sections.some((section) => section.kind === kind))
      malformed(`"${kind}" has splices but no section`);
    splices[kind] = kindCuts.map((cut, index) => {
      const fill = kindFills[index];
      if (!inside(cut, trunk)) malformed(`a "${kind}" cut leaves the trunk`);
      if (fill.frame < trunk.to - FRAME_EPSILON)
        malformed(`a "${kind}" fill lies inside the trunk`);
      if (Math.abs(cut.duration - fill.duration) > FRAME_EPSILON)
        malformed(`a "${kind}" fill does not last as long as its cut`);
      kindCuts.slice(index + 1).forEach((other) => {
        if (overlaps(cut, other)) malformed(`two "${kind}" cuts overlap`);
      });
      return {
        cut: { from: cut.frame, to: end(cut) },
        fill: { from: fill.frame, to: end(fill) },
      };
    });
  }

  /* Two kinds may share a fill window, but only exactly; any other overlap is ambiguous. */
  fills.forEach((fill, index) => {
    for (const other of fills.slice(index + 1))
      if (
        overlaps(fill, other) &&
        (fill.argument === other.argument ||
          Math.abs(fill.frame - other.frame) > FRAME_EPSILON ||
          Math.abs(fill.duration - other.duration) > FRAME_EPSILON)
      )
        malformed(`fills at frames ${fill.frame} and ${other.frame} overlap`);
  });

  const binds = of(CopyTrackMarker.Bind);
  const stretches = of(CopyTrackMarker.Stretch);
  for (const stretch of stretches)
    for (const bind of binds)
      if (overlaps(stretch, bind))
        malformed(`a stretch at frame ${stretch.frame} overlaps a bind`);

  const cycleMarkers = of(CopyTrackMarker.Cycle);
  const windows = of(CopyTrackMarker.CycleWindow);
  if (cycleMarkers.length !== windows.length)
    malformed('every cycle needs exactly one window');
  const cycles = windows.map((window) => {
    const cycle = cycleMarkers.find(
      ({ argument }) => argument === window.argument,
    );
    if (!cycle) malformed(`cycle window ${window.argument} has no cycle`);
    const isInTrunk = inside(window, trunk);
    if (
      !isInTrunk &&
      !fills.some((fill) => inside(window, { from: fill.frame, to: end(fill) }))
    )
      malformed(
        `cycle window ${window.argument} lies in neither the trunk nor one fill`,
      );
    /* A trunk window may sit wholly inside a cut, played only by sections that keep that range. */
    if (
      isInTrunk &&
      cuts.some(
        (cut) =>
          overlaps(cut, window) &&
          !inside(window, { from: cut.frame, to: end(cut) }),
      )
    )
      malformed(`cycle window ${window.argument} crosses a cut boundary`);
    if (!inside(cycle, { from: window.frame, to: end(window) }))
      malformed(`cycle ${window.argument} lies outside its window`);
    return {
      slot: window.argument as string,
      cycle: { from: cycle.frame, to: end(cycle) },
      window: { from: window.frame, to: end(window) },
    };
  });

  const [entry] = of(CopyTrackMarker.Entry);
  const [restore] = of(CopyTrackMarker.Restore);
  const needsCopy = sections.some(({ role }) => role !== undefined);
  if (needsCopy && (!entry || !restore))
    malformed('a section copies but the entry or restore marker is missing');

  return {
    sections,
    trunk,
    splices,
    binds,
    stretches,
    cycles,
    entryFrame: entry?.frame,
    restoreFrame: restore?.frame,
    contacts: of(CopyTrackMarker.Contact),
  };
};
