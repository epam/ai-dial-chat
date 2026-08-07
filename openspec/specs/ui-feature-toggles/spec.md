## ADDED Requirements

### Requirement: UiFeaturesContext owns the effective UI-feature set

`apps/chat/src/context/UiFeaturesContext.tsx` SHALL be the sole owner of the app's effective UI-feature set, computed from `DEFAULT_ENABLED_UI_FEATURES` (`apps/chat/src/constants/ui-features.ts`), `AppConfigContext.config.enabledUiFeatures`, and an overlay-supplied replacement (see "Overlay replace semantics" below). It SHALL follow the `ThemeContext` pattern: `createContext<UiFeaturesContextType | undefined>(undefined)`, a `useMemo`-wrapped provided value, and a `useUiFeatures()` hook that throws a descriptive `Error` when called outside the provider. It SHALL expose `useUiFeature(feature: OverlayFeature): boolean` (`apps/chat/src/hooks/useUiFeature.ts`) as the primary consumption point for gating components. `UiFeaturesProvider` SHALL be mounted in `apps/chat/src/main.tsx` below `AppConfigProvider` and above `OverlayModeGate`.

**State ownership:** `UiFeaturesContext` (new). Reads `AppConfigContext.config.enabledUiFeatures` (existing context, extended). Written to only by `OverlayContext`'s `SET_OVERLAY_OPTIONS` handler, via the context's own setter — no other consumer may mutate the effective set.

**Feature flag:** Not gated behind any existing flag — this capability defines the toggle system itself, not a toggle within it.

**Memoization:** The computed effective `Set<OverlayFeature>` and the provided context value SHALL both be wrapped in `useMemo`, recomputed only when baseline inputs (`enabledUiFeatures`, overlay override) change. `isEnabled` SHALL be wrapped in `useCallback`.

#### Scenario: useUiFeatures throws outside the provider

- **WHEN** `useUiFeatures()` is called from a component not wrapped in `UiFeaturesProvider`
- **THEN** it throws an `Error` with a descriptive message

#### Scenario: useUiFeature reads through to the effective set

- **WHEN** a component calls `useUiFeature(OverlayFeature.Header)` while `'header'` is in the effective set
- **THEN** it returns `true`

#### Scenario: Unrelated re-renders do not recompute the context value

- **WHEN** a component elsewhere in the tree re-renders without `enabledUiFeatures` or the overlay override changing
- **THEN** `UiFeaturesContext`'s provided value reference is unchanged

### Requirement: Default baseline preserves current unconditional behavior

`DEFAULT_ENABLED_UI_FEATURES` SHALL contain exactly the 23 default-on keys and exclude the 15 default-off keys enumerated in `design.md`'s classification table (`header`, `conversations-section`, `conversations-panel-toggle`, `showConversationsSectionByDefault`, `show-layout-dividers`, `attachments-manager`, `top-settings`, `top-chat-model-settings`, `likes`, `dislike-comment`, `input-files`, `live-chat-interaction`, `hide-edit-user-message`... — the full 38-key membership is defined in `design.md`, not restated here). With no `enabledUiFeatures` and no overlay override, `isEnabled` SHALL return exactly the default-on classification for every one of the 38 keys, matching each surface's current unconditional behavior.

**RTL impact:** None for this requirement itself — individual owning-surface gates state their own RTL impact where relevant (see per-surface requirements below).

#### Scenario: Positive features default on

- **WHEN** no `enabledUiFeatures` and no overlay override are present
- **THEN** `isEnabled('header')`, `isEnabled('conversations-section')`, `isEnabled('likes')`, and `isEnabled('conversations-sharing')` all return `true`

#### Scenario: Modifier features default off

- **WHEN** no `enabledUiFeatures` and no overlay override are present
- **THEN** `isEnabled('hide-new-conversation')`, `isEnabled('disabled-send')`, `isEnabled('hide-user-menu')`, and `isEnabled('chat-header-border')` all return `false`

#### Scenario: Non-overlay app is unaffected by this change when nothing is configured

- **WHEN** `ENABLED_UI_FEATURES` is unset and the app is not framed (non-overlay mode)
- **THEN** every gated surface renders identically to its pre-change behavior

### Requirement: Server baseline override replaces defaults when set

When `AppConfigContext.config.enabledUiFeatures` is non-null, the effective set (outside an overlay override) SHALL be exactly the normalized intersection of `enabledUiFeatures` with `KNOWN_UI_FEATURES`. When null, `DEFAULT_ENABLED_UI_FEATURES` is used unchanged. The server override supports all `OverlayFeature` values, including `Hide*` modifier flags.

#### Scenario: Server override replaces the compiled-in defaults

- **WHEN** `enabledUiFeatures` is `['header', 'likes']`
- **THEN** the effective set is exactly `{header, likes}` — `conversations-sharing` and every other default-on feature that is not in the list is no longer enabled

#### Scenario: Server override can enable a modifier flag

- **WHEN** `enabledUiFeatures` includes `'hide-new-conversation'`
- **THEN** `isEnabled('hide-new-conversation')` returns `true` — the modifier flag is active even though it is not in `DEFAULT_ENABLED_UI_FEATURES`

#### Scenario: Null enabledUiFeatures uses compiled-in defaults

- **WHEN** `enabledUiFeatures` is `null`
- **THEN** the effective set equals `DEFAULT_ENABLED_UI_FEATURES` exactly

### Requirement: Overlay replace semantics — presence replaces, absence leaves unchanged

