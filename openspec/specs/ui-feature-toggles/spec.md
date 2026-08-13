# ui-feature-toggles Specification

## Purpose

`UiFeaturesContext`: the effective UI-feature set, its default baseline, server override, and overlay replace semantics.

## Requirements

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

`DEFAULT_ENABLED_UI_FEATURES` SHALL contain exactly the 23 default-on keys and exclude the 16 default-off (`Hide*`/restrictive modifier) keys (`header`, `conversations-section`, `conversations-panel-toggle`, `showConversationsSectionByDefault`, `attachments-manager`, `likes`, `dislike-comment`, `input-files`, `live-chat-interaction`, `catalog`, `file-manager`, `prompts`... are default-on; `hide-edit-user-message`, `disabled-send`, `catalog-table-view`, `hide-change-agent`... are default-off — the full 39-key membership is the `OverlayFeature` enum itself, not restated here). With no `enabledUiFeatures` and no overlay override, `isEnabled` SHALL return exactly the default-on classification for every one of the 39 keys, matching each surface's current unconditional behavior.

**RTL impact:** None for this requirement itself — individual owning-surface gates state their own RTL impact where relevant (see per-surface requirements below).

#### Scenario: Positive features default on

- **WHEN** no `enabledUiFeatures` and no overlay override are present
- **THEN** `isEnabled('header')`, `isEnabled('conversations-section')`, `isEnabled('likes')`, and `isEnabled('conversations-sharing')` all return `true`

#### Scenario: Modifier features default off

- **WHEN** no `enabledUiFeatures` and no overlay override are present
- **THEN** `isEnabled('hide-new-conversation')`, `isEnabled('disabled-send')`, `isEnabled('hide-user-menu')`, and `isEnabled('catalog-table-view')` all return `false`

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

