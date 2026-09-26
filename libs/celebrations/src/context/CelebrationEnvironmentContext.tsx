import { createContext, useContext } from 'react';
import type { CelebrationAnchors } from '../models/celebration';

/** Host inputs that scenes and decorations read instead of host hooks. */
export interface CelebrationEnvironment {
  isMobile: boolean;
  anchors: CelebrationAnchors;
  /** The loaded event's labels, host overrides merged over defaults. */
  labels: Readonly<Record<string, string>>;
  isDecorBehaviorEnabled: (behavior: string) => boolean;
}

const DEFAULT_ENVIRONMENT: CelebrationEnvironment = {
  isMobile: false,
  anchors: {},
  labels: {},
  isDecorBehaviorEnabled: () => true,
};

/* Not exported from the package: only the provider sets it. */
export const CelebrationEnvironmentContext =
  createContext<CelebrationEnvironment>(DEFAULT_ENVIRONMENT);

export const useCelebrationEnvironment = (): CelebrationEnvironment =>
  useContext(CelebrationEnvironmentContext);

/** Whether one decoration behavior of the loaded event may run. */
export const useDecorBehavior = (behavior: string): boolean =>
  useContext(CelebrationEnvironmentContext).isDecorBehaviorEnabled(behavior);
