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

// The file manager's folder tree hit-tests rows with `elementFromPoint`, which jsdom lacks.
if (!document.elementFromPoint) {
  document.elementFromPoint = vi.fn(() => document.createElement('div'));
}
