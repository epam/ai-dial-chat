import { ROUTES } from '../types/routes';
import { CELEBRATION_HISTORY_CLASS } from './celebration-history';
import type { CelebrationSnapshotTarget } from './celebration-snapshots';

export interface BatTargets {
  width: number;
  height: number;
  composer?: CelebrationSnapshotTarget;
  perch?: CelebrationSnapshotTarget;
  surfaces: CelebrationSnapshotTarget[];
}

export const BAT_SURFACE_NODE_LIMIT = 60;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const EDITABLE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const UNAVAILABLE = ':disabled, [aria-disabled="true"], [aria-expanded="true"]';
const PUMPKIN = '[data-halloween-pumpkin-anchor]';
const CLIPPED = /^(auto|scroll|hidden|clip)$/;

/** Measure idle surfaces near the sleeping bat without touching the live composer. */
export const getBatTargets = (
  composerClass: string,
  starterListClass?: string,
  limit = 5,
): BatTargets => {
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
  if (!composer) return { width, height, surfaces: [] };

  const welcome = composer.element.closest('[role="region"]');
  const controls = Array.from(
    composer.element.querySelectorAll<HTMLElement>('button'),
  ).slice(0, 12);
  const starters: HTMLElement[] = [];
  const starterLists = starterListClass
    ? welcome?.getElementsByClassName(starterListClass)
    : undefined;
  for (const list of Array.from(starterLists ?? []).slice(0, 2)) {
    starters.push(
      ...Array.from(list.querySelectorAll<HTMLElement>('button')).slice(0, 16),
    );
  }
  const rows: HTMLElement[] = [];
  const links = document.querySelectorAll<HTMLAnchorElement>(
    `.${CELEBRATION_HISTORY_CLASS} a[href^="${ROUTES.Conversations}/"]`,
  );
  for (let index = 0; index < Math.min(48, links.length); index++) {
    const row = links[index].closest('li');
    if (row) rows.push(row);
  }
  const candidates = new Set([
    ...controls,
    ...starters,
    ...rows,
    ...Array.from(welcome?.querySelectorAll<HTMLElement>('h1, h2') ?? []).slice(
      0,
      2,
    ),
    ...Array.from(
      document.querySelectorAll<HTMLElement>(
        `.${CELEBRATION_HISTORY_CLASS} h2, .${CELEBRATION_HISTORY_CLASS} button`,
      ),
    ).slice(0, 8),
    ...Array.from(welcome?.querySelectorAll<HTMLElement>('button') ?? []).slice(
      0,
      16,
    ),
  ]);
  const originX = composer.rect.left + composer.rect.width / 2;
  const originY = composer.rect.bottom;
  const distance = ({ rect }: CelebrationSnapshotTarget) =>
    Math.hypot(
      rect.left + rect.width / 2 - originX,
      rect.top + rect.height / 2 - originY,
    );
  const range = Math.min(620, Math.max(280, width * 0.55));
  const available: CelebrationSnapshotTarget[] = [];
  for (const element of candidates) {
    if (
      element.contains(composer.element) ||
      element.contains(document.activeElement) ||
      element.closest(`${PUMPKIN}, ${EDITABLE}, ${UNAVAILABLE}`) ||
      element.querySelector(`${EDITABLE}, ${UNAVAILABLE}`) ||
      element.getElementsByTagName('*').length > BAT_SURFACE_NODE_LIMIT
    )
      continue;
    const target = visible(element);
    if (
      target &&
      target.rect.width <= 440 &&
      target.rect.height <= 110 &&
      target.rect.width * target.rect.height <= 33000 &&
      distance(target) <= range
    )
      available.push(target);
  }
  available.sort((first, second) => distance(first) - distance(second));
  const perch = available.find(
    ({ element, rect }) =>
      element.matches('button') &&
      rect.width <= 180 &&
      rect.height <= 56 &&
      distance({ element, rect }) <= 320,
  );
  const surfaces: CelebrationSnapshotTarget[] = [];
  const count = Number.isFinite(limit)
    ? Math.max(0, Math.min(5, Math.floor(limit)))
    : 0;
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
  for (const target of available) {
    if (surfaces.length >= count) break;
    if (
      (perch && overlaps(target, perch)) ||
      surfaces.some((surface) => overlaps(target, surface))
    )
      continue;
    surfaces.push(target);
  }
  return { width, height, composer, perch, surfaces };
};
