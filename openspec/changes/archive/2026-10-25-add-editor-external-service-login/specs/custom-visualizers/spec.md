## MODIFIED Requirements

### Requirement: postMessage protocol constants

The protocol constants SHALL live in the workspace package `@epam/ai-dial-visualizer-connector` (`libs/visualizer-connector`). That package exports four string enums with PascalCase members:

- `VisualizerConnectorRequests`: `SendVisualizeData`, `SendGroupedVisualizeData`, `SetVisualizerOptions`;
- `VisualizerConnectorEvents`: `InitReady`, `Ready`, `ReadyToInteract`, `SendMessage`, `CreatedConversationSuccess`, `UpdatedConversationSuccess`, `UpdatedApplicationSuccess`;
- `AppsEditorEvents`: `ReadyToInteract`, `ReadyToSave`, `LoggedOut`, `UpdatedApplicationSuccess` — the events an application-editor iframe posts to the application editor, with the camelCase wire values `readyToInteract`, `readyToSave`, `loggedOut`, `updatedApplicationSuccess` that `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts` matches on;
- `AppsEditorMessages`: `TriggerSave`, `SaveSuccess`, `SaveError`, `ValidityState`, `DirtyState`, `RequestToolsetLogin`, `ToolsetLoginResult`, `RequestToolsetLogout`, `ToolsetLogoutResult`, `RequestApplicationCredentials`, `RequestExternalServiceLogin`, `ExternalServiceLoginResult` — the application editor's unprefixed save and auth messages, with the wire values `TRIGGER_SAVE`, `SAVE_SUCCESS`, `SAVE_ERROR`, `VALIDITY_STATE`, `DIRTY_STATE`, `REQUEST_TOOLSET_LOGIN`, `TOOLSET_LOGIN_RESULT`, `REQUEST_TOOLSET_LOGOUT`, `TOOLSET_LOGOUT_RESULT`, `REQUEST_APPLICATION_CREDENTIALS`, `REQUEST_EXTERNAL_SERVICE_LOGIN`, `EXTERNAL_SERVICE_LOGIN_RESULT`.

The wire string values SHALL be the ones visualizers already built on `@epam/ai-dial-chat-visualizer-connector` expect, unchanged: `SEND_VISUALIZE_DATA`, `SEND_GROUPED_VISUALIZE_DATA`, `SET_VISUALIZER_OPTIONS`, `INIT_READY`, `READY`, `READY_TO_INTERACT`, `SEND_MESSAGE`, `CREATED_CONVERSATION_SUCCESS`, `UPDATED_CONVERSATION_SUCCESS`, `UPDATED_APPLICATION_SUCCESS`.

The **runtime** host path (`VisualizerCanvasRenderer`) SHALL import both enums from `@epam/ai-dial-visualizer-connector`, and the workspace SHALL NOT depend on `@epam/ai-dial-shared`. This monorepo SHALL NOT duplicate those protocol enums in `libs/chat-shared`. Host config and canvas payload types stay in `libs/chat-shared/src/models/custom-visualizer.ts`, separate from the connector's wire surface.

#### Scenario: runtime send uses the workspace enum

- **WHEN** `VisualizerCanvasRenderer` delivers visualize data
- **THEN** it calls `connector.send(VisualizerConnectorRequests.SendVisualizeData, …)` where `VisualizerConnectorRequests` is imported from `@epam/ai-dial-visualizer-connector`
- **AND** the posted message type is still `${visualizerName}/SEND_VISUALIZE_DATA`

#### Scenario: wire values are unchanged

- **WHEN** each member of `VisualizerConnectorRequests` and `VisualizerConnectorEvents` is read
- **THEN** its value equals the upper-snake-case wire string listed above

#### Scenario: application-editor wire values match the editor host

- **WHEN** each member of `AppsEditorEvents` is read
- **THEN** its value equals the camelCase wire string listed above
- **AND** it equals the value of the same-named member of `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`

#### Scenario: unprefixed application-editor wire values match the editor host

- **WHEN** each member of `AppsEditorMessages` is read
- **THEN** its value equals the upper-snake-case wire string listed above
- **AND** it equals the value of the same-named member of `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`

### Requirement: Typed application-editor host and client

The existing workspace package `@epam/ai-dial-visualizer-connector` SHALL export `AppsEditorHost`, `AppsEditorClient`, and direction-specific discriminated message types. These adapters SHALL preserve the deployed editor wire protocol: lifecycle events use `${applicationName}/${AppsEditorEvents}` and save, validity, dirty-state, and auth messages use the unprefixed `AppsEditorMessages` values. Uppercase `VisualizerConnectorEvents` remain a separate visualizer protocol and SHALL NOT grant editor readiness.

`AppsEditorHost<TGeneral = unknown, TCredentials = unknown>` SHALL receive a caller-supplied target window, target origin, application namespace, and message callback; its outgoing General metadata and credential payload types SHALL remain generic. `AppsEditorClient` SHALL receive a host origin and application namespace, an optional host window defaulting to `window.parent`, and an optional message callback. The client SHALL offer typed send helpers for lifecycle, save results, validity, dirtiness, toolset login/logout requests, application-credentials requests, and external-service login requests (`requestExternalServiceLogin(appId, serviceId, { offlineUsageConsent })`). Neither adapter SHALL create an iframe or perform authentication, routing, API requests, or state persistence.

Both adapters SHALL check the sender window and exact normalized origin before delivering a message. The shared parser SHALL reject malformed envelopes and messages belonging to the other direction. `REQUEST_EXTERNAL_SERVICE_LOGIN` SHALL carry nonempty `appId` and `serviceId` and a boolean `offlineUsageConsent`; `EXTERNAL_SERVICE_LOGIN_RESULT` SHALL carry nonempty `appId` and `serviceId`, a boolean `success` and an optional string `reason` whose vocabulary the host owns. Neither carries credential material or OAuth configuration. Lifecycle callback types SHALL be normalized to the unprefixed `AppsEditorEvents` discriminant. General metadata, updated application data, and credentials SHALL remain opaque on receipt for the consuming application to validate.

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

#### Scenario: External-service login request and result keep their shapes

- **WHEN** a client calls `requestExternalServiceLogin('applications/public/runner app', 'gitlab-oauth', { offlineUsageConsent: true })`
- **THEN** it posts `{ type: 'REQUEST_EXTERNAL_SERVICE_LOGIN', appId: 'applications/public/runner app', serviceId: 'gitlab-oauth', offlineUsageConsent: true }`
- **AND** the host parser rejects the same message without `offlineUsageConsent` or with an empty `serviceId`
- **AND** the client parser accepts `EXTERNAL_SERVICE_LOGIN_RESULT` with `success: false, reason: 'cancelled'` and rejects it without a boolean `success`
