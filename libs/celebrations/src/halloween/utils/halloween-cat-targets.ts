import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { findWelcomeRegion } from '../../utils/host-anchors';

export interface CatTargets {
  width: number;
  height: number;
  composer?: CelebrationSnapshotTarget;
  buttons: CelebrationSnapshotTarget[];
  supports: CelebrationSnapshotTarget[];
}

export const CAT_BUTTON_NODE_LIMIT = 60;
const BUTTON_SCAN_LIMIT = 16;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot], [data-halloween-pumpkin-anchor]';
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const UNAVAILABLE = ':disabled, [aria-disabled="true"], [aria-expanded="true"]';
const CLIPPED = /^(auto|scroll|hidden|clip)$/;

interface Candidate {
  target: CelebrationSnapshotTarget;
  control: boolean;
  compact: boolean;
  distance: number;
}

const overlaps = (
  first: CelebrationSnapshotTarget,
  second: CelebrationSnapshotTarget,
) =>
  first.element.contains(second.element) ||
  second.element.contains(first.element) ||
  (first.rect.left < second.rect.right &&
    first.rect.right > second.rect.left &&
    first.rect.top < second.rect.bottom &&
    first.rect.bottom > second.rect.top);

const horizontalGap = (first: DOMRect, second: DOMRect) =>
  Math.max(0, first.left - second.right, second.left - first.right);

/** Capture nearby prizes and landing ledges without copying or changing live UI. */
export const getCatTargets = (anchors: CelebrationAnchors): CatTargets => {
  const { composer: composerClass, starterList: starterListClass } = anchors;
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const rects = new Map<HTMLElement, DOMRect>();
  const styles = new Map<HTMLElement, CSSStyleDeclaration>();
  const measure = (element: HTMLElement) => {
    let rect = rects.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      rects.set(element, rect);
    }
    return rect;
  };
  const styleOf = (element: HTMLElement) => {
    let style = styles.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const visible = (
    element: HTMLElement,
  ): CelebrationSnapshotTarget | undefined => {
    if (element.closest(EXCLUDED)) return undefined;
    const rect = measure(element);
    if (
      rect.width < 20 ||
      rect.height < 20 ||
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > width ||
      rect.bottom > height
    )
      return undefined;
    let parent: HTMLElement | null = element;
    for (
      let depth = 0;
      parent && depth < 32;
      depth++, parent = parent.parentElement
    ) {
      const style = styleOf(parent);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0' ||
        style.contentVisibility === 'hidden'
      )
        return undefined;
      const clipsX = CLIPPED.test(style.overflowX || style.overflow);
      const clipsY = CLIPPED.test(style.overflowY || style.overflow);
      if (clipsX || clipsY) {
        const clip = measure(parent);
        if (
          (clipsX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipsY && (rect.top < clip.top || rect.bottom > clip.bottom))
        )
          return undefined;
      }
    }
    return parent ? undefined : { element, rect };
  };
  let composer: CelebrationSnapshotTarget | undefined;
  const composers = composerClass
    ? document.getElementsByClassName(composerClass)
    : [];
  for (let index = 0; index < Math.min(4, composers.length); index++) {
    const element = composers[index];
    if (element instanceof HTMLElement) composer = visible(element);
    if (composer) break;
  }
  if (!composer) return { width, height, buttons: [], supports: [] };

  const takeButtons = (container: Element) => {
    const buttons = container.getElementsByTagName('button');
    return Array.from(
      { length: Math.min(BUTTON_SCAN_LIMIT, buttons.length) },
      (_, index) => buttons[index],
    );
  };
  const controls = new Set(takeButtons(composer.element));
  const starterButtons = new Set<HTMLButtonElement>();
  const welcome = findWelcomeRegion(composer.element, anchors);
  const lists = starterListClass
    ? welcome?.getElementsByClassName(starterListClass)
    : undefined;
  for (let index = 0; index < Math.min(2, lists?.length ?? 0); index++) {
    const list = lists?.[index];
    if (list) takeButtons(list).forEach((button) => starterButtons.add(button));
  }
  const originX = composer.rect.left + composer.rect.width / 2;
  const distance = ({ rect }: CelebrationSnapshotTarget) =>
    Math.hypot(
      rect.left + rect.width / 2 - originX,
      rect.top + rect.height / 2 - composer.rect.bottom,
    );
  const candidates: Candidate[] = [];
  const ledges: CelebrationSnapshotTarget[] = [];
  for (const element of new Set([...controls, ...starterButtons])) {
    if (
      element.contains(document.activeElement) ||
      element.closest(`${EDITABLE}, ${UNAVAILABLE}`) ||
      element.querySelector(`${EDITABLE}, ${UNAVAILABLE}`)
    )
      continue;
    const target = visible(element);
    if (!target) continue;
    const { rect } = target;
    const control = controls.has(element);
    const belowComposer = rect.top >= composer.rect.bottom;
    const gap = horizontalGap(rect, composer.rect);
    if (
      starterButtons.has(element) &&
      belowComposer &&
      gap <= 180 &&
      rect.top - composer.rect.bottom <= 360
    )
      ledges.push(target);
    if (
      (!control && !belowComposer) ||
      gap > 160 ||
      rect.top - composer.rect.bottom > 260 ||
      rect.bottom < composer.rect.top ||
      rect.width > 300 ||
      rect.height > 96 ||
      rect.width * rect.height > 24000 ||
      element.getElementsByTagName('*').length > CAT_BUTTON_NODE_LIMIT
    )
      continue;
    candidates.push({
      target,
      control,
      compact: rect.width <= 180 && rect.height <= 56,
      distance: distance(target),
    });
  }
  candidates.sort(
    (first, second) =>
      Number(second.control) - Number(first.control) ||
      Number(second.compact) - Number(first.compact) ||
      first.distance - second.distance,
  );
  const options: Candidate[][] = [];
  candidates.forEach((first, index) => {
    options.push([first]);
    for (const second of candidates.slice(index + 1)) {
      if (
        !overlaps(first.target, second.target) &&
        horizontalGap(first.target.rect, second.target.rect) <= 160 &&
        Math.abs(
          first.target.rect.top +
            first.target.rect.height / 2 -
            second.target.rect.top -
            second.target.rect.height / 2,
        ) <= 100
      )
        options.push([first, second]);
    }
  });
  const total = (option: Candidate[], value: (item: Candidate) => number) =>
    option.reduce((sum, item) => sum + value(item), 0);
  options.sort(
    (first, second) =>
      total(second, ({ control }) => Number(control)) -
        total(first, ({ control }) => Number(control)) ||
      second.length - first.length ||
      total(second, ({ compact }) => Number(compact)) -
        total(first, ({ compact }) => Number(compact)) ||
      total(first, ({ distance: fromComposer }) => fromComposer) -
        total(second, ({ distance: fromComposer }) => fromComposer),
  );
  const buttons = options[0]?.map(({ target }) => target) ?? [];
  const supports: CelebrationSnapshotTarget[] = [];
  ledges.sort((first, second) => distance(first) - distance(second));
  for (const ledge of ledges) {
    if (supports.length === 3) break;
    if (
      !buttons.some((button) => overlaps(button, ledge)) &&
      !supports.some((support) => overlaps(support, ledge))
    )
      supports.push(ledge);
  }
  return { width, height, composer, buttons, supports };
};
