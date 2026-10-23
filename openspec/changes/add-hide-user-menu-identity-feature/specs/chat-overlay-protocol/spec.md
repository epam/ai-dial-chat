## RENAMED Requirements

- FROM: `### Requirement: OverlayFeature enum covers the 55 transferable UI-section toggle keys`
- TO: `### Requirement: OverlayFeature enum covers the 56 transferable UI-section toggle keys`

## MODIFIED Requirements

### Requirement: OverlayFeature enum covers the 56 transferable UI-section toggle keys

`libs/chat-overlay/src/protocol/overlay-protocol.ts`'s `OverlayFeature` enum SHALL have exactly 56 members, covering the groups: applications (`code-apps`, `schema-apps`, `hide-custom-app-creation`, `custom-apps`), chat input (`disabled-send`, `skip-focus-chat-input-onload`, `chat-settings`, `removable-tools`), conversation functions (`dislike-comment`, `input-files`, `likes`, `live-chat-interaction`), conversation header (`disallow-change-agent`, `hide-change-agent`, `hide-new-conversation`), empty chat (`empty-chat-settings`, `hide-empty-chat-change-agent`), layout (`attachments-manager`, `conversations-panel-toggle`, `conversations-section`, `header`, `hide-navigation-menu`, `showConversationsSectionByDefault`, `hide-conversations-filter`), catalog (`catalog`, `catalog-hide-my-apps`, `catalog-table-view`), file manager (`file-manager`), message editing (`hide-delete-user-message`, `hide-edit-user-message`, `hide-regenerate-assistant-message`), publishing (`conversations-publishing`), sharing (`applications-sharing`, `conversations-sharing`, `toolsets-sharing`), toolsets (`toolsets`), prompts (`prompts`), skills (`skills`), user settings (`hide-user-menu`, `hide-user-menu-identity`, `hide-user-settings`, `hide-keyboard-shortcuts`), voice input (`voice-input`), starters (`show-all-starters`, `starters-below-greeting`, `hide-starter-icon`), greeting (`hide-greeting`), footer (`hide-footer-version`), agent description (`show-agent-description`), input history (`disable-input-history-navigation`), conversation export (`hide-conversation-export`), conversation import (`hide-conversation-import`), settings page (`hide-settings-page`), usage page (`hide-usage-page`), header logo (`show-header-logo`), and conversation drafts (`conversation-drafts`). This module SHALL remain import-free (no imports from `apps/*` or app-owned code), consistent with the "Protocol types are pure" requirement.

`apps/chat-api`'s `KNOWN_UI_FEATURES` SHALL mirror this membership one-to-one. It is duplicated rather than imported so the Node-only service stays independent of the browser-facing overlay package, and it SHALL be updated in the same change as any addition, removal, or rename here — a key present in only one of the two is silently unusable through `ENABLED_UI_FEATURES`.

Renamed wire values MAY be kept accepted transitionally through
`DEPRECATED_OVERLAY_FEATURE_ALIASES` and `resolveOverlayFeature` in the same module,
each mapping one retired string onto a current `OverlayFeature` member. A deprecated
value SHALL resolve to its replacement rather than being dropped, and SHALL NOT be a
member of the enum itself. `apps/chat-api`'s `DEPRECATED_UI_FEATURE_ALIASES` SHALL
mirror that map for the same reason `KNOWN_UI_FEATURES` mirrors the enum.

**Feature flag:** N/A — this is the enum definition itself, not a gated feature. This repo has no `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` mechanism to gate it behind.

#### Scenario: OverlayFeature has exactly 56 members

- **WHEN** `Object.values(OverlayFeature)` is inspected
- **THEN** it has exactly 56 unique string values, including `'chat-settings'`, `'removable-tools'`, `'hide-navigation-menu'`, `'voice-input'`, `'header'`, `'likes'`, `'hide-new-conversation'`, `'live-chat-interaction'`, `'prompts'`, `'skills'`, `'file-manager'`, `'hide-change-agent'`, `'hide-conversations-filter'`, `'hide-keyboard-shortcuts'`, `'hide-user-menu-identity'`, `'show-all-starters'`, `'starters-below-greeting'`, `'hide-greeting'`, `'hide-footer-version'`, `'show-agent-description'`, `'disable-input-history-navigation'`, `'hide-conversation-export'`, `'hide-conversation-import'`, `'hide-settings-page'`, `'hide-usage-page'`, `'show-header-logo'`, `'conversation-drafts'`, and `'hide-starter-icon'`

#### Scenario: The renamed marketplace keys are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `marketplace`, `marketplace-hide-my-apps`, or `marketplace-table-view` — those were renamed to `catalog`, `catalog-hide-my-apps`, and `catalog-table-view`

#### Scenario: The renamed custom-applications key is not in the enum but still resolves

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `custom-applications` — it was renamed to `schema-apps`, because it gates the Quick App create entry rather than schema-less custom applications
- **AND** `resolveOverlayFeature('custom-applications')` returns `OverlayFeature.SchemaApps`, so a host still sending the old string keeps the behavior it expects

#### Scenario: An unrecognized value resolves to undefined

- **WHEN** `resolveOverlayFeature('not-a-real-feature')` is called
- **THEN** it returns `undefined`, leaving the caller to drop the value and warn

#### Scenario: Keys whose behavior became unconditional are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `custom-logo`, `show-layout-dividers`, `top-settings`, `top-chat-model-settings`, `chat-header-border`, or `chat-input-border` — the behavior each guarded is unconditional in the new chat

#### Scenario: The 21 absent keys are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `code-interpreter`, `compare-mode-disabled`, `input-links`, `message-templates`, `hide-top-context-menu`, `top-chat-info`, `top-clear-conversation`, `chat-full-width-by-default`, `footer`, `prompts-panel-toggle`, `prompts-section`, `showPromptsSectionByDefault`, `edit-all-assistant-message`, `edit-last-assistant-message`, `disabled-playback-controls`, `prompts-publishing`, `prompts-sharing`, `report-an-issue`, or `request-api-key` (19 keys with no transferable UI surface in this repo), nor for `md-sidebar-overlay-breakpoint` or `user-message-align-end` (2 keys removed because they require new UI behaviour to wire — see design.md known-gaps table)