Each of the 39 transferable `OverlayFeature` values SHALL gate exactly the owning component/container documented in `design.md`'s classification table, and SHALL NOT alter the visibility or behavior of any other feature's surface. Hidden surfaces SHALL be conditionally unmounted (not rendered), not merely visually hidden, so no focus trap or hidden-but-tabbable control is left behind (per this repo's `inert`-over-`aria-hidden` accessibility rule for hidden interactive regions where applicable).

**Accessibility:** Conditionally-unmounted controls remove themselves from both the accessibility tree and the tab order by not rendering — no `aria-hidden` container with focusable descendants is introduced by this change.

**i18n impact:** None — no new user-visible strings are introduced; toggles hide/show or restrict already-translated existing UI.

#### Scenario: Gating one feature does not affect another

- **WHEN** `enabledUiFeatures` omits `'likes'` but includes everything else
- **THEN** the new-conversation button's visibility (`hide-new-conversation`) is unaffected

#### Scenario: hide-new-conversation hides only the new-conversation entry points

- **WHEN** `isEnabled('hide-new-conversation')` is `true`
- **THEN** the "New conversation" controls in `Header.tsx` and `ChatLayout.tsx` do not render, and no other header/layout control is affected

### Requirement: hide-keyboard-shortcuts removes the entry on both profile surfaces

`isEnabled('hide-keyboard-shortcuts')` SHALL remove the Keyboard shortcuts entry from the desktop user menu (`UserMenu`) and from the mobile profile sheet (`ProfilePageContent`). `isEnabled('hide-user-settings')` SHALL also remove it from both, so the two surfaces agree; neither key SHALL affect the other settings entries the other key governs — with only `hide-keyboard-shortcuts` enabled the language selector SHALL still render.

Because Keyboard shortcuts is the mobile sheet's only settings entry, hiding it SHALL drop that entry's list and its trailing divider together, leaving no empty list or stray rule.

Hiding the entry SHALL NOT change send behavior: the `SendOnEnter` preference is read from storage by `ConversationView` and `NewConversationComposer` independently of this key, and continues to resolve to its stored value, defaulting to `SendOnEnter.Enter`.

**Accessibility:** The entry is not rendered, so it leaves neither an accessibility-tree node nor a tab stop.

**i18n impact:** None — the existing translated label is shown or omitted; no new strings.

#### Scenario: The entry disappears from the user menu

- **WHEN** `isEnabled('hide-keyboard-shortcuts')` is `true` and the user opens the user menu
- **THEN** no Keyboard shortcuts entry is rendered, and the language entry still is

#### Scenario: hide-user-settings hides it too

- **WHEN** `isEnabled('hide-user-settings')` is `true`
- **THEN** the Keyboard shortcuts entry is absent from both the user menu and the mobile profile sheet

#### Scenario: Send-on-Enter keeps working while the entry is hidden

- **WHEN** `isEnabled('hide-keyboard-shortcuts')` is `true` and the stored preference is `SendOnEnter.MetaEnter`
- **THEN** the conversation input still sends on `⌘`/`Ctrl`+Enter

### Requirement: hide-conversations-filter removes the panel's source filter row

`isEnabled('hide-conversations-filter')` SHALL remove the conversations panel's `FilterTabs` row (All / My chats / Shared / Organization). `ConversationPanelView` SHALL express this by passing `isFilterTabsHidden` to `ConversationPanel`; the lib SHALL take that decision as a boolean prop and SHALL NOT read the feature set itself, per the library-isolation rule.

Hiding the control SHALL NOT filter the list: the active tab stays whatever it was (`FilterTab.All` unless `activeFilter` overrides it), so every group — Pinned, My chats, Shared, Organization — remains reachable. `labels.filterLabels` stays a required prop whether or not the row renders.

**Accessibility:** The row is not rendered, so it leaves neither an accessibility-tree node nor a tab stop.

**i18n impact:** None — the existing translated tab labels are shown or omitted; no new strings.

#### Scenario: The filter row is gone but every group still lists

- **WHEN** `isEnabled('hide-conversations-filter')` is `true`
- **THEN** the panel renders no filter tabs, and conversations from every source still appear under their group headings

#### Scenario: The filter row renders by default

- **WHEN** no `enabledUiFeatures` and no overlay override are present
- **THEN** the panel renders the four filter tabs, because the key is default-off

### Requirement: An unusable agent selector is removed, not dimmed

The in-chat agent selector SHALL NOT render when the user cannot act on it. `isEnabled('hide-change-agent')` and `isEnabled('disallow-change-agent')` SHALL each remove the control from `ConversationView`'s conversation input entirely, by passing no `deployments` to `ConversationInput` — the lib's own hide path, which also leaves the send button enabled because `Input` reads an absent selector as a resolved model. Neither key SHALL render the selector greyed out: a dimmed icon carrying a caret advertises a menu that never opens, and where the deployment cannot be changed the icon carries no actionable information.

A pinned `fixedModel` SHALL keep rendering the disabled selector, because the app editor's preview pane shows the same chip through `NewConversationComposer` in its empty state and would otherwise lose it after the first message. The empty-chat composer keeps its own separate key, `hide-empty-chat-change-agent`.

**Accessibility:** The removed control leaves neither an accessibility-tree node nor a tab stop, replacing a `pointer-events-none` element that was still exposed to assistive tech.

**i18n impact:** None — the selector's existing translated labels are shown or omitted; no new strings.

#### Scenario: hide-change-agent removes the in-chat selector

- **WHEN** `isEnabled('hide-change-agent')` is `true`
- **THEN** the conversation input renders no agent selector, and the send button stays enabled

#### Scenario: disallow-change-agent removes the selector rather than dimming it

- **WHEN** `isEnabled('disallow-change-agent')` is `true`
- **THEN** the conversation input renders no agent selector — in particular no greyed-out icon with a caret

#### Scenario: A pinned model still shows its disabled selector

- **WHEN** `ConversationView` receives a `fixedModel` and neither agent-selector key is enabled
- **THEN** the selector renders disabled with the pinned model's icon, matching what the composer shows before the first message

### Requirement: A key that gates a route hides both the entry point and the route

A feature key whose owning surface is a whole route SHALL gate the navigation entry and the route element together, so that a direct URL cannot reach a section whose entry point is hidden. `file-manager` SHALL gate the File Manager navigation entry (desktop `Navigation` and mobile `NavPageContent`, both through the shared `useVisibleNavItems` hook) and the `ROUTES.FileManager` route element, which SHALL redirect to `ROUTES.Root` with `replace` when the key is disabled.

Route gating SHALL NOT be treated as an authorization boundary: the backend SHALL continue to enforce access to the underlying data and operations regardless of which keys are enabled.

**Accessibility:** A hidden navigation entry is not rendered at all, so it leaves neither an accessibility-tree node nor a tab stop.

**i18n impact:** None — the entry's existing translated label is shown or omitted; no new strings.

#### Scenario: file-manager hides the navigation entry on both layouts

- **WHEN** `isEnabled('file-manager')` is `false`
- **THEN** neither the desktop sidebar nor the mobile navigation sheet renders a File Manager entry, and every other navigation entry is unaffected

#### Scenario: A direct /files URL does not bypass the hidden entry

- **WHEN** `isEnabled('file-manager')` is `false` and the user navigates directly to `/files`
- **THEN** the app redirects to `/` with `replace`, and `DialFileManagerPage` is never mounted

#### Scenario: file-manager is independent of the in-chat attachment flow

- **WHEN** `isEnabled('file-manager')` is `false` and `isEnabled('input-files')` is `true`
- **THEN** the conversation input still renders the attach-file button and can open the file-manager modal — only the standalone `/files` section is gone
