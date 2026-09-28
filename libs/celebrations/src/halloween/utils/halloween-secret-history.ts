import type { CelebrationAnchors } from '../../models/celebration';
import {
  getCelebrationHistoryRows,
  type CelebrationHistoryRow,
} from '../../utils/celebration-history';
import { animateCelebrationSnapshots } from '../../utils/celebration-snapshots';
import { HalloweenScene } from '../types/halloween';
import { pickPortalRows } from './halloween-portal';

/** Read the existing app-owned marker; the panel itself knows nothing of these scenes. */
export const getSecretSceneTargets = (
  anchors: CelebrationAnchors,
): CelebrationHistoryRow[] => {
  const rows = getCelebrationHistoryRows(anchors);
  return pickPortalRows(rows);
};

const copyFrames = (
  rect: DOMRect,
  stage: DOMRect,
  index: number,
): Keyframe[] => {
  const x = stage.left + stage.width * 0.5 - rect.left - rect.width / 2;
  const y = stage.top + stage.height * 0.56 - rect.top - rect.height / 2;
  const turn = index ? 18 : -18;
  const move = (dx: number, dy: number, scale: number, angle = 0) =>
    `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${angle}deg)`;
  const start = [
    { offset: 0, opacity: 0, transform: 'none' },
    { offset: 0.24, opacity: 0, transform: 'none' },
    { offset: 0.25, opacity: 1, transform: 'none' },
  ];
  return [
    ...start,
    { offset: 0.42, opacity: 1, transform: move(x, y, 0.18, turn) },
    { offset: 0.5, opacity: 0, transform: move(x, y + 12, 0.02, turn * 2) },
    { offset: 0.59, opacity: 0, transform: move(x, y, 0.08) },
    {
      offset: 0.68,
      opacity: 1,
      transform: move(
        x + (index ? 24 : -24),
        y - stage.height * 0.32,
        0.35,
        -turn,
      ),
    },
    { offset: 0.94, opacity: 1, transform: 'none' },
    { offset: 0.98, opacity: 0, transform: 'none' },
    { offset: 1, opacity: 0, transform: 'none' },
  ];
};

/** Animate inert history copies while keeping original rows under React ownership. */
export const animateSecretSceneHistory = (
  scene: HalloweenScene,
  targets: readonly CelebrationHistoryRow[],
  host: HTMLElement,
  stage: DOMRect,
  onStop?: () => void,
): (() => void) =>
  animateCelebrationSnapshots(targets, host, {
    durationMs: 8000,
    hideAt: 0.25,
    restoreAt: 0.94,
    frames: (rect, index) => copyFrames(rect, stage, index),
    decorateCopy:
      scene === HalloweenScene.Cauldron
        ? (copy) =>
            Object.assign(copy.style, {
              borderRadius: '24px',
              boxShadow: '0 0 14px #b6e78b99',
              border: '1px solid #bbdf9c',
            })
        : undefined,
    onStop,
  });
