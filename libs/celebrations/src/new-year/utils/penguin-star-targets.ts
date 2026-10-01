import type { CelebrationAnchors } from '../../models/celebration';
import {
  getGiftWrappingTarget,
  type GiftWrappingTarget,
} from './gift-wrapping-targets';

interface MeasuredElement {
  element: HTMLElement;
  rect: DOMRect;
}

/** Read-only composer and selector coordinates for the scene. */
export interface PenguinStarTargets extends GiftWrappingTarget {
  /** Greeting whose text must remain visible throughout playback. */
  heading: MeasuredElement | null;
  /** Starter prompts must remain readable while the fir stands. */
  starters?: MeasuredElement | null;
  /** An idle starter prompt that may be borrowed for the star. */
  starterButton?: MeasuredElement | null;
  /** The existing interface element pulled into the penguin's flipper. */
  borrowed?: MeasuredElement | null;
  /** Eligible model selector used when no starter prompt can be borrowed. */
  modelSelector?: MeasuredElement | null;
  /** Fir center on the selector side of the stage. */
  center: number;
  /** Penguin's separate throwing position opposite the fir. */
  throwCenter: number;
}

const measured = (element: Element | null): MeasuredElement | null => {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility !== 'visible') return null;
  return { element, rect };
};

/** Keep the cast clear of host text and find one reversible interface prop. */
export const getPenguinStarTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): PenguinStarTargets => {
  const stage = getGiftWrappingTarget(anchors, isMobile);
  const size = isMobile ? 0.68 : 0.9;
  const region = stage.source?.element.closest(
    anchors.welcomeRegion ?? '[role="region"]',
  );
  const heading = measured(
    region?.querySelector('h1, h2, [role="heading"]') ?? null,
  );
  const starters = measured(
    anchors.starterList
      ? (region?.getElementsByClassName(anchors.starterList)[0] ?? null)
      : null,
  );
  const starterButtons: MeasuredElement[] = [];
  if (starters) {
    const buttons = starters.element.getElementsByTagName('button');
    for (let index = 0; index < Math.min(buttons.length, 4); index++) {
      const candidate = measured(buttons[index]);
      if (!candidate) continue;
      const { element, rect } = candidate;
      const style = getComputedStyle(element);
      if (
        !element.isConnected ||
        element.matches(':disabled, [aria-disabled="true"]') ||
        element.contains(document.activeElement) ||
        element.closest('[hidden], [inert], [aria-hidden="true"]') ||
        (style.transform !== 'none' && style.transform !== '') ||
        typeof element.animate !== 'function' ||
        rect.width < 36 ||
        rect.width > 240 ||
        rect.height < 24 ||
        rect.height > 72 ||
        rect.left < 0 ||
        rect.right > stage.width ||
        rect.top < 0 ||
        rect.bottom > stage.height
      )
        continue;
      starterButtons.push(candidate);
    }
  }
  const candidates =
    stage.source && anchors.composerModelSelector
      ? stage.source.element.getElementsByClassName(
          anchors.composerModelSelector,
        )
      : [];
  let modelSelector: MeasuredElement | null = null;
  for (let index = 0; index < Math.min(candidates.length, 4); index++) {
    const selector = measured(candidates[index]);
    if (!selector) continue;
    const { element, rect } = selector;
    const style = getComputedStyle(element);
    if (
      !element.isConnected ||
      !element.matches('button, [role="button"]') ||
      element.matches(
        ':disabled, [aria-disabled="true"], [aria-expanded="true"]',
      ) ||
      element.isContentEditable ||
      element.matches('[contenteditable]:not([contenteditable="false"])') ||
      element.closest('[hidden], [inert], [aria-hidden="true"]') ||
      element.contains(document.activeElement) ||
      (style.transform !== 'none' && style.transform !== '') ||
      typeof element.animate !== 'function' ||
      rect.width < 36 ||
      rect.width > 180 ||
      rect.height < 30 ||
      rect.height > 72 ||
      rect.left < Math.max(0, stage.box.left - 2) ||
      rect.right >
        Math.min(stage.width, stage.box.left + stage.box.width + 2) ||
      rect.top < 0 ||
      rect.bottom > stage.height
    )
      continue;
    let ancestor = element.parentElement;
    let clipped = false;
    while (ancestor && ancestor !== stage.source?.element) {
      const ancestorStyle = getComputedStyle(ancestor);
      const clipX = /^(auto|scroll|hidden|clip)$/.test(ancestorStyle.overflowX);
      const clipY = /^(auto|scroll|hidden|clip)$/.test(ancestorStyle.overflowY);
      if (clipX || clipY) {
        const clip = ancestor.getBoundingClientRect();
        if (
          (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
        ) {
          clipped = true;
          break;
        }
      }
      ancestor = ancestor.parentElement;
    }
    if (clipped) continue;
    modelSelector = selector;
    break;
  }
  const dir = stage.rtl ? -1 : 1;
  const offset = isMobile ? 16 : 20;
  const clearance = 54 * size + 8;
  const candidateCenter = modelSelector
    ? stage.rtl
      ? modelSelector.rect.left - offset
      : modelSelector.rect.right + offset
    : stage.box.left + stage.box.width * (stage.rtl ? 0.3 : 0.7);
  const center = Math.min(
    stage.width - clearance,
    Math.max(clearance, candidateCenter),
  );
  const gap = isMobile ? 112 : 160;
  const throwCenter = center - dir * gap;
  const starterButton =
    starterButtons.reduce<MeasuredElement | null>((nearest, candidate) => {
      const distance = Math.abs(
        candidate.rect.left + candidate.rect.width / 2 - throwCenter,
      );
      const previous = nearest
        ? Math.abs(nearest.rect.left + nearest.rect.width / 2 - throwCenter)
        : Infinity;
      return distance < previous ? candidate : nearest;
    }, null) ?? null;
  const targets: PenguinStarTargets = {
    ...stage,
    heading,
    starters,
    starterButton,
    modelSelector,
    borrowed: starterButton ?? modelSelector,
    center,
    throwCenter,
  };
  if (!stage.source) {
    targets.box.top = Math.min(
      stage.height - 28,
      Math.max(stage.box.top, stage.height * 0.7),
    );
    return targets;
  }

  const floor = stage.box.top + 2 * size;
  const castLeft = Math.min(targets.center, targets.throwCenter) - 70 * size;
  const castRight = Math.max(targets.center, targets.throwCenter) + 70 * size;
  const blocked = [heading, starters].some(
    (item) =>
      item &&
      item.rect.bottom > floor - 190 * size &&
      item.rect.top < floor + 12 * size &&
      item.rect.left < castRight &&
      item.rect.right > castLeft,
  );
  if (blocked) {
    /* When greeting or starters occupy the rim, keep the story on a snow
       patch below the composer instead of obscuring host content. */
    targets.source = null;
    targets.box.top = Math.min(
      stage.height - 28,
      Math.max(
        stage.box.top + stage.box.height + 190 * size + 16,
        stage.height * 0.7,
      ),
    );
  }
  return targets;
};
