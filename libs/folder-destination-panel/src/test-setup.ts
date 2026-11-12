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
