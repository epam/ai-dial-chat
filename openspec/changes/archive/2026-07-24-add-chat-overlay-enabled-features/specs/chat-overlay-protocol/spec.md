## ADDED Requirements

### Requirement: OverlayFeature enum covers the 38 transferable UI-section toggle keys

`libs/chat-shared/src/types/overlay/overlay-protocol.ts`'s `OverlayFeature` enum SHALL be expanded from its single `VoiceInput = 'voice-input'` member to exactly 38 members, covering the groups: applications (`code-apps`, `custom-applications`, `hide-custom-app-creation`), chat header (`chat-header-border`), chat input (`chat-input-border`, `disabled-send`, `skip-focus-chat-input-onload`), conversation functions (`dislike-comment`, `input-files`, `likes`, `live-chat-interaction`), conversation header (`disallow-change-agent`, `hide-new-conversation`, `top-chat-model-settings`, `top-settings`), empty chat (`empty-chat-settings`, `hide-empty-chat-change-agent`), layout (`attachments-manager`, `conversations-panel-toggle`, `conversations-section`, `header`, `showConversationsSectionByDefault`, `show-layout-dividers`), marketplace (`marketplace`, `marketplace-hide-my-apps`, `marketplace-table-view`), message editing (`hide-delete-user-message`, `hide-edit-user-message`, `hide-regenerate-assistant-message`), publishing (`conversations-publishing`), sharing (`applications-sharing`, `conversations-sharing`, `toolsets-sharing`), toolsets (`toolsets`), user settings (`custom-logo`, `hide-user-menu`, `hide-user-settings`), and voice input (`voice-input`, pre-existing). This module SHALL remain import-free (no imports from `apps/*`, `libs/chat-overlay`, or app-owned code), consistent with its existing "pure types only" requirement.

**Feature flag:** N/A — this is the enum definition itself, not a gated feature. This repo has no `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` mechanism to gate it behind.

#### Scenario: OverlayFeature has exactly 38 members

- **WHEN** `Object.values(OverlayFeature)` is inspected
- **THEN** it has exactly 38 unique string values, including `'voice-input'` (pre-existing) and `'header'`, `'likes'`, `'hide-new-conversation'`, `'live-chat-interaction'` (new)

#### Scenario: The 21 absent keys are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `code-interpreter`, `compare-mode-disabled`, `input-links`, `message-templates`, `hide-top-context-menu`, `top-chat-info`, `top-clear-conversation`, `chat-full-width-by-default`, `footer`, `prompts-panel-toggle`, `prompts-section`, `showPromptsSectionByDefault`, `edit-all-assistant-message`, `edit-last-assistant-message`, `disabled-playback-controls`, `prompts-publishing`, `prompts-sharing`, `report-an-issue`, or `request-api-key` (19 keys with no transferable UI surface in this repo), nor for `md-sidebar-overlay-breakpoint` or `user-message-align-end` (2 keys removed because they require new UI behaviour to wire — see design.md known-gaps table)

### Requirement: SetOverlayOptionsPayload carries an optional enabledFeatures array

`SetOverlayOptionsPayload` (`overlay-protocol.ts`) SHALL gain an optional field `enabledFeatures?: string[]`. It is typed `string[]` (not `OverlayFeature[]`) at the wire-payload level because the app must accept and filter out-of-date or unrecognized values from a host without a compile-time guarantee the host is running the same version of the enum; `ChatOverlayOptions.enabledFeatures` (the library-facing, pre-existing field) remains typed `OverlayFeature[]` for library callers who do get compile-time checking. Absent, `null`, or `undefined` SHALL be treated as unset (no override change), matching the existing "unset optional fields are not malformed" rule already governing `theme`/`modelId`/`overlayConversationId`. This field carries no comma-separated-string form — array only.

#### Scenario: enabledFeatures is optional and array-typed

- **WHEN** `SetOverlayOptionsPayload` is inspected
- **THEN** it has an optional `enabledFeatures?: string[]` field alongside the pre-existing `hostDomain`, `theme?`, `modelId?`, `overlayConversationId?` fields

#### Scenario: Absent enabledFeatures does not break the existing malformed-payload guard

- **WHEN** a `SET_OVERLAY_OPTIONS` payload omits `enabledFeatures` entirely
- **THEN** `hasSetOverlayOptionsPayload` (or its updated equivalent) still accepts the payload as well-formed, identically to today

#### Scenario: enabledFeatures present as a non-array is rejected as malformed

- **WHEN** a `SET_OVERLAY_OPTIONS` payload includes `enabledFeatures: "header,likes"` (a string, not an array)
- **THEN** the payload is rejected as malformed by the same validator that already rejects non-string `theme`/`modelId`/`overlayConversationId`, and no response is sent for that request
