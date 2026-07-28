## Context

`OverlayFeature` (`libs/chat-shared/src/types/overlay/overlay-protocol.ts:69`) and `ChatOverlayOptions.enabledFeatures?: OverlayFeature[]` (`:127`, `:140`) already exist but carry exactly one member (`voice-input`), used only to add the `microphone` permission to the embedded iframe (`libs/chat-overlay/src/lib/ChatOverlay.ts:61`). `SetOverlayOptionsPayload` (`overlay-protocol.ts:151`) never carries `enabledFeatures` over the wire; `ChatOverlay.setOverlayOptions` (`ChatOverlay.ts:259-269,325-343`) and `ChatOverlayManager.setOverlayOptions` (`ChatOverlayManager.ts:371-378`) are both typed to accept only `theme | modelId | overlayConversationId`; and `OverlayContext`'s `SET_OVERLAY_OPTIONS` handling (`apps/chat/src/context/overlay/OverlayContext.tsx:219-240,684-732`) validates and applies only those same three fields. There is no app-side concept of a UI-section toggle at all — every surface (header, sidebar, sharing, message actions, marketplace, applications, etc.) renders unconditionally today.

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx:20-33`) already separates boolean `features` (backend capability flags such as `asrEnabled`, `liveChatInteraction`) from non-boolean `config` (e.g. `overlayEnabled`, `overlayAllowedOrigins`, `fileManagerTabs`), resolved server-side by `CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) through `AppConfigService.getClientConfig` (`app-config.service.ts:35-108`) and returned by `ClientConfigResponseDto` (`dto/client-config-response.dto.ts`). `environment.config.ts` already has an established comma-separated-list env pattern (`FILE_MANAGER_AVAILABLE_TABS`, `:633-642`) that trims/filters/defaults to `[]`.

The prior chat implementation (behavioral reference only, not present in this codebase) exposed 59 `Feature` enum keys through `ChatOverlayOptions.enabledFeatures` plus a role-filtering layer (`ENABLED_FEATURES_ROLES`) and a server allow-list (`ENABLED_FEATURES`). Of the 59, this change ports 32 (`overlay-features-analysis.json`, `status: "transferable"` subset, after removing two unwired candidates and six flags with no meaningful overlay use case — see D5 known-gaps table), records 19 keys as unavailable (`status: "missing"`), and explicitly does not port the role layer, playback methods, import/export, custom message buttons, or `enabledFeaturesData`.

## Goals / Non-Goals

**Goals:**

- Introduce one canonical, app-wide concept of a "UI feature" — visible/enabled by default, optionally replaced by an operator-level server baseline, and replaceable again per embed at runtime — replacing the previous ad-hoc "always on" state of every gated surface.
- Preserve 100% of current default behavior: with no `ENABLED_UI_FEATURES` set and no overlay override, every existing surface behaves exactly as it does before this change.
- Give overlay hosts a single mechanism (`setOverlayOptions({ enabledFeatures })`) to both hide default surfaces and re-enable operator-adjusted ones for their embed, without needing a page reload.
- Keep the 19 not-yet-supported keys documented and inert rather than silently accepted as if they worked.

**Non-Goals:**

- Porting `ENABLED_FEATURES_ROLES` or any role-based filtering of UI features (explicitly out of scope per the proposal).
- Implementing any of the 19 missing-status features' underlying functionality (prompts, playback, compare mode, assistant-message editing, `report-an-issue`/`request-api-key` dialogs, footer, full-width chat, context menu, clear-conversation, conversation info panel).
- Backwards-compatible comma-separated-string parsing of `enabledFeatures` on the wire — this is new protocol surface, not a re-implementation of a shipped one.
- A generic feature-flag framework for backend capability flags or transcription capabilities — those are unchanged; this change only adds the UI-section-visibility layer where it intersects with existing capability checks (`voice-input`, `live-chat-interaction`).

## Decisions

### D1 — Canonical type stays `OverlayFeature`, expanded in place

Keep `OverlayFeature` as the one enum (no parallel `UiFeature` alias). It is already the type of `ChatOverlayOptions.enabledFeatures`, already re-exported from `libs/chat-overlay`, and already documented as "optional embed-time features a host can opt into." Renaming would be a pointless breaking change to a type that hasn't shipped a second meaning yet. `apps/chat`'s internal manifest (defaults, negative/positive classification) is a separate, app-owned concept built on top of the same enum — see D3.

