## MODIFIED Requirements

### Requirement: SET_OVERLAY_OPTIONS applies to existing contexts

On receiving `SET_OVERLAY_OPTIONS`, the app SHALL: set `hostDomain` from the payload (validated per `chat-overlay-protocol`); if `theme` is present, apply it via the existing `ThemeContext` setter; if `modelId` is present, apply it via `DeploymentsContext`'s `restoreSelectedItemId` (not `setSelectedItemId`, so the overlay-driven choice does not overwrite the end-user's persisted `UserConfig` preference); if `overlayConversationId` is present, navigate to that conversation using the existing route/`ConversationPage` loading path; if `enabledFeatures` is present, apply it via `UiFeaturesContext`'s `applyOverlayOverride` setter, which replaces (does not merge with) the app's current effective UI-feature set (see `ui-feature-toggles`). The app SHALL respond `SET_OVERLAY_OPTIONS/RESPONSE` only after these have been applied (or determined inapplicable, e.g. an unknown `modelId`, or filtered, e.g. unrecognized `enabledFeatures` entries per `ui-feature-toggles`).

#### Scenario: modelId does not overwrite the user's persisted preference

- **WHEN** `SET_OVERLAY_OPTIONS` includes `modelId: 'gpt-4o'` for a user whose own `UserConfig` selection is a different model
- **THEN** the displayed selection changes to `gpt-4o` for this session
- **AND** the user's persisted `UserConfig` selected-deployment value is unchanged

#### Scenario: overlayConversationId navigates to that conversation

- **WHEN** `SET_OVERLAY_OPTIONS` includes `overlayConversationId: 'abc'`
- **THEN** the app navigates to and loads the conversation with id `'abc'`, and once loaded emits `SELECTED_CONVERSATION_LOADED`

#### Scenario: Unknown modelId does not crash the handshake

- **WHEN** `SET_OVERLAY_OPTIONS` includes a `modelId` that does not match any available deployment
- **THEN** the app still responds `SET_OVERLAY_OPTIONS/RESPONSE` and falls back to its normal default-deployment resolution

#### Scenario: enabledFeatures is applied through UiFeaturesContext, replacing the current effective set

- **WHEN** `SET_OVERLAY_OPTIONS` includes `enabledFeatures: ['header', 'likes']`
- **THEN** `UiFeaturesContext.applyOverlayOverride(['header', 'likes'])` is called, and the app's effective UI-feature set becomes exactly `{header, likes}`

#### Scenario: Absent enabledFeatures does not call applyOverlayOverride

- **WHEN** `SET_OVERLAY_OPTIONS` omits `enabledFeatures` entirely
- **THEN** `UiFeaturesContext.applyOverlayOverride` is not called, and the previously-active effective UI-feature set is unchanged

#### Scenario: enabledFeatures is applied together with theme/modelId/overlayConversationId in one response

- **WHEN** `SET_OVERLAY_OPTIONS` includes `theme: 'dark'`, `modelId: 'gpt-4o'`, and `enabledFeatures: ['header']` in a single payload
- **THEN** all three are applied (theme changes, model selection restores, effective UI-feature set becomes `{header}`) before the single `SET_OVERLAY_OPTIONS/RESPONSE` is sent
