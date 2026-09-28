import { ROUTES } from '../types/routes';
import { CELEBRATION_HISTORY_CLASS } from './celebration-history';
import type { CelebrationSnapshotTarget } from './celebration-snapshots';

export interface GhostTargets {
  width: number;
  height: number;
  pumpkin?: CelebrationSnapshotTarget;
  homes: CelebrationSnapshotTarget[];
}

export const GHOST_HOME_NODE_LIMIT = 60;
const HOME_DISTANCE = 96;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const UNAVAILABLE = ':disabled, [aria-disabled="true"], [aria-expanded="true"]';
const PUMPKIN = '[data-halloween-pumpkin-anchor]';
const CLIPPED = /^(auto|scroll|hidden|clip)$/;

const distance = (first: DOMRect, second: DOMRect) =>
  Math.hypot(
    first.left + first.width / 2 - second.left - second.width / 2,
    first.top + first.height / 2 - second.top - second.height / 2,
  );

const shuffled = <T>(items: readonly T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

/** Borrow only small idle surfaces, using existing host-addressable page anchors. */
export const getGhostTargets = (
  composerClass: string,
  starterListClass?: string,
  limit = 5,
): GhostTargets => {
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
      rect.width < 24 ||
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
    if (parent) return undefined;
    return { element, rect };
  };
  const firstVisible = (elements: ArrayLike<Element>) => {
    for (let index = 0; index < Math.min(4, elements.length); index++) {
      const element = elements[index];
      if (!(element instanceof HTMLElement)) continue;
      const target = visible(element);
      if (target) return target;
    }
    return undefined;
  };
  const composer = composerClass
    ? firstVisible(document.getElementsByClassName(composerClass))
    : undefined;
  const pumpkin = firstVisible(document.querySelectorAll(PUMPKIN));
  const welcome = composer?.element.closest('[role="region"]');
  const rows: HTMLElement[] = [];
  const links = document.querySelectorAll<HTMLAnchorElement>(
    `.${CELEBRATION_HISTORY_CLASS} a[href^="${ROUTES.Conversations}/"]`,
  );
  for (let index = 0; index < Math.min(48, links.length); index++) {
    const row = links[index].closest('li');
    if (row && !rows.includes(row)) rows.push(row);
  }
  const starterLists = starterListClass
    ? welcome?.getElementsByClassName(starterListClass)
    : undefined;
  const starters: HTMLElement[] = [];
  for (const list of Array.from(starterLists ?? []).slice(0, 2)) {
    starters.push(
      ...Array.from(list.querySelectorAll<HTMLElement>('button')).slice(0, 16),
    );
  }
  const groups = [
    rows,
    starters,
    Array.from(
      composer?.element.querySelectorAll<HTMLElement>('button') ?? [],
    ).slice(0, 12),
    Array.from(welcome?.querySelectorAll<HTMLElement>('h1, h2') ?? []).slice(
      0,
      2,
    ),
    Array.from(
      document.querySelectorAll<HTMLElement>(
        `.${CELEBRATION_HISTORY_CLASS} h2, .${CELEBRATION_HISTORY_CLASS} button`,
      ),
    ).slice(0, 8),
    Array.from(welcome?.querySelectorAll<HTMLElement>('button') ?? []).slice(
      0,
      16,
    ),
  ];
  const examined = new Set<HTMLElement>();
  const candidates = groups.map((group) =>
    shuffled(group).flatMap((element) => {
      if (examined.has(element)) return [];
      examined.add(element);
      if (
        element.contains(document.activeElement) ||
        element.closest(`${PUMPKIN}, ${EDITABLE}, ${UNAVAILABLE}`) ||
        element.querySelector(`${EDITABLE}, ${UNAVAILABLE}`) ||
        element.getElementsByTagName('*').length > GHOST_HOME_NODE_LIMIT
      )
        return [];
      const target = visible(element);
      if (
        !target ||
        target.rect.width > 440 ||
        target.rect.height > 96 ||
        target.rect.width * target.rect.height > 30000
      )
        return [];
      return [target];
    }),
  );
  const homes: CelebrationSnapshotTarget[] = [];
  const count = Number.isFinite(limit)
    ? Math.max(0, Math.min(5, Math.floor(limit)))
    : 0;
  const eligible = ({ element, rect }: CelebrationSnapshotTarget) =>
    homes.every(
      (home) =>
        !home.element.contains(element) &&
        !element.contains(home.element) &&
        distance(home.rect, rect) >= HOME_DISTANCE &&
        (rect.right <= home.rect.left ||
          rect.left >= home.rect.right ||
          rect.bottom <= home.rect.top ||
          rect.top >= home.rect.bottom),
    );
  const choose = (group: CelebrationSnapshotTarget[]) => {
    const available = group.filter(eligible);
    if (!available.length || homes.length >= count) return;
    const nearestDistance = (target: CelebrationSnapshotTarget) =>
      Math.min(...homes.map((home) => distance(home.rect, target.rect)));
    const selected = homes.length
      ? available.reduce((best, target) =>
          nearestDistance(target) > nearestDistance(best) ? target : best,
        )
      : available[0];
    homes.push(selected);
  };
  /* Reserve opportunities for different page regions before filling spare slots. */
  candidates.forEach(choose);
  const remaining = candidates.flat();
  while (homes.length < count) {
    const previousCount = homes.length;
    choose(remaining);
    if (homes.length === previousCount) break;
  }
  return { width, height, pumpkin, homes };
};
