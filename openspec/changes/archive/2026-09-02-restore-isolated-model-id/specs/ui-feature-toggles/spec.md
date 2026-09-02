## MODIFIED Requirements

### Requirement: UiFeaturesContext owns the effective UI-feature set

`apps/chat/src/context/UiFeaturesContext.tsx` SHALL be the sole owner of the app's effective UI-feature set, computed from `DEFAULT_ENABLED_UI_FEATURES` (`apps/chat/src/constants/ui-features.ts`), `AppConfigContext.config.enabledUiFeatures`, an overlay-supplied replacement (see "Overlay replace semantics" below), and a temporary isolated-view override (see "Isolated-view override takes precedence over every other source", `// TODO: remove in next release`). It SHALL follow the `ThemeContext` pattern: `createContext<UiFeaturesContextType | undefined>(undefined)`, a `useMemo`-wrapped provided value, and a `useUiFeatures()` hook that throws a descriptive `Error` when called outside the provider. It SHALL expose `useUiFeature(feature: OverlayFeature): boolean` (`apps/chat/src/hooks/useUiFeature.ts`) as the primary consumption point for gating components. `UiFeaturesProvider` SHALL be mounted in `apps/chat/src/main.tsx` below `AppConfigProvider` and above `OverlayModeGate`.

**State ownership:** `UiFeaturesContext` (new). Reads `AppConfigContext.config.enabledUiFeatures` (existing context, extended). Written to by two callers: `OverlayContext`'s `SET_OVERLAY_OPTIONS` handler (via `applyOverlayOverride`), and — temporarily, `// TODO: remove in next release` — `useIsolatedModelView` (via the new `applyIsolatedViewOverride`, see `isolated-model-view`). No other consumer may mutate the effective set.

**Feature flag:** Not gated behind any existing flag — this capability defines the toggle system itself, not a toggle within it.

**Memoization:** The computed effective `Set<OverlayFeature>` and the provided context value SHALL both be wrapped in `useMemo`, recomputed only when baseline inputs (`enabledUiFeatures`, overlay override, isolated-view override) change. `isEnabled` SHALL be wrapped in `useCallback`.

#### Scenario: useUiFeatures throws outside the provider

- **WHEN** `useUiFeatures()` is called from a component not wrapped in `UiFeaturesProvider`
- **THEN** it throws an `Error` with a descriptive message

#### Scenario: useUiFeature reads through to the effective set

- **WHEN** a component calls `useUiFeature(OverlayFeature.Header)` while `'header'` is in the effective set
- **THEN** it returns `true`

#### Scenario: Unrelated re-renders do not recompute the context value

- **WHEN** a component elsewhere in the tree re-renders without `enabledUiFeatures`, the overlay override, or the isolated-view override changing
- **THEN** `UiFeaturesContext`'s provided value reference is unchanged

## ADDED Requirements

### Requirement: Isolated-view override takes precedence over every other source

`TODO: remove in next release.` `UiFeaturesContext` SHALL expose `applyIsolatedViewOverride(features: Set<OverlayFeature> | null)`, called only by `useIsolatedModelView` (see `isolated-model-view`). When set to a non-null value, the effective UI-feature set SHALL become exactly that set, taking precedence over the overlay override, the server `enabledUiFeatures` baseline, and the compiled defaults — none of those other sources SHALL be consulted while the isolated-view override is active. When `null` (the default, and the value whenever isolated view is not active), the existing three-level priority chain (overlay override → server baseline → compiled defaults) SHALL apply unchanged.

This override SHALL NOT be normalized against `DEPRECATED_OVERLAY_FEATURE_ALIASES`/`resolveOverlayFeature` the way `applyOverlayOverride`'s input is, since its caller always supplies canonical `OverlayFeature` enum members directly rather than wire strings from an external host.

#### Scenario: Isolated-view override wins over an active overlay override

- **WHEN** an overlay override is already active with `{header, likes}` and `applyIsolatedViewOverride` is called with `{hide-navigation-menu}`
- **THEN** the effective set becomes exactly `{hide-navigation-menu}` — `header` and `likes` are no longer enabled

#### Scenario: Isolated-view override wins over the server baseline

- **WHEN** `AppConfigContext.config.enabledUiFeatures` is `['conversations-section', 'prompts']` and `applyIsolatedViewOverride` is called with `{hide-change-agent}`
- **THEN** the effective set is exactly `{hide-change-agent}` — `conversations-section` and `prompts` are not enabled

#### Scenario: Clearing the isolated-view override restores the prior priority chain

- **WHEN** `applyIsolatedViewOverride(null)` is called after previously being set
- **THEN** the effective set is recomputed from the overlay override (if any), else the server baseline, else the compiled defaults — exactly as if the isolated-view override had never been applied
