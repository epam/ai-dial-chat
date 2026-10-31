import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { findWelcomeRegion } from '../../utils/host-anchors';
import { getGiftWrappingTarget } from './gift-wrapping-targets';
import type { ReindeerPoint } from './reindeer-art';
import { nosePoint } from './reindeer-physics';
import { getReindeerText, type ReindeerText } from './reindeer-text';

/** All geometry is measured once in viewport pixels before the session starts. */
export interface ReindeerTargets {
  width: number;
  height: number;
  scale: number;
  dir: number;
  origin: ReindeerPoint;
  catchPoint: ReindeerPoint;
  bounds: { left: number; right: number };
  rim: { left: number; right: number };
  composer: CelebrationSnapshotTarget | null;
  word: ReindeerText | null;
  watched: HTMLElement[];
  isStatic: boolean;
}

/** The input's upper border supports the cast; only a word is visually borrowed. */
export const getReindeerTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): ReindeerTargets => {
  const stage = getGiftWrappingTarget(anchors, isMobile);
  const { width, height, source } = stage;
  const region = findWelcomeRegion(source?.element, anchors);
  const regionRect = region?.getBoundingClientRect();
  const bounds = {
    left: Math.max(0, regionRect?.left ?? 0),
    right: Math.min(width, regionRect?.right ?? width),
  };
  const rim = source
    ? { left: source.rect.left + 8, right: source.rect.right - 8 }
    : bounds;
  const scale = Math.min(
    isMobile ? 0.7 : 1.05,
    (rim.right - rim.left - 24) / 390,
  );
  const dir = stage.rtl ? -1 : 1;
  const floor = source
    ? source.rect.top - 2
    : Math.min(height - 24, stage.box.top + 165 * scale);
  const origin: ReindeerPoint = source
    ? [(dir === 1 ? rim.right : rim.left) - dir * 200 * scale, floor]
    : [(bounds.left + bounds.right) / 2 - dir * 10 * scale, floor];
  const word = source ? getReindeerText(source) : null;
  const catchPoint: ReindeerPoint = word
    ? [word.rect.left + word.rect.width / 2, word.rect.bottom - 2]
    : [
        origin[0] - dir * 60 * scale,
        floor + (nosePoint(true, 0, 0)[1] + 3) * 0.68 * scale,
      ];
  const watched = source ? [source.element] : [];
  if (region instanceof HTMLElement) watched.push(region);
  if (word) watched.push(word.element);
  return {
    width,
    height,
    dir,
    scale,
    origin,
    catchPoint,
    bounds,
    rim,
    composer: source,
    word,
    watched,
    isStatic:
      scale < 0.45 ||
      floor < 180 * scale ||
      floor + 12 > height ||
      (!source && !!anchors.composer),
  };
};
