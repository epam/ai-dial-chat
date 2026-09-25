import { ROUTES } from '../types/routes';
import { CELEBRATION_HISTORY_CLASS } from './celebration-history';

interface ComposerClasses {
  wrapper: string;
  modelSelectorButton: string;
  addCluster: string;
}

export interface HalloweenWebTarget {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MAX_TARGETS = 12;
const MAX_HISTORY_CANDIDATES = 48;
const MAX_COMPOSERS = 4;
const MAX_PUMPKINS = 4;
const MAX_ANCESTORS = 24;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const CLIPPING_OVERFLOW = /^(auto|scroll|hidden|clip)$/;

/** Read existing app geometry once; seasonal webs never alter the real controls. */
export const getHalloweenWebTargets = (
  classes: ComposerClasses,
): HalloweenWebTarget[] => {
  const viewport = document.documentElement;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return [];

  const bounds = new Map<HTMLElement, DOMRect>();
  const styles = new Map<HTMLElement, CSSStyleDeclaration>();
  const selected: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const result: HalloweenWebTarget[] = [];
  const measure = (element: HTMLElement): DOMRect => {
    let rect = bounds.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      bounds.set(element, rect);
    }
    return rect;
  };

  const add = (element: HTMLElement | null | undefined) => {
    if (
      !element ||
      result.length >= MAX_TARGETS ||
      seen.has(element) ||
      element.closest(EXCLUDED) ||
      element.matches('[role="presentation"], [role="none"]')
    )
      return;
    seen.add(element);
    if (
      selected.some(
        (other) => other.contains(element) || element.contains(other),
      )
    )
      return;

    const rect = measure(element);
    if (
      rect.width < 12 ||
      rect.height < 12 ||
      rect.width * rect.height > width * height * 0.48 ||
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > width ||
      rect.bottom > height
    )
      return;

    let parent: HTMLElement | null = element;
    let depth = 0;
    while (parent && depth++ < MAX_ANCESTORS) {
      let style = styles.get(parent);
      if (!style) {
        style = getComputedStyle(parent);
        styles.set(parent, style);
      }
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0' ||
        style.contentVisibility === 'hidden'
      )
        return;

      const clipX = CLIPPING_OVERFLOW.test(style.overflowX || style.overflow);
      const clipY = CLIPPING_OVERFLOW.test(style.overflowY || style.overflow);
      if (clipX || clipY) {
        const clip = measure(parent);
        if (
          (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
        )
          return;
      }
      parent = parent.parentElement;
    }
    if (parent) return;

    if (
      result.some(
        (other) =>
          Math.abs(other.left - rect.left) < 2 &&
          Math.abs(other.top - rect.top) < 2 &&
          Math.abs(other.width - rect.width) < 2 &&
          Math.abs(other.height - rect.height) < 2,
      )
    )
      return;
    selected.push(element);
    result.push({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  const composers = document.getElementsByClassName(classes.wrapper);
  for (
    let index = 0;
    index < Math.min(composers.length, MAX_COMPOSERS);
    index++
  ) {
    const wrapper = composers[index] as HTMLElement;
    add(wrapper);
    /* Controls provide smaller anchors when the composer itself is too large. */
    add(
      wrapper.getElementsByClassName(
        classes.modelSelectorButton,
      )[0] as HTMLElement,
    );
    add(wrapper.getElementsByClassName(classes.addCluster)[0] as HTMLElement);
    if (result.length) {
      add(wrapper.closest('[role="region"]')?.querySelector<HTMLElement>('h1'));
      break;
    }
  }

  const pumpkins = document.querySelectorAll<HTMLElement>(
    '[data-halloween-pumpkin-anchor]',
  );
  for (
    let index = 0;
    index < Math.min(pumpkins.length, MAX_PUMPKINS);
    index++
  ) {
    const previousCount = result.length;
    add(pumpkins[index].querySelector('button') ?? pumpkins[index]);
    if (result.length > previousCount) {
      const rect = result[previousCount];
      /* The pumpkin body occupies the lower middle of its 160 × 160 artwork.
         Place silk on the skin, away from the empty corners and stem. */
      result[previousCount] = {
        left: rect.left + rect.width * 0.16,
        top: rect.top + rect.height * 0.28,
        width: rect.width * 0.68,
        height: rect.height * 0.58,
      };
      break;
    }
  }

  const links = document.querySelectorAll<HTMLAnchorElement>(
    `.${CELEBRATION_HISTORY_CLASS} a[href^="${ROUTES.Conversations}/"]`,
  );
  for (
    let index = 0;
    index < Math.min(links.length, MAX_HISTORY_CANDIDATES) &&
    result.length < MAX_TARGETS;
    index++
  ) {
    add(links[index].closest('li'));
  }
  return result;
};
