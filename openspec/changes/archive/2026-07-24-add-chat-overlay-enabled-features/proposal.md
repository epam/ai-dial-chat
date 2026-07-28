## Why

The chat-overlay protocol already types `ChatOverlayOptions.enabledFeatures?: OverlayFeature[]` and the `OverlayFeature` enum already exists (`libs/chat-shared/src/types/overlay/overlay-protocol.ts:69`), but only one value (`voice-input`) is defined, `SetOverlayOptionsPayload` never carries the field over the wire (`overlay-protocol.ts:151`), and neither `ChatOverlay.setOverlayOptions` (`libs/chat-overlay/src/lib/ChatOverlay.ts:259,325`) nor `OverlayContext`'s handler (`apps/chat/src/context/overlay/OverlayContext.tsx:225,684`) reads or applies it. There is also no app-side concept of a UI-section toggle at all: every embeddable surface (header, sidebar, sharing, message actions, marketplace, etc.) always renders unconditionally, and there is no deployment-level baseline for turning any of it off. Embedding hosts that need to hide or restrict specific UI sections — the same shape of requirement the previous chat implementation served via a `Feature` allow-list — have no supported mechanism today.

## What Changes

- Expand `OverlayFeature` (`libs/chat-shared`) from one member to the full set of 32 UI-section toggle keys carried over from the previous implementation's `Feature` enum, keeping the existing name/import path (no new parallel `UiFeature` type).
- Add `enabledFeatures?: string[]` to `SetOverlayOptionsPayload` and specify its replace (not merge) semantics, normalization, and handling of unsupported/unknown values.
- Add a new app-owned `UiFeaturesContext` (`apps/chat/src/context/UiFeaturesContext.tsx`) that computes an effective UI-feature set from a compiled-in default baseline, an optional server allow-list replacement, and — in overlay mode only — a runtime replacement pushed through `SET_OVERLAY_OPTIONS`. Expose `useUiFeature(feature)` / `useUiFeatures()` for consumers.
- Add an `ENABLED_UI_FEATURES` server environment variable (comma-separated `OverlayFeature` values), a new `config-registry` entry, and a new `config.enabledUiFeatures: string[] | null` field on the `GET /api/v1/client-config` response.
- Wire each of the 32 transferable feature keys to the app component/container that already implements the corresponding surface (see `design.md` for the full ownership table), gating visibility/behavior without introducing new functionality.
- Update `ChatOverlay`/`ChatOverlayManager`'s `setOverlayOptions` signature and initial-options send to include `enabledFeatures`, and extend the sandbox with a case that exercises it.
- Explicitly do **not** implement: the old `ENABLED_FEATURES_ROLES` role-filtering layer, the 19 `status: "missing"` keys as working toggles (recorded as unsupported instead — see `design.md`), playback methods, import/export, custom message buttons, or `enabledFeaturesData`.

**BREAKING:** None — `OverlayFeature` gains members (additive), `SetOverlayOptionsPayload` gains an optional field (additive), and every new UI-feature default preserves today's unconditional behavior (see `design.md` "Default baseline" table). No existing requirement's observable behavior changes for a host that never sets `enabledFeatures`.

## Capabilities

### New Capabilities

- `ui-feature-toggles`: app-owned UI-section feature state — the default baseline manifest, the `ENABLED_UI_FEATURES` server replacement, the overlay-runtime replace-semantics reducer, the `UiFeaturesContext`/hook surface, and the per-feature gating contract each owning component follows (including the `voice-input`/`live-chat-interaction` capability-gate combination).

### Modified Capabilities

- `chat-overlay-protocol`: expand `OverlayFeature`; add `enabledFeatures` to `SetOverlayOptionsPayload`; specify payload normalization/validation and the "unknown value → filtered with a warning, request still applied" rule.
- `chat-overlay-library`: `ChatOverlayOptions`/`setOverlayOptions` already type `enabledFeatures`, but `setOverlayOptions`'s runtime signature, the initial options send, and `ChatOverlayManager` forwarding must actually include it; update README and tests.
- `chat-overlay-app-mode`: `OverlayContext`'s `SET_OVERLAY_OPTIONS` handling gains a fourth applied field (`enabledFeatures`), delegated to `UiFeaturesContext`'s replace-semantics setter alongside the existing `theme`/`modelId`/`overlayConversationId` handling.
- `chat-overlay-sandbox`: add a case exercising `enabledFeatures` presets/custom input through both `ChatOverlay` and `ChatOverlayManager`.
- `config-registry-and-env-provider`: add the `uiFeatures.enabledUiFeatures` registry entry (`envVar: 'ENABLED_UI_FEATURES'`, `visibility: 'client'`, `valueType: 'json'`).
- `client-config-endpoint`: add `config.enabledUiFeatures: string[] | null` to the response DTO and OpenAPI contract.

## Impact

- **Frontend:** new `apps/chat/src/context/UiFeaturesContext.tsx` (+ hook), a new `libs/chat-shared` manifest/enum module, and gating edits across ~15 existing app components/containers listed in `design.md` (Header, ChatLayout, NewConversationComposer, UserMenu, Logo, CatalogView, build-message-actions, NegativeFeedbackModal, AddAttachmentButton call sites, ModelSelectorControl usage sites, PublishConversationPanelContainer, ShareConversationPopoverContainer, sidebar panel usage). No new routes, no new i18n strings beyond ones already shown by the gated surfaces (features only hide/show existing UI; see `specs/ui-feature-toggles/spec.md` for the i18n statement).
- **Backend:** `apps/chat-api/src/config/environment.config.ts` (new `ENABLED_UI_FEATURES` var, comma-separated-list pattern matching `FILE_MANAGER_AVAILABLE_TABS`), `config-registry.constants.ts` (new entry), `app-config.service.ts` (resolve + filter to known `OverlayFeature` values), `client-config-response.dto.ts` (new field), plus `libs/chat-api-client` OpenAPI regeneration.
- **Shared protocol:** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` (enum expansion, payload field), `libs/chat-overlay` (library + manager + README + tests).
- **Sandbox:** `apps/chat-overlay-sandbox` gains one new case.
- **No changes** to `ENABLED_FEATURES_ROLES`-equivalent role filtering (not introduced), no changes to conversation playback, import/export, or custom message button surfaces (none exist to gate).

## Clarifying questions resolved during investigation

- **State ownership:** a new context is warranted — no existing context (`AppConfigContext`, `OverlayContext`) is positioned to own a locally-computed, overlay-overridable UI manifest; `AppConfigContext` owns raw server config/booleans only, and `OverlayContext` owns transport/handshake state, not UI-facing derived state. `UiFeaturesContext` mounts under `AppConfigProvider` (needs `enabledUiFeatures`) and above `OverlayModeGate` (so `OverlayProvider` can call its setter) — see `design.md` provider-tree diagram.
- **Scope creep flag:** this proposal touches one shared lib (`libs/chat-shared`) to add pure enum/type members only (no logic), and does not touch any other `libs/*` beyond `libs/chat-overlay` (already an overlay-protocol consumer). All host/gating logic stays in `apps/chat`.
