import {
  animateCelebrationSnapshots,
  type CelebrationSnapshotTarget,
} from './celebration-snapshots';

export const MUMMY_ANIMATION_MS = 12000;

export interface MummyPushLayout {
  x: number;
  y: number;
  width: number;
  direction: 1 | -1;
  entrance: number;
  distance: number;
}

/** Read the input library's public class without changing its markup or focus. */
export const getMummyComposerTarget = (
  wrapperClass: string,
): CelebrationSnapshotTarget | null => {
  const viewport = document.documentElement;
  const candidates = document.querySelectorAll<HTMLElement>(`.${wrapperClass}`);
  for (const element of candidates) {
    if (
      element.closest('[inert], [aria-hidden="true"]') ||
      !element.querySelector('textarea:not(:disabled)') ||
      element.getElementsByTagName('*').length >= 1500 ||
      element.querySelector('[aria-haspopup][aria-expanded="true"]')
    )
      continue;
    const rect = element.getBoundingClientRect();
    if (
      rect.width < 80 ||
      rect.height < 40 ||
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > viewport.clientWidth ||
      rect.bottom > viewport.clientHeight
    )
      continue;
    let visible = true;
    for (
      let parent: HTMLElement | null = element;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0'
      ) {
        visible = false;
        break;
      }
      if (
        /(auto|scroll|hidden|clip)/.test(
          `${style.overflow} ${style.overflowX} ${style.overflowY}`,
        )
      ) {
        const clip = parent.getBoundingClientRect();
        if (
          rect.left < clip.left ||
          rect.right > clip.right ||
          rect.top < clip.top ||
          rect.bottom > clip.bottom
        ) {
          visible = false;
          break;
        }
      }
    }
    if (visible) return { element, rect };
  }
  return null;
};

/** Physical geometry also works in RTL: enter from whichever side has room. */
export const buildMummyPushLayout = (
  rect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
): MummyPushLayout => {
  const leftSpace = rect.left;
  const rightSpace = viewportWidth - rect.right;
  const direction =
    leftSpace === rightSpace
      ? Math.random() < 0.5
        ? 1
        : -1
      : leftSpace > rightSpace
        ? 1
        : -1;
  const width = Math.min(150, Math.max(108, rect.height * 0.82));
  const scale = width / 200;
  /* On a narrow screen, let the palms overlap the border enough to keep the face visible. */
  const overlap = Math.min(
    rect.width * 0.2,
    Math.max(0, width * 0.65 - Math.max(leftSpace, rightSpace)),
  );
  const contactX = direction === 1 ? rect.left + overlap : rect.right - overlap;
  const x = contactX - (direction === 1 ? 187 : 13) * scale;
  const y = Math.max(
    8,
    Math.min(
      viewportHeight - width * 1.3 - 8,
      rect.top + Math.min(rect.height * 0.55, 130) - 126 * scale,
    ),
  );
  return {
    x,
    y,
    width,
    direction,
    entrance: (direction === 1 ? -width - 8 : viewportWidth + 8) - x,
    distance:
      direction === 1
        ? viewportWidth - rect.left + width + 24
        : -rect.right - width - 24,
  };
};

/** The same contact trajectory drives both palms and input, including the failed shoves. */
export const animateMummyPush = (
  target: CelebrationSnapshotTarget,
  host: HTMLElement,
  actor: HTMLElement,
  layout: MummyPushLayout,
  onStop?: () => void,
): (() => void) => {
  if (typeof host.animate !== 'function' || typeof actor.animate !== 'function')
    return () => undefined;
  const move = (x: number) => `translateX(${x}px)`;
  const shared = [
    { offset: 0.15, transform: move(0) },
    { offset: 0.36, transform: move(0) },
    { offset: 0.46, transform: move(layout.direction * 22) },
    { offset: 0.82, transform: move(layout.distance) },
    { offset: 1, transform: move(layout.distance) },
  ];
  let actorAnimation: Animation | undefined;
  try {
    actorAnimation = actor.animate(
      [{ offset: 0, transform: move(layout.entrance) }, ...shared].map(
        (frame) => ({ ...frame, easing: 'ease-in-out' }),
      ),
      { duration: MUMMY_ANIMATION_MS, fill: 'both' },
    );
  } catch {
    onStop?.();
    return () => undefined;
  }
  return animateCelebrationSnapshots([target], host, {
    durationMs: MUMMY_ANIMATION_MS,
    hideAt: 0.15,
    restoreAt: 0.94,
    frames: () => [
      { offset: 0, opacity: 0, transform: move(0) },
      { offset: 0.14, opacity: 0, transform: move(0) },
      ...shared.map((frame) => ({ ...frame, opacity: 1 })),
    ],
    onStop: () => {
      actorAnimation?.cancel();
      onStop?.();
    },
  });
};
