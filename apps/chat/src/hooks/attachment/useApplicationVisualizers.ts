import type { ApplicationVisualizerRegistry } from '@epam/ai-dial-chat-shared';
import { useAppConfig } from '../../context/AppConfigContext';
import { UserConfigStatus } from '../../types/user-config-status';

/**
 * Module-level constant so the not-ready branch returns the same reference on
 * every render — an inline `{}` would give consumers a new object each time and
 * invalidate their `useMemo`/`useCallback` dependencies while config loads.
 */
const NO_VISUALIZERS: ApplicationVisualizerRegistry = {};

/** Returns a stable-reference `ApplicationVisualizerRegistry` from the resolved app config, or an empty registry while loading or on error. */
export const useApplicationVisualizers = (): ApplicationVisualizerRegistry => {
  const { status, config } = useAppConfig();
  return status === UserConfigStatus.Ready
    ? config.applicationVisualizers
    : NO_VISUALIZERS;
};
