import { ROUTES } from '../types/routes';

/** App-owned hook: libraries need no knowledge of seasonal effects. */
export const CELEBRATION_HISTORY_CLASS = 'celebration-history';

export interface CelebrationHistoryRow {
  element: HTMLElement;
  rect: DOMRect;
}

/** Only fully visible, idle rows are eligible; never borrow a focused control. */
export const getCelebrationHistoryRows = (): CelebrationHistoryRow[] => {
  const found = new Set<HTMLElement>();
  const viewport = document.documentElement;
  const result: CelebrationHistoryRow[] = [];
  document
    .querySelectorAll<HTMLAnchorElement>(
      `.${CELEBRATION_HISTORY_CLASS} a[href^="${ROUTES.Conversations}/"]`,
    )
    .forEach((link) => {
      const row = link.closest('li');
      if (!row || found.has(row)) return;
      found.add(row);
      if (
        row.contains(document.activeElement) ||
        row.closest('[inert], [aria-hidden="true"]') ||
        row.querySelector('[aria-expanded="true"]')
      )
        return;
      const rect = row.getBoundingClientRect();
      if (
        rect.width < 40 ||
        rect.height < 12 ||
        rect.left < 0 ||
        rect.top < 0 ||
        rect.right > viewport.clientWidth ||
        rect.bottom > viewport.clientHeight
      )
        return;

      /* Virtualized rows can exist behind a scroll clip or a closed drawer. */
      for (
        let parent: HTMLElement | null = row;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        )
          return;
        if (
          /(auto|scroll|hidden|clip)/.test(
            `${style.overflow} ${style.overflowX} ${style.overflowY}`,
          )
        ) {
          const clip = parent.getBoundingClientRect();
          if (
            rect.left < clip.left ||
            rect.right > clip.right ||
            rect.top < clip.top ||
            rect.bottom > clip.bottom
          )
            return;
        }
      }
      result.push({ element: row, rect });
    });
  return result;
};