`UiFeaturesContext` SHALL expose `applyOverlayOverride(features: string[] | undefined)`, called only by `OverlayContext`'s `SET_OVERLAY_OPTIONS` handler. When invoked with an array (including `[]`), the effective set SHALL become exactly the normalized intersection of that array with the known `OverlayFeature` values — it SHALL NOT be merged with `DEFAULT_ENABLED_UI_FEATURES` or `enabledUiFeatures`. When `SET_OVERLAY_OPTIONS.payload.enabledFeatures` is absent, `applyOverlayOverride` SHALL NOT be called, and the previously-computed effective set (server baseline, default baseline, or an earlier override) remains active. There is no reset-to-baseline sentinel in this change; a host that wants the server baseline back must resend the `enabledUiFeatures` array it computed as the baseline.

#### Scenario: Overlay override replaces the baseline entirely

- **WHEN** the current baseline is `{header, likes, conversations-sharing, ...}` and `setOverlayOptions({ enabledFeatures: ['header', 'likes'] })` is called
- **THEN** the effective set becomes exactly `{header, likes}` — `conversations-sharing` is no longer enabled even though it was in the compiled-in defaults

#### Scenario: Overlay override can include features not in the server baseline

- **WHEN** the server's `enabledUiFeatures` omits `'likes'` and `setOverlayOptions({ enabledFeatures: ['likes'] })` is called
- **THEN** `isEnabled('likes')` returns `true` for this embed — the server baseline only governs the no-override default, not an explicit overlay override

#### Scenario: Empty array override disables everything this system governs

- **WHEN** `setOverlayOptions({ enabledFeatures: [] })` is called
- **THEN** every `OverlayFeature` key returns `false` from `isEnabled`

#### Scenario: Absent enabledFeatures leaves the prior state untouched

- **WHEN** `setOverlayOptions({ theme: 'dark' })` is called with no `enabledFeatures` key, after an earlier override was already applied
- **THEN** the previously-applied override remains the effective set — `theme` is updated independently

### Requirement: Unknown values in an overlay override are filtered, not rejected

When `applyOverlayOverride` receives an array containing one or more strings that are not recognized `OverlayFeature` values (including any of the 19 `status: "missing"` keys from the prior implementation, which are intentionally not part of the `OverlayFeature` enum — see `chat-overlay-protocol`), those entries SHALL be dropped from the effective set and each SHALL be logged once via the existing `logOverlayWarning` helper; the recognized entries SHALL still be applied, and the request's `SET_OVERLAY_OPTIONS/RESPONSE` SHALL still carry `applied: true` provided any other supplied fields (`theme`/`modelId`/`overlayConversationId`) were themselves valid.

#### Scenario: Unknown value is dropped, valid values still apply

- **WHEN** `setOverlayOptions({ enabledFeatures: ['header', 'not-a-real-feature'] })` is called
- **THEN** the effective set is exactly `{header}`, a warning is logged naming `'not-a-real-feature'`, and the response is `{ applied: true }`

#### Scenario: A missing-status legacy key is treated as unknown, not as a working toggle

- **WHEN** `setOverlayOptions({ enabledFeatures: ['report-an-issue'] })` is called
- **THEN** `'report-an-issue'` is dropped as unrecognized (it is not a member of `OverlayFeature`), a warning is logged, and no `report-an-issue` UI surface is enabled (none exists)

### Requirement: Capability gates combine with the UI toggle for voice-input and live-chat-interaction

The effective visibility of the voice-input UI affordance SHALL be `isEnabled('voice-input')` combined with the existing audio-transcription capability path: an explicit ASR model enables it, otherwise the selected deployment must advertise audio input support. The effective visibility of the live-chat-interaction sign-in UI affordance SHALL be `isEnabled('live-chat-interaction') && useFeatureFlag('liveChatInteraction')`. `ClientChannelProvider`'s existing `useFeatureFlag('liveChatInteraction')` gate on the client-channel subscription itself SHALL remain unchanged and independent of the UI toggle — disabling `live-chat-interaction` in the UI-feature system SHALL hide the affordance but SHALL NOT by itself prevent the channel subscription when the backend capability is on.

#### Scenario: Voice input requires the UI toggle and an audio-transcription capability

- **WHEN** `isEnabled('voice-input')` is `true` but no ASR model is configured and the selected deployment does not advertise audio input support
- **THEN** the voice-input button is not rendered

#### Scenario: Live-chat-interaction UI toggle does not stop the backend subscription

- **WHEN** `isEnabled('live-chat-interaction')` is `false` but `features.liveChatInteraction` is `true`
- **THEN** `ClientChannelProvider` still subscribes to the DIAL Core client channel, but the UI affordance that surfaces pending sign-in events is hidden

### Requirement: Each transferable feature key gates exactly one owning surface

Each of the 38 transferable `OverlayFeature` values SHALL gate exactly the owning component/container documented in `design.md`'s classification table, and SHALL NOT alter the visibility or behavior of any other feature's surface. Hidden surfaces SHALL be conditionally unmounted (not rendered), not merely visually hidden, so no focus trap or hidden-but-tabbable control is left behind (per this repo's `inert`-over-`aria-hidden` accessibility rule for hidden interactive regions where applicable).

**Accessibility:** Conditionally-unmounted controls remove themselves from both the accessibility tree and the tab order by not rendering — no `aria-hidden` container with focusable descendants is introduced by this change.

**i18n impact:** None — no new user-visible strings are introduced; toggles hide/show or restrict already-translated existing UI.

#### Scenario: Gating one feature does not affect another

- **WHEN** `enabledUiFeatures` omits `'top-settings'` but includes everything else
- **THEN** the new-conversation button's visibility (`hide-new-conversation`) is unaffected

#### Scenario: hide-new-conversation hides only the new-conversation entry points

- **WHEN** `isEnabled('hide-new-conversation')` is `true`
- **THEN** the "New conversation" controls in `Header.tsx` and `ChatLayout.tsx` do not render, and no other header/layout control is affected
