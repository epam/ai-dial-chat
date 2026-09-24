import type { CelebrationHistoryRow } from './celebration-history';
import { animateCelebrationSnapshots } from './celebration-snapshots';

export const BOWLING_ANIMATION_MS = 8000;
export const BOWLING_ROLL_START = 0.12;
export const BOWLING_ROLL_END = 0.56;

interface BowlingHit extends CelebrationHistoryRow {
  contact: number;
  contactRect: DOMRect;
}
export interface BowlingPlan {
  startX: number;
  endX: number;
  y: number;
  radius: number;
  direction: 1 | -1;
  hits: BowlingHit[];
}

/** Collide with the visible title, not the row's empty trailing click area. */
export const getBowlingContactRect = ({
  element,
  rect,
}: CelebrationHistoryRow): DOMRect => {
  const link = element.querySelector('a[href]');
  if (!link) return rect;
  const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  if (typeof range.getClientRects !== 'function') return rect;
  const visible: DOMRect[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    let left = rect.left;
    let right = rect.right;
    let top = rect.top;
    let bottom = rect.bottom;
    let hidden = false;
    for (
      let parent = node.parentElement;
      parent && parent !== element;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        style.opacity === '0'
      ) {
        hidden = true;
        break;
      }
      if (
        /(hidden|clip|scroll|auto)/.test(
          `${style.overflow} ${style.overflowX} ${style.overflowY}`,
        )
      ) {
        const clip = parent.getBoundingClientRect();
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
    }
    if (hidden) continue;
    range.selectNodeContents(node);
    for (const text of Array.from(range.getClientRects())) {
      const x = Math.max(left, text.left);
      const y = Math.max(top, text.top);
      const width = Math.min(right, text.right) - x;
      const height = Math.min(bottom, text.bottom) - y;
      if (width > 2 && height > 4)
        visible.push(new DOMRect(x, y, width, height));
    }
  }
  if (!visible.length) return rect;
  const left = Math.min(...visible.map((part) => part.left));
  const top = Math.min(...visible.map((part) => part.top));
  return new DOMRect(
    left,
    top,
    Math.max(...visible.map((part) => part.right)) - left,
    Math.max(...visible.map((part) => part.bottom)) - top,
  );
};

/** A circle's first contact with a row along a horizontal roll, in viewport coordinates. */
const contactOffset = (
  rect: DOMRect,
  startX: number,
  endX: number,
  y: number,
  radius: number,
): number | null => {
  const distanceY = Math.max(rect.top - y, y - rect.bottom, 0);
  if (distanceY >= radius) return null;
  const reach = Math.sqrt(radius ** 2 - distanceY ** 2);
  const contactX = endX < startX ? rect.right + reach : rect.left - reach;
  const progress = (contactX - startX) / (endX - startX);
  if (progress < 0 || progress > 1) return null;
  return (
    BOWLING_ROLL_START + progress * (BOWLING_ROLL_END - BOWLING_ROLL_START)
  );
};

/** Aim at a visible row, then derive affected rows from the ball's actual swept circle. */
export const buildBowlingPlan = (
  rows: readonly CelebrationHistoryRow[],
  viewportWidth: number,
  viewportHeight: number,
): BowlingPlan | null => {
  if (!rows.length) return null;
  const measured = rows.map((row) => ({
    ...row,
    contactRect: getBowlingContactRect(row),
  }));
  const target = measured[Math.floor(Math.random() * measured.length)];
  const seed = target.contactRect;
  const radius = Math.min(44, Math.max(26, target.rect.height * 0.95));
  const direction =
    target.rect.left + target.rect.width / 2 < viewportWidth / 2 ? -1 : 1;
  const y = Math.max(
    radius + 12,
    Math.min(viewportHeight - radius - 12, seed.top + seed.height / 2),
  );
  const approach = Math.min(viewportWidth * 0.42, 520);
  const startX =
    direction === -1
      ? Math.max(
          seed.right + radius + 60,
          Math.min(viewportWidth - radius - 16, seed.right + approach),
        )
      : Math.min(
          seed.left - radius - 60,
          Math.max(radius + 16, seed.left - approach),
        );
  const endX = direction === -1 ? -radius - 20 : viewportWidth + radius + 20;
  const hits = measured
    .flatMap((row) => {
      const contact = contactOffset(row.contactRect, startX, endX, y, radius);
      return contact === null ? [] : [{ ...row, contact }];
    })
    .sort((a, b) => a.contact - b.contact)
    .slice(0, 6);
  return { startX, endX, y, radius, direction, hits };
};

