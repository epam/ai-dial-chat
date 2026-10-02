import type { AnimationItem } from 'lottie-web';
import {
  createLottieLightSvgAnimation,
  type LottiePlayer,
} from '../../utils/lottie-player';
import {
  PENGUIN_STAR_MS,
  type PenguinStarComposition,
} from './penguin-star-composition';
import { borrowPenguinStarElement } from './penguin-star-selector';

/** Play the scene and release its resources on completion or interruption. */
export const animatePenguinStar = (
  plan: PenguinStarComposition,
  host: HTMLElement,
  player: LottiePlayer,
  onStop: (failed: boolean) => void,
): (() => void) => {
  let animation: AnimationItem | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let readiness: ReturnType<typeof setTimeout> | undefined;
  let mutation: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  let stopped = false;
  let playing = false;
  let borrowed = false;
  let restoreBorrowed: (() => void) | undefined;
  const sources = [
    plan.targets.source,
    plan.targets.heading,
    plan.targets.starters,
    plan.targets.starterButton,
    plan.targets.borrowed,
  ].filter((target) => target != null);
  const finish = (failed: boolean) => {
    if (stopped) return;
    stopped = true;
    host.style.visibility = 'hidden';
    clearTimeout(deadline);
    clearTimeout(readiness);
    mutation?.disconnect();
    resize?.disconnect();
    restoreBorrowed?.();
    if (animation) {
      animation.removeEventListener('DOMLoaded', ready);
      animation.removeEventListener('enterFrame', onFrame);
      animation.removeEventListener('complete', stop);
      animation.removeEventListener('data_failed', fail);
      animation.removeEventListener('error', fail);
      try {
        animation.destroy();
      } catch {
        host.replaceChildren();
      }
    }
    onStop(failed);
  };
  const stop = () => finish(false);
  const fail = () => finish(true);
  const onFrame = () => {
    if (stopped || borrowed || (animation?.currentFrame ?? 0) < 5.1 * 60)
      return;
    borrowed = true;
    const target = plan.targets.borrowed;
    if (target?.element.isConnected)
      restoreBorrowed = borrowPenguinStarElement(
        target.element,
        target.rect,
        plan.capturePoint,
      );
  };
  const ready = () => {
    if (stopped || playing || !animation?.isLoaded) return;
    playing = true;
    clearTimeout(readiness);
    animation.removeEventListener('DOMLoaded', ready);
    deadline = setTimeout(stop, PENGUIN_STAR_MS);
    try {
      animation.play();
    } catch {
      fail();
    }
  };
  const moved = () => {
    if (stopped) return;
    if (
      sources.some(({ element, rect }) => {
        if (!element.isConnected) return true;
        const current = element.getBoundingClientRect();
        return (['left', 'top', 'width', 'height'] as const).some(
          (key) => Math.abs(current[key] - rect[key]) > 0.5,
        );
      })
    )
      stop();
  };
  try {
    animation = createLottieLightSvgAnimation(player, host, plan.animationData);
    animation.addEventListener('DOMLoaded', ready);
    animation.addEventListener('enterFrame', onFrame);
    animation.addEventListener('complete', stop);
    animation.addEventListener('data_failed', fail);
    animation.addEventListener('error', fail);
    if (sources.length) {
      mutation = new MutationObserver((records) => {
        const relevant = records.filter(
          (record) =>
            !host.contains(record.target) &&
            !(
              record.type === 'childList' &&
              [...record.addedNodes, ...record.removedNodes].every(
                (node) => node === host || host.contains(node),
              )
            ),
        );
        if (
          sources.some(
            ({ element }) =>
              !element.isConnected ||
              relevant.some(
                (record) =>
                  element.contains(record.target) ||
                  (record.type === 'attributes' &&
                    record.target instanceof Element &&
                    record.target.contains(element)),
              ),
          )
        )
          stop();
        else if (relevant.length) moved();
      });
      mutation.observe(document.documentElement, {
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
          'aria-disabled',
          'aria-expanded',
          'disabled',
          'open',
        ],
      });
      resize = new ResizeObserver(moved);
      const watched = new Set<HTMLElement>();
      sources.forEach(({ element }) => {
        let ancestor: HTMLElement | null = element;
        for (
          let depth = 0;
          ancestor && depth < 24;
          depth++, ancestor = ancestor.parentElement
        )
          if (!watched.has(ancestor)) {
            watched.add(ancestor);
            resize?.observe(ancestor);
          }
      });
    }
    readiness = setTimeout(fail, 250);
    if (animation.isLoaded) queueMicrotask(ready);
  } catch {
    fail();
  }
  return stop;
};
