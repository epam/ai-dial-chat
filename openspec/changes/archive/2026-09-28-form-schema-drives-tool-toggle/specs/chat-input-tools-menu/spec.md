## ADDED Requirements

### Requirement: Tool selection driven by an assistant message's form_schema

A DIAL application SHALL be able to set a tool's toggle state from an assistant message's `custom_content.form_schema`. A `form_schema` property drives a tool when its key equals a tool id (a boolean property of the selected deployment's configuration schema, see "Tools visibility") and it carries a boolean value, resolved as:

1. the property's `default`, when it is a boolean; otherwise
2. the `const` of the property's `oneOf`, when `oneOf` has exactly one entry and that `const` is a boolean.

Any other shape (non-boolean value, several `oneOf` entries, missing value) SHALL be ignored for that property. Keys that do not match a current tool id SHALL be ignored.

While the conversation view shows a conversation, each time the value resolved from the **last** message's `form_schema` (when that message is an assistant message, including one still streaming) changes, the toggle SHALL be set to that value exactly once. Re-renders, repeated identical chunks, or reloads of the same conversation id in the same component instance SHALL NOT re-apply an already-applied value, so a toggle change the user makes afterwards is preserved until the app sends a different value.

Such properties SHALL NOT render any per-message button or widget; the `starter` / `button` rendering of `form_schema` is unchanged, and a `form_schema` MAY carry both a `button` property and a tool property.

State ownership: the toggle state remains owned by the `useToolsMenu` instance of the conversation-view page; the page applies values through the existing `restoreToolConfiguration`. The value-resolution logic SHALL be a pure function in `libs/chat-hooks` taking the `form_schema` (and messages) as parameters — the lib SHALL NOT read deployment state, app contexts, or streaming internals.

The applied value SHALL be what the next user message sends in `custom_content.configuration_value` (see "Tool choices sent in completion request"); no new request field, endpoint, or backend change is introduced. Not gated by `ENABLED_FEATURES`; no new i18n strings, no RTL impact (no new UI), no new telemetry, no new cache.

#### Scenario: App turns the tool on during a run
- **WHEN** the streaming assistant message receives `form_schema.properties.deep_research = { "type": "boolean", "default": true }` AND the Deep research chip is off
- **THEN** the Deep research chip becomes selected

#### Scenario: App turns the tool off when the report is delivered
- **WHEN** a later chunk of the same assistant message replaces `form_schema` with `properties.deep_research.default = false`
- **THEN** the Deep research chip becomes unselected
- **AND** the next message the user sends includes `configuration_value: { "deep_research": false }`

#### Scenario: Single-option oneOf const is used when default is absent
- **WHEN** the last assistant message's `form_schema.properties.deep_research` is `{ "oneOf": [{ "const": false, "title": "Off" }] }` with no `default`
- **THEN** the Deep research chip becomes unselected

#### Scenario: Ambiguous or non-boolean value is ignored
- **WHEN** `form_schema.properties.deep_research` has `oneOf` with two entries and no `default`, or a non-boolean `default`
- **THEN** the Deep research chip state is unchanged

#### Scenario: Unknown key is ignored
- **WHEN** `form_schema.properties.web_search.default = true` AND the selected deployment's configuration schema has no `web_search` boolean property
- **THEN** no tool state changes

#### Scenario: User re-arms the tool after the app turned it off
- **WHEN** the app turned Deep research off via `form_schema` AND the user toggles the chip on AND the page re-renders or reloads the same conversation id without navigating away
- **THEN** the chip stays selected
- **AND** the next message sends `configuration_value: { "deep_research": true }`

#### Scenario: No buttons render for a tool property
- **WHEN** an assistant message's `form_schema` contains only `properties.deep_research`
- **THEN** no starter buttons render under that message

#### Scenario: Older assistant messages do not drive the toggle
- **WHEN** an assistant message with `form_schema.properties.deep_research.default = true` is followed by a newer user message
- **THEN** that older `form_schema` does not change the toggle

## MODIFIED Requirements

### Requirement: Tool selection restored when a conversation (re)mounts

The tools menu state is owned by a `useToolsMenu` hook instance scoped to the page component it is called from. Creating a conversation from the new-chat screen navigates from that screen's component to a separate conversation-view component, mounting a new `useToolsMenu` instance whose local toggle state starts uninitialized from conversation history. To prevent the just-sent toggle from silently reverting to the schema default on that navigation, the conversation-view component SHALL restore the toggle the first time a given conversation id is loaded in that component instance — whether freshly created, opened from the sidebar, switched to from another conversation, or reloaded. The restored value SHALL be the `configuration_value` stored on the conversation's last user message (the same value it stores per user message, see "Tool choices persisted in conversation history"), overlaid, in message order, by the values resolved from the `custom_content.form_schema` of every assistant message after that user message (see "Tool selection driven by an assistant message's form_schema"). This restore SHALL NOT be treated as a deployment-driven reset and SHALL NOT be persisted as a new user choice.

The restore SHALL run at most once per conversation id per component mount, and SHALL mark the restored `form_schema` values as already applied so the live form_schema sync does not re-apply them. While that conversation's generation is still in flight, the last user message's `configuration_value` reflects only the turn already sent and does not change until the user sends a new message; re-running the restore on every reload of that same in-flight turn would silently overwrite a toggle change the user made locally after sending it. A conversation id already restored in this component instance SHALL NOT be restored again unless the user navigates away to a different conversation and back.

#### Scenario: First message toggle survives the new-chat-to-conversation navigation
- **WHEN** the user toggles Deep Research on and sends the first message from the new-chat screen
- **THEN** the created conversation's user message is persisted with `configuration_value: { "deep_research": true }`
- **AND** the conversation view that the app navigates to shows the Tools toggle as selected
- **AND** the next message the user sends also includes `configuration_value: { "deep_research": true }`

#### Scenario: Opening an existing conversation restores its last toggle state
- **WHEN** the user opens a conversation whose last user message has `configuration_value: { "deep_research": true }` and no later assistant message carries a `deep_research` value in its `form_schema`
- **THEN** the Tools toggle displays as selected for that conversation

#### Scenario: Assistant form_schema after the last user message wins on load
- **WHEN** the user opens a conversation whose last user message has `configuration_value: { "deep_research": true }` AND the following assistant message has `form_schema.properties.deep_research.default = false`
- **THEN** the Tools toggle displays as unselected

#### Scenario: No configuration on the last user message — falls back to schema default
- **WHEN** the conversation's last user message has no `configuration_value` (or no value for that tool id) and no later assistant `form_schema` carries a value for it
- **THEN** the Tools toggle state is left at the deployment configuration schema's `default` value

#### Scenario: In-flight generation does not re-clobber a local toggle change
- **WHEN** a conversation's generation is still in flight for its last user message (`configuration_value: { "deep_research": true }`) AND the user locally toggles Deep Research off while waiting AND the component reloads that same conversation id again without the user navigating away
- **THEN** the Tools toggle stays off — the restore does not re-run for a conversation id already restored in this component instance

#### Scenario: Navigating away and back to an in-flight conversation re-derives from its persisted state
- **WHEN** the user navigates from a conversation with an in-flight generation to a different conversation and back
- **THEN** the Tools toggle for the original conversation is re-restored from its last user message's `configuration_value` and any later assistant `form_schema` values, since it is a fresh load for that conversation id in this component instance
