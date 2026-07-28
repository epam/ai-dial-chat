import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import { useUiFeatures } from '../context/UiFeaturesContext';

/**
 * Thin convenience wrapper over `useUiFeatures().isEnabled`, kept as its own
 * hook so gating call sites don't each re-derive `isEnabled` from the full
 * context value.
 */
export const useUiFeature = (feature: OverlayFeature): boolean => {
  const { isEnabled } = useUiFeatures();
  return isEnabled(feature);
};
