import type { CustomVisualizer } from '@epam/ai-dial-chat-shared';
import { useAppConfig } from '../../context/AppConfigContext';
import { UserConfigStatus } from '../../types/user-config-status';

/**
 * Module-level constant so the not-ready branch returns the same reference on
 * every render — an inline `[]` would give consumers a new array each time and
 * invalidate their `useCallback`/`useMemo` dependencies while config loads.
 */
const NO_VISUALIZERS: CustomVisualizer[] = [];

/** Returns a stable-reference `CustomVisualizer[]` from the resolved app config, or `[]` while loading or on error. */
export const useCustomVisualizers = (): CustomVisualizer[] => {
  const { status, config } = useAppConfig();
  return status === UserConfigStatus.Ready
    ? config.customVisualizers
    : NO_VISUALIZERS;
};
