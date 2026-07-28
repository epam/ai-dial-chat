import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_ENABLED_UI_FEATURES } from '../constants/ui-features';
import { useAppConfig } from './AppConfigContext';

const KNOWN_OVERLAY_FEATURES = new Set<string>(Object.values(OverlayFeature));

const normalizeOverlayFeatures = (features: string[]): Set<OverlayFeature> => {
  const normalized = new Set<OverlayFeature>();
  features.forEach((feature) => {
    if (KNOWN_OVERLAY_FEATURES.has(feature)) {
      normalized.add(feature as OverlayFeature);
    }
  });
  return normalized;
};

interface UiFeaturesContextType {
  /** Returns whether `feature` is in the app's current effective UI-feature set. */
  isEnabled: (feature: OverlayFeature) => boolean;
  /** The app's current effective UI-feature set. */
  enabledFeatures: ReadonlySet<OverlayFeature>;
  /**
   * Replaces the effective UI-feature set with the normalized, known-value
   * intersection of `features`. Consumed only by `OverlayContext`'s
   * `SET_OVERLAY_OPTIONS` handler; called with `undefined` is a no-op.
   */
  applyOverlayOverride: (features: string[] | undefined) => void;
}

const UiFeaturesContext = createContext<UiFeaturesContextType | undefined>(
  undefined,
);

interface Props {
  children: ReactNode;
}

/**
 * Owns the app's effective UI-feature set. Priority (highest to lowest):
 * 1. Overlay-host-supplied override (`SET_OVERLAY_OPTIONS.enabledFeatures`).
 * 2. Operator env var (`ENABLED_UI_FEATURES`) — replaces the default baseline entirely.
 * 3. Compiled-in `DEFAULT_ENABLED_UI_FEATURES`.
 */
export const UiFeaturesProvider: FC<Props> = ({ children }) => {
  const {
    config: { enabledUiFeatures },
  } = useAppConfig();
  const [overlayOverride, setOverlayOverride] =
    useState<Set<OverlayFeature> | null>(null);

  const enabledFeatures = useMemo(() => {
    if (overlayOverride != null) {
      return overlayOverride;
    }
    if (enabledUiFeatures != null) {
      return normalizeOverlayFeatures(enabledUiFeatures);
    }
    return new Set<OverlayFeature>(DEFAULT_ENABLED_UI_FEATURES);
  }, [enabledUiFeatures, overlayOverride]);

  const isEnabled = useCallback(
    (feature: OverlayFeature) => enabledFeatures.has(feature),
    [enabledFeatures],
  );

  const applyOverlayOverride = useCallback((features: string[] | undefined) => {
    if (features == null) return;
    setOverlayOverride(normalizeOverlayFeatures(features));
  }, []);

  const value = useMemo(
    () => ({ isEnabled, enabledFeatures, applyOverlayOverride }),
    [isEnabled, enabledFeatures, applyOverlayOverride],
  );

  return (
    <UiFeaturesContext.Provider value={value}>
      {children}
    </UiFeaturesContext.Provider>
  );
};

export const useUiFeatures = (): UiFeaturesContextType => {
  const ctx = useContext(UiFeaturesContext);
  if (ctx == null) {
    throw new Error('useUiFeatures must be used within UiFeaturesProvider');
  }
  return ctx;
};
