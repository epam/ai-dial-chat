## ADDED Requirements

### Requirement: Typed application-editor host and client

The existing workspace package `@epam/ai-dial-visualizer-connector` SHALL export `AppsEditorHost`, `AppsEditorClient`, and direction-specific discriminated message types. These adapters SHALL preserve the deployed editor wire protocol: lifecycle events use `${applicationName}/${AppsEditorEvents}` and save, validity, dirty-state, and auth messages use the unprefixed `AppsEditorMessages` values. Uppercase `VisualizerConnectorEvents` remain a separate visualizer protocol and SHALL NOT grant editor readiness.

`AppsEditorHost<TGeneral = unknown, TCredentials = unknown>` SHALL receive a caller-supplied target window, target origin, application namespace, and message callback; its outgoing General metadata and credential payload types SHALL remain generic. `AppsEditorClient` SHALL receive a host origin and application namespace, an optional host window defaulting to `window.parent`, and an optional message callback. The client SHALL offer typed send helpers for lifecycle, save results, validity, dirtiness, toolset login/logout requests, and application-credentials requests. Neither adapter SHALL create an iframe or perform authentication, routing, API requests, or state persistence.

Both adapters SHALL check the sender window and exact normalized origin before delivering a message. The shared parser SHALL reject malformed envelopes and messages belonging to the other direction. Lifecycle callback types SHALL be normalized to the unprefixed `AppsEditorEvents` discriminant. General metadata, updated application data, and credentials SHALL remain opaque on receipt for the consuming application to validate.

The receive boundary SHALL retain these legacy forms: `SAVE_ERROR` with a top-level `error` or nested `payload.error`; `DIRTY_STATE` with nested `payload.isDirty` or top-level `isDirty`; `SAVE_SUCCESS` with `hasChanges` omitted or not boolean, normalized to `false` unless exactly `true`. Preview's `TRIGGER_SAVE` SHALL be valid without `general`.

The host's optional `onActivity` callback SHALL report messages from the expected window and origin independently of recognized editor messages. Activity SHALL NOT imply UI readiness or save readiness. `destroy()` SHALL remove listeners and suppress subsequent sends, and repeated destruction SHALL be harmless. The existing visualizer classes SHALL keep their behavior; the loose editor API on `ChatVisualizerConnector` SHALL be deprecated in favor of `AppsEditorClient` without changing its wire messages.

`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` SHALL use the shared host adapter and retain ownership of React lifecycle state, schema/URL resolution, feature policy, authentication actions, credentials retrieval, domain payload validation, and translated UI. No new feature flag, cache, telemetry, translated string, or visual surface is introduced; RTL and keyboard behavior are unchanged.

#### Scenario: Typed editor messages retain the deployed wire format

- **WHEN** a client named `QuickApp` reports readiness and then a successful save with changes
- **THEN** it posts `QuickApp/readyToSave` and `{ type: 'SAVE_SUCCESS', hasChanges: true }`
- **AND** the host callback receives the readiness discriminant `AppsEditorEvents.ReadyToSave` and a typed save-success message

#### Scenario: Foreign windows and origins cannot drive editor state

- **WHEN** a message has the correct editor namespace but the wrong sender window or origin
- **THEN** neither the message callback nor the activity callback runs

#### Scenario: Direction and envelope validation precede callbacks

- **WHEN** the host receives a host-to-editor `TRIGGER_SAVE` or a `VALIDITY_STATE` without a boolean `payload.isValid`
- **THEN** the host does not deliver it to its message callback

#### Scenario: Legacy editor field placements normalize at the boundary

- **WHEN** an authorized editor posts a nested save error, a top-level dirty state, or a save success without `hasChanges`
- **THEN** the host receives the normalized error string, boolean dirty state, or `hasChanges: false`, respectively

#### Scenario: Visualizer readiness remains separate

- **WHEN** the editor posts `QuickApp/READY` or `QuickApp/READY_TO_INTERACT`
- **THEN** the host may report activity but does not deliver an editor readiness message
- **AND** Save and Preview remain gated until an explicit editor `readyToSave` arrives

#### Scenario: Destroyed adapters stop communication

- **WHEN** either adapter is destroyed and then receives or sends another message
- **THEN** no callback runs and no message is posted
- **AND** destroying it again has no effect