**Alternative rejected:** introduce `UiFeature` and alias `OverlayFeature = UiFeature` for compatibility — adds an indirection with no behavioral benefit since `OverlayFeature` has no competing meaning to disambiguate from.

### D2 — `enabledFeatures` accepts arrays only, not comma-separated strings

`ChatOverlayOptions.enabledFeatures` is already typed `OverlayFeature[]`. The wire payload (`SetOverlayOptionsPayload.enabledFeatures`) is a **new** field with no shipped consumers, so there is no compatibility burden to carry a `string`-splitting branch. Accepting only arrays keeps `hasSetOverlayOptionsPayload`'s validator (`OverlayContext.tsx:219-240`) a straightforward `Array.isArray` + per-element string check, symmetric with `theme`/`modelId`/`overlayConversationId` already being plain strings.

**Alternative rejected:** support `Feature[] | string` (comma-separated) to mirror the old library — rejected because it re-introduces ambiguous parsing (empty string vs. unset vs. single value) for a wire shape that has never shipped here.

### D3 — Three-layer resolution: default baseline / server replace → overlay replace

```
effective set =
  overlay.enabledFeatures != null
    ? normalize(overlay.enabledFeatures) ∩ KNOWN_UI_FEATURES   // replace, not merge
    : enabledUiFeatures != null
      ? normalize(enabledUiFeatures) ∩ KNOWN_UI_FEATURES       // server replace
      : DEFAULT_ENABLED_UI_FEATURES                            // compiled-in defaults
```

- **`DEFAULT_ENABLED_UI_FEATURES`** (`apps/chat/src/constants/ui-features.ts`, see D4, D12) is a compiled-in `OverlayFeature[]` array reflecting *today's* unconditional behavior — see the classification table below. Used as-is when neither server nor overlay supplies an override.
- **`enabledUiFeatures`** comes from `AppConfigContext.config.enabledUiFeatures: string[] | null` (server replace, D6). When non-null, it *replaces* `DEFAULT_ENABLED_UI_FEATURES` entirely — supports both positive features and `Hide*` modifier flags in one consistent mechanism. When null (env var not set or all-invalid), the compiled-in defaults are used.
- **Overlay replace**: when `SET_OVERLAY_OPTIONS.payload.enabledFeatures` is present (even as `[]`), the effective set becomes exactly the normalized, known-value intersection of that array — the server baseline is bypassed entirely for that embed (D9: this is intentional, not a bug). When the field is absent, the previously-computed effective set (server override or defaults, or a prior overlay override if one was already applied) is left untouched (D10).

This mirrors the old library's "replace, don't merge" `SettingsActions.setEnabledFeatures` semantics for both the server layer and the overlay layer, keeping the mechanism consistent for operators and overlay hosts alike.

### D4 — New `UiFeaturesContext`, mounted between `AppConfigProvider` and `OverlayModeGate`

New file `apps/chat/src/context/UiFeaturesContext.tsx`, following the `ThemeContext` pattern: `createContext<UiFeaturesContextType | undefined>(undefined)`, `useMemo`-wrapped value, `useUiFeatures()` throws outside the provider. Public surface:

```ts
interface UiFeaturesContextType {
  isEnabled: (feature: OverlayFeature) => boolean;
  enabledFeatures: ReadonlySet<OverlayFeature>;
  /** Consumed only by OverlayContext's SET_OVERLAY_OPTIONS handler (D3 replace step). */
  applyOverlayOverride: (features: string[] | undefined) => void;
}
```

`useUiFeature(feature: OverlayFeature): boolean` is a thin convenience hook (`apps/chat/src/hooks/useUiFeature.ts`) calling `useUiFeatures().isEnabled(feature)`.

Mount position in `apps/chat/src/main.tsx`:

```
AppConfigProvider                 (needs to exist for enabledUiFeatures)
  └─ UiFeaturesProvider           (NEW — computes effective set from server or defaults)
       └─ ... OverlayModeGate     (OverlayProvider, when mounted, calls applyOverlayOverride)
            └─ RequireAuth / App tree (every gated component consumes useUiFeature)
```

`UiFeaturesProvider` must sit **above** `OverlayModeGate` (not inside `OverlayProvider`) because non-overlay-mode components also need the server-configured `ENABLED_UI_FEATURES` baseline without any embedding at all, and because `OverlayContext`'s `handleSetOverlayOptions` needs to call `applyOverlayOverride` — it must be a descendant of `UiFeaturesProvider` to reach it via `useUiFeatures()`.

