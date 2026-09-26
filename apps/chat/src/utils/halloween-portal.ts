import type { CelebrationHistoryRow } from './celebration-history';

export interface PortalPoint {
  x: number;
  y: number;
}
export interface PortalLayout {
  center: PortalPoint;
  grab: PortalPoint;
  width: number;
  height: number;
  size: number;
}

/** Randomly position the rift inside the viewport, opposite the borrowed rows. */
export const buildPortalLayout = (
  width: number,
  height: number,
  rows: readonly CelebrationHistoryRow[],
  isMobile: boolean,
): PortalLayout => {
  const size = Math.min(isMobile ? 90 : 120, width * 0.25, height * 0.25);
  const middle = rows.length
    ? {
        x:
          rows.reduce((sum, { rect }) => sum + rect.left + rect.width / 2, 0) /
          rows.length,
        y:
          rows.reduce((sum, { rect }) => sum + rect.top + rect.height / 2, 0) /
          rows.length,
      }
    : null;
  const xFraction = middle
    ? (middle.x < width / 2 ? 0.6 : 0.25) + Math.random() * 0.12
    : 0.25 + Math.random() * 0.5;
  const center = {
    x: Math.max(size, Math.min(width - size, width * xFraction)),
    y: Math.max(
      size,
      Math.min(
        height - size,
        middle
          ? middle.y + (Math.random() - 0.5) * 140
          : height * (0.28 + Math.random() * 0.36),
      ),
    ),
  };
  return {
    center,
    grab: middle ?? { x: center.x - size * 0.8, y: center.y + size * 0.5 },
    width,
    height,
    size,
  };
};

/** A random neighbouring pair fits in one claw; never duplicate a short list. */
export const pickPortalRows = (rows: readonly CelebrationHistoryRow[]) => {
  const ordered = [...rows].sort((a, b) => a.rect.top - b.rect.top);
  const start = Math.floor(Math.random() * Math.max(1, ordered.length - 1));
  return ordered.slice(start, start + 2);
};

/**
 * Borrow only visual copies. Animation.cancel restores the originals without
 * touching React's DOM ownership, virtual-list layout, data, or focus order.
 */
export const animatePortalRows = (
  rows: readonly CelebrationHistoryRow[],
  host: HTMLElement,
  destination: PortalPoint,
): (() => void) => {
  if (!rows.length || typeof host.animate !== 'function')
    return () => undefined;
  const animations: Animation[] = [];
  const copies: HTMLElement[] = [];
  let stopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const fingerprints = rows.map(({ element }) => ({
    text: element.textContent,
    href: element.querySelector('a')?.getAttribute('href'),
  }));
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    animations.forEach((animation) => animation.cancel());
    copies.forEach((copy) => copy.remove());
    observer.disconnect();
    document.removeEventListener('scroll', stop, true);
    document.removeEventListener('pointerdown', stop, true);
    document.removeEventListener('focusin', stop, true);
    document.removeEventListener('visibilitychange', stop);
    window.removeEventListener('resize', stop);
  };
  const observer = new MutationObserver(() => {
    if (
      rows.some(
        ({ element }, index) =>
          !element.isConnected ||
          element.closest('[inert], [aria-hidden="true"]') ||
          element.textContent !== fingerprints[index].text ||
          element.querySelector('a')?.getAttribute('href') !==
            fingerprints[index].href,
      )
    )
      stop();
  });

  try {
    rows.forEach(({ element, rect }, index) => {
      const copy = document.createElement('div');
      copy.inert = true;
      copy.setAttribute('aria-hidden', 'true');
      Object.assign(copy.style, {
        position: 'absolute',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        pointerEvents: 'none',
        listStyle: 'none',
        margin: '0',
      });
      const clone = element.cloneNode(true) as HTMLElement;
      const originalStyle = getComputedStyle(element);
      /* Keep inherited theme variables when the snapshot leaves the sidebar. */
      for (const name of Array.from(originalStyle)) {
        if (name.startsWith('--'))
          copy.style.setProperty(name, originalStyle.getPropertyValue(name));
      }
      copy.style.font = originalStyle.font;
      copy.style.color = originalStyle.color;
      clone.removeAttribute('id');
      clone
        .querySelectorAll('[id]')
        .forEach((node) => node.removeAttribute('id'));
      clone
        .querySelectorAll('a')
        .forEach((node) => node.removeAttribute('href'));
      clone.style.listStyle = 'none';
      copy.appendChild(clone);
      host.appendChild(copy);
      copies.push(copy);
      const travel = `translate(${destination.x - rect.left - rect.width / 2}px, ${destination.y - rect.top - rect.height / 2}px) scale(0.04) rotate(${index ? 28 : -24}deg)`;
      animations.push(
        copy.animate(
          [
            { offset: 0, opacity: 0, transform: 'none' },
            { offset: 0.34, opacity: 0, transform: 'none' },
            { offset: 0.35, opacity: 1, transform: 'none' },
            {
              offset: 0.42,
              easing: 'ease-in-out',
              opacity: 1,
              transform: `translate(12px, -8px) rotate(${index ? 3 : -3}deg)`,
            },
            { offset: 0.63, opacity: 0, transform: travel },
            { offset: 1, opacity: 0, transform: travel },
          ],
          { duration: 9000, fill: 'both' },
        ),
      );
      animations.push(
        element.animate(
          [
            { offset: 0, opacity: originalStyle.opacity },
            { offset: 0.34, opacity: originalStyle.opacity },
            { offset: 0.35, opacity: 0 },
            { offset: 0.8, opacity: 0 },
            { offset: 0.92, opacity: originalStyle.opacity },
            { offset: 1, opacity: originalStyle.opacity },
          ],
          { duration: 9000, fill: 'both' },
        ),
      );
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'inert', 'aria-hidden'],
    });
    document.addEventListener('scroll', stop, true);
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('focusin', stop, true);
    document.addEventListener('visibilitychange', stop);
    window.addEventListener('resize', stop);
    deadline = setTimeout(stop, 9000);
  } catch {
    /* If a host lacks a working animation API, leave its real rows untouched. */
    stop();
  }
  return stop;
};
