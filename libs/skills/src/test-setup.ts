import { vi } from 'vitest';

// jsdom has no viewport observers for the kit's dropdown and tooltips.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {
      /* no-op */
    }
    unobserve() {
      /* no-op */
    }
    disconnect() {
      /* no-op */
    }
  },
);

/*
 * jsdom has no layout engine, so the kit Dropdown behind each file-tree row
 * calls this browser-only API on pointer events.
 */
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