**Alternative rejected:** fold this state into `AppConfigContext` — rejected because `AppConfigContext` is a passive server-config mirror (fetch-once, no local reducer), while this state needs a local overlay-triggered replace operation; conflating the two would force `AppConfigContext` to grow overlay-transport awareness it otherwise has no reason to hold.

### D5 — Feature manifest classification (why each default is what it is)

Every transferable key is classified as **Positive** (its presence in the effective set enables/shows something) or **Modifier** (its presence hides/disables/restricts something that positive features already show, or changes a default visual/behavioral choice). `DEFAULT_ENABLED_UI_FEATURES` = all Positive keys whose underlying functionality is unconditionally present today, plus the subset of Modifier keys whose "on" state already matches current unconditional behavior. Every other Modifier defaults off, so a deployment that sets nothing observes zero behavior change.

| Value | Class | Default | Owning surface / component | Rationale |
|---|---|---|---|---|
| `header` | Positive | **on** | `Header/Header.tsx` | App header always renders today |
| `conversations-section` | Positive | **on** | `libs/sidebar`, `ConversationPanel` | Sidebar always available today |
| `conversations-panel-toggle` | Positive | **on** | `Header.tsx`, `ChatLayout.tsx` toggle button | Toggle button always present |
| `showConversationsSectionByDefault` | Modifier (initial-state) | **on** | Sidebar open/closed initial state | Sidebar currently opens by default on desktop |
| `attachments-manager` | Positive | **on** | `AttachmentCanvasProvider` mount in `app.tsx` | Always mounted today |
| `hide-new-conversation` | Modifier (hide) | **off** | New-conversation button (`Header.tsx`/`ChatLayout.tsx`) | Button is visible today; hiding is opt-in |
| `disallow-change-agent` | Modifier (restrict) | **off** | Same model-selector call site | Selector is changeable today; restricting is opt-in |
| `likes` | Positive | **on** | `build-message-actions.ts` `onLike`/`onDislike` | Present today |
| `dislike-comment` | Positive | **on** | `NegativeFeedbackModal.tsx` | Present today |
| `input-files` | Positive | **on** | `AddAttachmentButton` (conversation-input) | Present today |
| `live-chat-interaction` | Positive | **on** | `ClientChannelContext` UI path | Present today; backend `features.liveChatInteraction` remains the independent capability gate (D8) |
| `hide-edit-user-message` | Modifier (hide) | **off** | `build-message-actions.ts` `onEdit` | Present today |
| `hide-regenerate-assistant-message` | Modifier (hide) | **off** | `build-message-actions.ts` `onRegenerate` | Present today |
| `hide-delete-user-message` | Modifier (hide) | **off** | `build-message-actions.ts` delete action | Present today |
| `skip-focus-chat-input-onload` | Modifier (behavior) | **off** | Chat-input auto-focus effect | Auto-focus happens today; skipping is opt-in |
| `disabled-send` | Modifier (disable) | **off** | Send button | Enabled today; disabling is opt-in |
| `empty-chat-settings` | Positive | **on** | `NewConversationComposer.tsx` | Present today |
| `hide-empty-chat-change-agent` | Modifier (hide) | **off** | Model selector on the composer screen | Visible today |
| `conversations-sharing` | Positive | **on** | `ShareConversationPopoverContainer.tsx` | Present today |
| `applications-sharing` | Positive | **on** | Application sharing UI | Present today |
| `toolsets-sharing` | Positive | **on** | Toolsets sharing UI | Present today |
| `conversations-publishing` | Positive | **on** | `PublishConversationPanelContainer.tsx` | Present today |
| `hide-user-settings` | Modifier (hide) | **off** | `UserMenu.tsx` settings entry | Visible today |
| `hide-user-menu` | Modifier (hide) | **off** | User avatar/menu button in header | Visible today |
| `custom-applications` | Positive | **on** | AppsEditor "Add app" menu | Present today |
| `hide-custom-app-creation` | Modifier (hide) | **off** | "Custom app" entry in the Add-app menu | Visible today |
| `code-apps` | Positive | **on** | AppsEditor Code Apps route | Present today |
| `catalog` | Positive | **on** | `CatalogView` at `/catalog` | Present today |
| `catalog-table-view` | Modifier (initial-state) | **off** | `CatalogViewMode` toggle default | Current default view is grid |
| `catalog-hide-my-apps` | Modifier (restrict) | **off** | CatalogView shared/created filter | Both shown today |
| `toolsets` | Positive | **on** | Toolsets functionality | Present today |
| `voice-input` | Positive | **on** | Voice input button + iframe `microphone` permission | Present today; the existing ASR-model/deployment-audio support path remains the independent capability gate (D8) |
Total: 19 default-on, 13 default-off — 32 keys.

