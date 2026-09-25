import { ROUTES } from '../types/routes';
import { CELEBRATION_HISTORY_CLASS } from './celebration-history';
import type { CelebrationSnapshotTarget } from './celebration-snapshots';

export interface RavenSurface extends CelebrationSnapshotTarget {
  color: string;
  background: string;
}

export interface RavenFragment extends RavenSurface {
  crop: DOMRect;
}

export interface RavenTargets {
  width: number;
  height: number;
  composer: RavenSurface | null;
  pumpkin: RavenSurface | null;
  conversation: RavenSurface | null;
  edges: RavenSurface[];
  fragments: RavenFragment[];
}

const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const CLIPPED = /^(auto|scroll|hidden|clip)$/;
const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;
export const RAVEN_ROW_NODE_LIMIT = 80;
export const RAVEN_FRAGMENT_NODE_LIMIT = 16;
export const RAVEN_FRAGMENT_CLIP =
  'polygon(3% 8%, 21% 0%, 35% 7%, 52% 0%, 68% 6%, 94% 0%, 100% 24%, 95% 52%, 100% 84%, 80% 100%, 59% 94%, 40% 100%, 23% 92%, 0% 100%, 5% 68%, 0% 33%)';

/** A bounded read-only snapshot; no page component needs to know about ravens. */
export const getRavenTargets = (composerClass: string): RavenTargets => {
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
  const visible = (element: HTMLElement | null): RavenSurface | null => {
    if (!element || element.closest(EXCLUDED)) return null;
    const rect = measure(element);
    if (
      rect.width < 24 ||
      rect.height < 12 ||
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > width ||
      rect.bottom > height
    )
      return null;
    let parent: HTMLElement | null = element;
    let background = '';
    for (
      let depth = 0;
      parent && depth < 24;
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
        return null;
      if (
        !background &&
        style.backgroundColor &&
        !TRANSPARENT.test(style.backgroundColor)
      ) {
        background = style.backgroundColor;
      }
      const clipX = CLIPPED.test(style.overflowX || style.overflow);
      const clipY = CLIPPED.test(style.overflowY || style.overflow);
      if (clipX || clipY) {
        const clip = measure(parent);
        if (
          (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
        )
          return null;
      }
    }
    if (parent) return null;
    const style = styleOf(element);
    return {
      element,
      rect,
      color:
        style.borderTopWidth !== '0px' &&
        style.borderTopColor &&
        !TRANSPARENT.test(style.borderTopColor)
          ? style.borderTopColor
          : '#a999c2',
      background: background || 'var(--bg-primary, #141220)',
    };
  };
  const first = (elements: ArrayLike<HTMLElement>, limit: number) => {
    for (let index = 0; index < Math.min(limit, elements.length); index++) {
      const target = visible(elements[index]);
      if (target) return target;
    }
    return null;
  };
  const composer = first(
    document.getElementsByClassName(
      composerClass,
    ) as HTMLCollectionOf<HTMLElement>,
    4,
  );
  const pumpkin = first(
    document.querySelectorAll<HTMLElement>('[data-halloween-pumpkin-anchor]'),
    4,
  );
  const rows: RavenSurface[] = [];
  const seen = new Set<HTMLElement>();
  const links = document.querySelectorAll<HTMLAnchorElement>(
    `.${CELEBRATION_HISTORY_CLASS} a[href^="${ROUTES.Conversations}/"]`,
  );
  for (
    let index = 0;
    index < Math.min(links.length, 48) && rows.length < 8;
    index++
  ) {
    const row = links[index].closest('li');
    if (!row || seen.has(row)) continue;
    seen.add(row);
    if (
      row.contains(document.activeElement) ||
      row.querySelector('[aria-expanded="true"]') ||
      row.getElementsByTagName('*').length > RAVEN_ROW_NODE_LIMIT
    )
      continue;
    const target = visible(row);
    if (target && target.rect.width <= 480 && target.rect.height <= 100)
      rows.push(target);
  }
  const conversation = rows.length
    ? rows[Math.floor(Math.random() * rows.length)]
    : null;
  const welcome = composer?.element.closest('[role="region"]');
  const history = document.querySelector(`.${CELEBRATION_HISTORY_CLASS}`);
  const candidates = [
    ...Array.from(welcome?.querySelectorAll<HTMLElement>('h1, h2') ?? []).slice(
      0,
      2,
    ),
    ...Array.from(
      composer?.element.querySelectorAll<HTMLElement>('button') ?? [],
    ).slice(0, 12),
    ...Array.from(
      history?.querySelectorAll<HTMLElement>('h2, button') ?? [],
    ).slice(0, 8),
    ...Array.from(welcome?.querySelectorAll<HTMLElement>('button') ?? []).slice(
      0,
      16,
    ),
    ...rows.map(({ element }) => element),
  ];
  const fragments: RavenFragment[] = [];
  for (const element of new Set(candidates)) {
    if (
      element.contains(document.activeElement) ||
      element.closest('[aria-expanded="true"], [contenteditable="true"]') ||
      element.querySelector(
        '[aria-expanded="true"], input, textarea, [contenteditable="true"]',
      ) ||
      conversation?.element.contains(element) ||
      element.contains(conversation?.element ?? null) ||
      element.getElementsByTagName('*').length > RAVEN_FRAGMENT_NODE_LIMIT
    )
      continue;
    const surface = visible(element);
    if (!surface) continue;
    const cropWidth = Math.min(76, surface.rect.width);
    const cropHeight = Math.min(32, surface.rect.height);
    fragments.push({
      ...surface,
      crop: new DOMRect(
        surface.rect.left + (surface.rect.width - cropWidth) / 2,
        surface.rect.top + (surface.rect.height - cropHeight) / 2,
        cropWidth,
        cropHeight,
      ),
    });
  }
  /* Choose across the page, not the first adjacent rows in DOM order. */
  const selected: RavenFragment[] = [];
  const distance = (a: DOMRect, b: DOMRect) =>
    Math.hypot(
      a.left + a.width / 2 - b.left - b.width / 2,
      a.top + a.height / 2 - b.top - b.height / 2,
    );
  while (fragments.length && selected.length < 6) {
    const farthest = selected.length
      ? fragments.reduce((best, fragment) => {
          const nearest = (candidate: RavenFragment) =>
            Math.min(
              ...selected.map(({ crop }) => distance(candidate.crop, crop)),
            );
          return nearest(fragment) > nearest(best) ? fragment : best;
        })
      : fragments[0];
    selected.push(farthest);
    for (let index = fragments.length - 1; index >= 0; index--) {
      const fragment = fragments[index];
      if (
        distance(fragment.crop, farthest.crop) < 96 ||
        fragment.element.contains(farthest.element) ||
        farthest.element.contains(fragment.element)
      )
        fragments.splice(index, 1);
    }
  }
  return {
    width,
    height,
    composer,
    pumpkin,
    conversation,
    fragments: selected,
    edges: [composer, ...rows]
      .filter((surface): surface is RavenSurface => !!surface)
      .slice(0, 3),
  };
};
