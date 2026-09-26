import { animateCelebrationSnapshots } from './celebration-snapshots';
import {
  GHOST_PUMPKIN_REACTION,
  GHOST_RESTORE,
  GHOST_SCENE_MS,
  type GhostPlan,
} from './halloween-ghost-plan';

interface GhostElements {
  host: HTMLElement;
  copies: HTMLElement;
  actors: HTMLElement[];
  faceTemplate: HTMLElement | null;
  pumpkinGlow: HTMLElement | null;
}

/** Play finite, synchronized decoration and restore every original on interruption. */
export const animateGhosts = (
  plan: GhostPlan,
  { host, copies, actors, faceTemplate, pumpkinGlow }: GhostElements,
  onStop: () => void,
): (() => void) => {
  if (!plan.active || typeof host.animate !== 'function')
    return () => undefined;
  const animations: Animation[] = [];
  let stopSnapshots: (() => void) | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  const events = [
    'pointerdown',
    'focusin',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'visibilitychange',
  ];
  const anchors = [
    ...plan.homes.map(({ target }) => target.element),
    ...(plan.pumpkin ? [plan.pumpkin.element] : []),
  ];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    observer.disconnect();
    stopSnapshots?.();
    animations.forEach((animation) => animation.cancel());
    events.forEach((event) =>
      document.removeEventListener(event, interrupt, true),
    );
    window.removeEventListener('resize', stop);
    onStop();
  };
  const interrupt = (event: Event) => {
    if (
      event.type === 'scroll' &&
      event.target instanceof Node &&
      host.contains(event.target)
    )
      return;
    if (event.type === 'visibilitychange' && !document.hidden) return;
    stop();
  };
  const observer = new MutationObserver((records) => {
    if (
      anchors.some(
        (element) =>
          !element.isConnected ||
          records.some(
            (record) =>
              element.contains(record.target) ||
              (record.type === 'attributes' &&
                record.target instanceof Element &&
                record.target.contains(element)),
          ),
      )
    )
      stop();
  });
  const animate = (element: Element, frames: Keyframe[]) => {
    const animation = element.animate(
      frames.map((frame) => ({ easing: 'ease-in-out', ...frame })),
      { duration: GHOST_SCENE_MS, fill: 'both' },
    );
    animations.push(animation);
    if (startTime !== undefined) animation.startTime = startTime;
  };
  try {
    plan.actors.forEach((ghost, index) => {
      const actor = actors[index];
      if (!actor) throw new Error('Missing ghost actor');
      animate(actor, ghost.frames);
      const cloth = actor.querySelector('[data-ghost-cloth]');
      if (cloth) animate(cloth, ghost.clothFrames);
      const frightened = actor.querySelector('[data-ghost-fright-face]');
      if (frightened) animate(frightened, ghost.frightFrames);
      const calm = actor.querySelector('[data-ghost-calm-face]');
      if (calm)
        animate(
          calm,
          ghost.frightFrames.map((frame) => ({
            ...frame,
            opacity: 1 - Number(frame.opacity),
          })),
        );
      const arms = actor.querySelector('[data-ghost-arms]');
      if (arms)
        animate(arms, [
          { offset: 0, opacity: 0, transform: 'scale(0.6)' },
          { offset: 0.37, opacity: 0, transform: 'scale(0.6)' },
          {
            offset: 0.425,
            opacity: ghost.leader ? 1 : 0,
            transform: 'scale(1)',
          },
          {
            offset: GHOST_PUMPKIN_REACTION,
            opacity: ghost.leader ? 1 : 0,
            transform: 'scale(1)',
          },
          { offset: 0.56, opacity: 0, transform: 'scale(0.4)' },
          { offset: 1, opacity: 0, transform: 'scale(0.4)' },
        ]);
    });
    const pumpkinFrames: Keyframe[] = [
      { offset: 0, transform: 'rotate(0deg) scale(1)' },
      {
        offset: GHOST_PUMPKIN_REACTION - 0.015,
        transform: 'rotate(0deg) scale(1)',
      },
      { offset: 0.535, transform: 'rotate(-6deg) scale(1.08)' },
      { offset: 0.558, transform: 'rotate(6deg) scale(1.04)' },
      { offset: 0.585, transform: 'rotate(-4deg) scale(1.06)' },
      { offset: 0.62, transform: 'rotate(0deg) scale(1)' },
      { offset: 1, transform: 'rotate(0deg) scale(1)' },
    ];
    if (pumpkinGlow) {
      animate(pumpkinGlow, pumpkinFrames);
      animate(pumpkinGlow, [
        { offset: 0, opacity: 0 },
        { offset: GHOST_PUMPKIN_REACTION - 0.015, opacity: 0 },
        { offset: 0.54, opacity: 0.95 },
        { offset: 0.6, opacity: 0.85 },
        { offset: 0.68, opacity: 0 },
        { offset: 1, opacity: 0 },
      ]);
    }
    /* Animate the artwork only: the original labelled button retains its focus ring. */
    const pumpkinArt = plan.pumpkin?.element.querySelector('svg');
    if (pumpkinArt) animate(pumpkinArt, pumpkinFrames);
    const pumpkinLight = plan.pumpkin?.element.querySelector(
      '[data-halloween-pumpkin-light]',
    );
    if (pumpkinLight)
      animate(pumpkinLight, [
        { offset: 0, filter: 'brightness(1)' },
        { offset: GHOST_PUMPKIN_REACTION - 0.015, filter: 'brightness(1)' },
        { offset: 0.54, filter: 'brightness(1.8)' },
        { offset: 0.6, filter: 'brightness(1.5)' },
        { offset: 0.68, filter: 'brightness(1)' },
        { offset: 1, filter: 'brightness(1)' },
      ]);
    stopSnapshots = animateCelebrationSnapshots(
      plan.homes.map(({ target }) => target),
      copies,
      {
        durationMs: GHOST_SCENE_MS,
        hideAt: (index) => plan.homes[index].entry,
        restoreAt: GHOST_RESTORE,
        startTime,
        onStop: stop,
        frames: (_rect, index) => plan.homes[index].frames,
        decorateCopy: (copy, index) => {
          copy.dataset.ghostHome = String(index);
          copy.style.overflow = 'visible';
          if (!faceTemplate) return;
          const face = faceTemplate.cloneNode(true) as HTMLElement;
          face.removeAttribute('hidden');
          face.removeAttribute('id');
          face.dataset.ghostPossessedFace = String(index);
          /* Scale only the face so narrow controls remain recognizable. */
          face.style.setProperty(
            '--ghost-face-scale',
            String(
              Math.min(
                1,
                plan.homes[index].target.rect.width / 64,
                plan.homes[index].target.rect.height / 38,
              ),
            ),
          );
          copy.appendChild(face);
          animate(face, plan.homes[index].eyesFrames);
          face
            .querySelectorAll('[data-ghost-pupil]')
            .forEach((pupil) => animate(pupil, plan.homes[index].lookFrames));
        },
      },
    );
    if (stopped) {
      stopSnapshots();
      return stop;
    }
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'dir',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-expanded',
        'disabled',
        'aria-disabled',
        'href',
      ],
    });
    events.forEach((event) =>
      document.addEventListener(event, interrupt, true),
    );
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, GHOST_SCENE_MS);
  } catch {
    stop();
  }
  return stop;
};