**Known gaps and intentionally excluded flags:**

*Excluded — require new UI behaviour (out of scope for this change):*

| Value | Reason |
|---|---|
| `md-sidebar-overlay-breakpoint` | No "overlay" (fixed/backdrop) sidebar mode exists in this codebase — the sidebar only ever pushes content at a single breakpoint. Wiring this key would require building new overlay/backdrop UI. |
| `user-message-align-end` | Both user-message render paths already hardcode `justify-end` unconditionally; there is no alternate start-aligned state to toggle, and inventing one risks changing default rendering. |

*Excluded — behavior is unconditional; exposing a toggle adds complexity with no practical override use case:*

| Value | Reason |
|---|---|
| `custom-logo` | Logo rendering from theme config is always active; overlay hosts control theming through the `theme` parameter. |
| `show-layout-dividers` | Sidebar dividers are a fixed visual treatment with no meaningful override scenario. |
| `top-settings` | Top-bar settings panel is always rendered; `disallow-change-agent` covers the meaningful agent-restriction case. |
| `top-chat-model-settings` | Model selector is always rendered; `disallow-change-agent` covers agent-change restriction. |
| `chat-header-border` | Header bottom border is rendered unconditionally; no overlay use case for suppressing it. |
| `chat-input-border` | Accent border on the chat input is rendered unconditionally; no overlay use case for suppressing it. |

**Alternative rejected:** default everything off ("safe by default") — rejected per the proposal's explicit instruction: this would hide/disable functionality (new-conversation button, message actions, sharing, etc.) that works unconditionally today, breaking the normal (non-overlay) app on day one of this change.

**Alternative rejected:** default everything on (naive "enable all enum values") — rejected for the same reason in the other direction: modifier keys like `disabled-send` or `hide-user-menu` would newly hide/disable things that work today.

### D6 — Server baseline override: `ENABLED_UI_FEATURES` (replace semantics)

Env var name is `ENABLED_UI_FEATURES`. Replace semantics (allow-list) were chosen over a removal-only list because:
1. **Asymmetric flag types** — `OverlayFeature` contains both positive flags (`header`, `likes`) and modifier/hide flags (`hide-new-conversation`, `hide-user-menu`). A removal-only list can only remove from defaults, meaning modifier flags (which default off) would be permanently unreachable from server config. An allow-list covers both types uniformly with a single mechanism.
2. **Migration ease** — existing overlay hosts in the old chat already supply `enabledFeatures` arrays covering all they need. Operators of the new chat can lift those same arrays directly into `ENABLED_UI_FEATURES` without translation.
3. **Consistency** — the overlay layer uses replace semantics. Using replace at the server layer too means one mental model: "this list IS your feature set."

`ENABLED_UI_FEATURES` is typed `string[] | null`:
- `null` (env var absent, empty, or all-invalid) → use compiled-in `DEFAULT_ENABLED_UI_FEATURES`.
- `string[]` (at least one recognized value) → replaces `DEFAULT_ENABLED_UI_FEATURES` entirely (after filtering to `KNOWN_UI_FEATURES`).

Exposed as `config.enabledUiFeatures: string[] | null` (not nested under `features`), following the existing `config.fileManagerTabs`/`config.overlayAllowedOrigins` pattern for "non-boolean, client-visible list" config — consistent with `AppConfigService`'s existing split between `features: Record<string, boolean>` and `config: {...}`.

Registry entry (`config-registry.constants.ts`):

```ts
{
  key: 'uiFeatures.enabledUiFeatures',
  type: 'config',
  valueType: 'json',
  visibility: 'client',
  defaultValue: null,
  critical: false,
  description:
    'When set, the complete list of OverlayFeature values that are enabled (replace semantics). Replaces DEFAULT_ENABLED_UI_FEATURES entirely — includes both positive and Hide* modifier flags. When not set (null), the compiled-in DEFAULT_ENABLED_UI_FEATURES baseline is used.',
  owner: 'chat-team',
  envVar: 'ENABLED_UI_FEATURES',
}
```

`EnvironmentVariables` field (`environment.config.ts`):