/** Travel, spin and row impulses use one clock so a row never flies before contact. */
export const animateBowling = (
  plan: BowlingPlan,
  host: HTMLElement,
  actor: HTMLElement,
  spin: SVGElement,
  onStop?: () => void,
): (() => void) => {
  if (
    typeof actor.animate !== 'function' ||
    typeof spin.animate !== 'function' ||
    !plan.hits.length
  )
    return () => undefined;
  const animations: Animation[] = [];
  const stopActor = () => {
    animations.forEach((animation) => animation.cancel());
    onStop?.();
  };
  const distance = plan.endX - plan.startX;
  const startTime =
    typeof document.timeline?.currentTime === 'number'
      ? document.timeline.currentTime
      : undefined;
  try {
    animations.push(
      actor.animate(
        [
          { offset: 0, transform: 'translateX(0px)', opacity: 0 },
          { offset: 0.06, transform: 'translateX(0px)', opacity: 1 },
          {
            offset: BOWLING_ROLL_START,
            transform: 'translateX(0px)',
            opacity: 1,
          },
          {
            offset: BOWLING_ROLL_END,
            transform: `translateX(${distance}px)`,
            opacity: 1,
          },
          { offset: 0.64, transform: `translateX(${distance}px)`, opacity: 0 },
          { offset: 1, transform: `translateX(${distance}px)`, opacity: 0 },
        ],
        { duration: BOWLING_ANIMATION_MS, fill: 'both', easing: 'linear' },
      ),
    );
    const turn = `rotate(${distance / plan.radius}rad)`;
    animations.push(
      spin.animate(
        [
          { offset: 0, transform: 'rotate(0rad)' },
          { offset: BOWLING_ROLL_START, transform: 'rotate(0rad)' },
          { offset: BOWLING_ROLL_END, transform: turn },
          { offset: 1, transform: turn },
        ],
        { duration: BOWLING_ANIMATION_MS, fill: 'both', easing: 'linear' },
      ),
    );
    if (startTime !== undefined)
      animations.forEach((animation) => {
        animation.startTime = startTime;
      });
  } catch {
    stopActor();
    return () => undefined;
  }
  return animateCelebrationSnapshots(plan.hits, host, {
    durationMs: BOWLING_ANIMATION_MS,
    hideAt: (index) => plan.hits[index].contact,
    restoreAt: 0.94,
    startTime,
    frames: (rect, index) => {
      const contact = plan.hits[index].contact;
      const vertical = rect.top + rect.height / 2 - plan.y;
      const side = Math.sign(vertical) || (index % 2 ? 1 : -1);
      const scatter = `translate(${plan.direction * (60 + Math.abs(vertical) * 0.35)}px, ${side * (30 + Math.abs(vertical) * 1.5)}px) rotate(${plan.direction * side * (14 + Math.abs(vertical) * 0.45)}deg) scale(0.95)`;
      return [
        { offset: 0, opacity: 0, transform: 'none' },
        { offset: contact - 0.01, opacity: 0, transform: 'none' },
        { offset: contact, opacity: 1, transform: 'none', easing: 'ease-out' },
        { offset: contact + 0.13, opacity: 1, transform: scatter },
        { offset: 0.72, opacity: 1, transform: scatter },
        { offset: 0.94, opacity: 1, transform: 'none' },
        { offset: 0.98, opacity: 0, transform: 'none' },
        { offset: 1, opacity: 0, transform: 'none' },
      ];
    },
    onStop: stopActor,
  });
};
