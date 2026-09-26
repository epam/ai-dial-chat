import type { CelebrationEnvironment } from '../context/CelebrationEnvironmentContext';
import type { CelebrationAnchors } from '../models/celebration';

/** History anchors matching the `celebration-history` fixtures the tests build. */
export const testAnchors = (
  overrides: CelebrationAnchors = {},
): CelebrationAnchors => ({
  historyContainer: 'celebration-history',
  historyRowLink: 'a[href^="/conversations/"]',
  ...overrides,
});

/** A provider environment for rendering scenes and decorations in isolation. */
export const testEnvironment = (
  overrides: Partial<CelebrationEnvironment> = {},
): CelebrationEnvironment => ({
  isMobile: false,
  anchors: testAnchors(),
  labels: {},
  isDecorBehaviorEnabled: () => true,
  ...overrides,
});