```ts
@IsOptional()
@Transform(({ value }) => {
  if (value == null || value === '') return null;
  const parts = String(value).split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  return parts.length > 0 ? parts : null;
})
@IsString({ each: true })
ENABLED_UI_FEATURES?: string[] | null = null;
```

### D7 — Invalid entries: filtered with a warning; all-invalid falls back to null

`ENABLED_UI_FEATURES` entries are free-form strings at the `class-validator` layer (matching `FILE_MANAGER_AVAILABLE_TABS`'s own `@IsString({ each: true })`, not a fixed-enum validator) so that adding a new `OverlayFeature` value later never requires touching env validation. The **filtering against known `OverlayFeature` values happens in `AppConfigService`**, mirroring `CompositeConfigProvider`'s existing "log a warning, skip" pattern for provider errors:

- Any entry not a recognized `OverlayFeature` value is dropped and logged at `warn` level (key name + unrecognized value). Never crashes the request, never fails NestJS boot.
- If the env var is set but **every entry is unrecognized** after filtering, `AppConfigService` logs an additional `warn` and falls back to `null` (use compiled-in defaults), rather than sending `[]` to the client. This is the safer footgun-prevention behavior: an operator who sets `ENABLED_UI_FEATURES=typo-only` gets the default UI rather than a completely blank one.

This keeps `ENABLED_UI_FEATURES` forward-compatible with new feature keys without a redeploy-blocking validation step.

**Alternative rejected:** fail-fast on an unrecognized entry during env validation (`class-validator` custom validator against the enum) — rejected because it would force an operator to redeploy `chat-api` in lockstep with every new `OverlayFeature` value ever added, for a setting that is a soft UI preference, not a security boundary.

### D8 — Capability gates remain independent of the UI toggle

`voice-input`'s effective visibility is `isEnabled('voice-input')` combined with the existing audio-transcription capability path: an explicit ASR model enables it, otherwise the selected deployment must advertise audio input support. The iframe `allow="microphone"` permission (`ChatOverlay.ts:61-64`) continues to key off the same `enabledFeatures` array the host passed to the constructor (`ChatOverlayOptions`, library-side, independent of the app-side manifest). `live-chat-interaction`'s effective visibility is `isEnabled('live-chat-interaction') && useFeatureFlag('liveChatInteraction')` — `ClientChannelProvider` (`ClientChannelContext.tsx:68`) keeps its own `useFeatureFlag('liveChatInteraction')` call unchanged; the UI toggle only gates whatever UI affordance surfaces the pending-signin dialog, not the channel subscription itself. Every other transferable key hides/shows UI only and carries no authorization meaning — this mirrors the proposal's explicit "not a security boundary" framing for the whole toggle system.

### D9 — Overlay replace bypasses the server baseline by design

A host that explicitly lists `enabledFeatures: ['header', 'likes']` gets exactly `{header, likes}` even if the server's `ENABLED_UI_FEATURES` omits `header`. This is intentional: `ENABLED_UI_FEATURES` is a *default* baseline for embeds/deployments that don't specify anything, not an authorization ceiling. An operator that needs a hard ceiling a host cannot override is out of scope for this change (would require the role-layer equivalent, explicitly excluded).

### D10 — No reset-to-baseline sentinel; omission means "leave unchanged"

`SET_OVERLAY_OPTIONS` with `enabledFeatures` **absent** (undefined/key missing) leaves whatever effective set was already active (server/default baseline on first handshake, or a previously-applied override) untouched — same "absent = unset, not malformed" rule already governing `theme`/`modelId`/`overlayConversationId` (`chat-overlay-protocol` spec). `enabledFeatures` **present as `[]`** is a valid, explicit replace — "show nothing this toggle system governs beyond what's not gated at all." No `null`-sentinel "reset to baseline" mechanism is introduced in this change; a host that wants the baseline back must resend the array it computed as the baseline (it can read the baseline once via the existing client-config values it already fetched, or simply avoid calling `setOverlayOptions({ enabledFeatures })` until it wants to override). Keeping this out avoids a second special value with its own edge cases for a need no current consumer has expressed.

### D11 — Unknown/invalid runtime `enabledFeatures` entries: filtered, not rejected

`SetOverlayOptionsResponse.applied` is documented as "`false` only signals a fallback, never a thrown error" (existing doc comment, `overlay-protocol.ts:241`). Consistent with that contract, an `enabledFeatures` array containing unrecognized strings is normalized by dropping the unrecognized entries (logged via the existing `logOverlayWarning` helper, `OverlayContext.tsx:274-280`, one warning per unrecognized value) and applying the rest; the response is still `{ applied: true }` as long as `theme`/`modelId`/`overlayConversationId` (if present) were themselves valid — `enabledFeatures` filtering never blocks the other three fields in the same request. If **every** entry in a non-empty array is unrecognized, the effective set becomes empty (not "ignore the whole field") — this matches "replace" semantics literally: the host asked for a specific (if partially bogus) set, and got the valid subset of it, including "none."

**Alternative rejected:** reject the entire `SET_OVERLAY_OPTIONS` request (`applied: false`) on any unrecognized value — rejected because a single stale/typo'd feature key would also block an otherwise-valid `theme`/`modelId` update bundled in the same call, and `applied: false` is documented as a fallback signal, not an error channel.

### D12 — Manifest module placement: `apps/chat/src/constants`, not `libs/chat-shared`

`OverlayFeature` (the enum) lives in `libs/chat-shared` because it is wire-protocol surface shared with `libs/chat-overlay` and any future overlay consumer. `DEFAULT_ENABLED_UI_FEATURES` (the classification/default table above) is **app policy**, not protocol — it encodes which app components exist and what their current default behavior is, which `libs/chat-shared` must never know per the "type:shared libs import nothing / no app knowledge" boundary rule. It lives in `apps/chat/src/constants/ui-features.ts`, imported only by `UiFeaturesContext`.

## Risks / Trade-offs

- **[Risk] Per-component gating touches ~15 existing files across unrelated domains (header, sidebar, sharing, marketplace, message actions).** → Mitigation: each gate is a single `useUiFeature(...)`-guarded conditional at an existing render/behavior branch, no restructuring; tasks.md slices this by owning-component so each slice is independently testable and revertable.
- **[Risk] A deployment that mistypes `ENABLED_UI_FEATURES` silently falls back to the compiled-in defaults when all entries are invalid.** → Mitigation: `warn`-level log per unrecognized entry (D7) is consistent with this repo's existing non-critical-config-error pattern; escalating to a hard failure was explicitly rejected (D7) to avoid coupling redeploys to enum growth.
- **[Risk] Overlay replace bypassing the server baseline (D9) could surprise an operator who assumed `ENABLED_UI_FEATURES` was a hard ceiling.** → Mitigation: documented explicitly in the spec and this design; matches the proposal's own recommended direction, and no role-based hard ceiling exists in this system (out of scope) to contradict it.
- **[Risk] 32 default classifications (D5) are a judgment call without a design mockup to verify against.** → Mitigation: every classification is anchored to "does this already happen unconditionally in the current code today" (traceable to the file/line notes in `overlay-features-analysis.json`), not to a guess about desired future behavior; any that reviewers disagree with is a one-line change to the table and the `DEFAULT_ENABLED_UI_FEATURES` set, not a structural rework.

## Migration Plan

Additive only — no data migration, no breaking wire changes. Rollout order (also reflected in `tasks.md`): (1) protocol types, (2) backend config plumbing (dark — `ENABLED_UI_FEATURES` absent by default, `null`), (3) `UiFeaturesContext` (baseline computed, no gating wired yet — a no-op mount), (4) overlay wire-up, (5) per-surface gating (each surface's rollout is independently revertable by reverting that one file's gate), (6) sandbox + docs. Rollback: revert the per-surface gating commits first (restores unconditional rendering) before reverting the context/protocol layer, since the reverse order would leave components calling a hook that no longer exists.

## Open Questions

- None blocking implementation. If a future change wants a hard (non-overlay-overridable) ceiling on specific UI sections, that is the `ENABLED_FEATURES_ROLES`-equivalent layer explicitly deferred out of this change's scope.

## Migration Notes (for hosts migrating from the old chat)

- The six wire strings `custom-logo`, `show-layout-dividers`, `top-settings`, `top-chat-model-settings`, `chat-header-border`, and `chat-input-border` are not recognized `OverlayFeature` values in this codebase. Hosts that pass them in `enabledFeatures` will see them logged as unknown and silently dropped (per D11). No behavior change results — the functionality they guarded in the old chat is unconditional here.
- The wire strings `marketplace`, `marketplace-hide-my-apps`, and `marketplace-table-view` from the old chat are named `catalog`, `catalog-hide-my-apps`, and `catalog-table-view` here, matching the `/catalog` route and `CatalogView` component naming used throughout this codebase. Replace the old strings with their `catalog-*` equivalents in any `enabledFeatures` array or `ENABLED_UI_FEATURES` config.
