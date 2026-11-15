import type { MouseEvent } from 'react';

/**
 * Returns whether a click asks the browser for its own handling (new tab, new window, download).
 * @param event - the click event of a link
 */
export const isModifiedClick = (event: MouseEvent): boolean =>
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;
