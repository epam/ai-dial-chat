# Spec: chat-input-tools-menu

## Purpose

Define how deployment-provided tool toggles are shown in the conversation input, sent to completions, and persisted per user message for regenerate and edit flows.

## Requirements

### Requirement: Tools visibility

The system SHALL derive the available tools from the selected deployment's configuration schema alone. Every boolean-typed property (explicit `"type": "boolean"`, or no `type` with a boolean `default`) of `selectedDeploymentConfiguration.properties` is one tool, in schema order.

Tools SHALL always be surfaced as a row of chips rendered directly in the conversation input (`ToolsChips` in `libs/conversation-input`) — every tool, selected or not, in schema order. The chip body toggles the tool and `aria-pressed` reflects the state. When the host supplies both `stateOnLabel` and `stateOffLabel` (this app passes `tools.stateOn` / `tools.stateOff`), the chip appends that visible, `aria-hidden` state text after the label.

Whether a chip can additionally be taken off the input is governed by the `removable-tools` UI feature (`OverlayFeature.RemovableTools`), which is in `DEFAULT_ENABLED_UI_FEATURES`:

- **`removable-tools` enabled** — each chip additionally carries a × button that drops it from the row, turning the tool off if it was on. Dismissal is view state of the input: the chip returns when the tool is switched on again from the `+` menu, and every dismissal is forgotten when the deployment offers a different tool list. The `+` menu additionally renders a "Tools" item (desktop submenu / mobile bottom sheet).
- **`removable-tools` disabled** — every chip is a persistent toggle. No chip renders a ×, no dismissal state exists, and the `+` menu SHALL NOT render a "Tools" item, since there is nothing to bring back. Where tools are the only content that menu would hold — attachments, chat settings, and every overlay-menu entry (prompts and skills) all unavailable, as in a typical overlay embed — the `+` button SHALL NOT render at all.

When the schema is absent or contains no boolean property, neither the chip row nor the "Tools" menu item SHALL render, and the `+` menu SHALL behave as if the feature did not exist.

Beyond `removable-tools`, no operator configuration gates this: there is no env var and no client-config value that turns the tools themselves on or off.

#### Scenario: Schema exposes a boolean property — tools visible
- **WHEN** the deployment configuration schema contains `properties.deep_research` with `type: "boolean"`
- **THEN** the conversation input renders a "Deep research" toggle chip

#### Scenario: removable-tools enabled — chip is dismissible and the menu offers Tools
- **WHEN** `isEnabled('removable-tools')` is `true` AND the schema exposes `properties.deep_research`
- **THEN** the "Deep research" chip renders a × button AND the `+` menu renders a "Tools" item

#### Scenario: removable-tools disabled — chip is a persistent toggle
- **WHEN** `isEnabled('removable-tools')` is `false` AND the schema exposes `properties.deep_research`
- **THEN** the "Deep research" chip renders with no × button
- **AND** the `+` menu renders no "Tools" item

#### Scenario: removable-tools disabled and tools are the menu's only content — no `+` button
- **WHEN** `isEnabled('removable-tools')` is `false` AND attachments, chat settings, the prompts overlay, and the skills overlay are all unavailable
- **THEN** the input renders the tool chips and no `+` button

#### Scenario: Skills overlay alone keeps the `+` button rendered
- **WHEN** `isEnabled('removable-tools')` is `false` AND attachments and chat settings are unavailable AND the skills overlay is available
- **THEN** the `+` button renders, because the Skills overlay-menu entry is menu content

#### Scenario: Schema exposes several boolean properties — one chip each
- **WHEN** the schema contains `properties.deep_research` and `properties.web_search`, both boolean
- **THEN** the input renders one toggle chip per tool, in schema order

#### Scenario: Deployment has no configuration — tools hidden
- **WHEN** `selectedDeploymentConfiguration` is `null` (fetch failed or deployment has no configuration endpoint)
- **THEN** no chips and no "Tools" menu item render

#### Scenario: Schema has no boolean property — tools hidden
- **WHEN** the schema's `properties` contains only non-boolean entries (strings, numbers, `oneOf` starters)
- **THEN** no chips and no "Tools" menu item render
---

### Requirement: Tools submenu rendering (desktop)

On desktop viewports, the "Tools" menu item SHALL open a submenu panel (nested within the ui-kit 2.0 `Dropdown` rendered by `AddAttachmentButton`) displaying tool toggle rows.

Each tool row SHALL display:
- An icon (host-supplied, `IconTelescope` in this app) with `aria-hidden`
- The tool label (from schema property `title`, falling back to the humanized property key — `deep_research` becomes "Deep research")
- A trailing check mark when the tool is selected, hidden when unselected — rendered by the ui-kit menu from each row's `selectable: true`, `mark: MenuItemMark.Check`, and `checked: isSelected` fields, not by a host-supplied icon

The submenu panel SHALL use `aria-haspopup="menu"` on the trigger item and the panel SHALL have `role="menu"`.

#### Scenario: Desktop submenu opens on hover/focus
- **WHEN** the user hovers or focuses the "Tools" item in the desktop dropdown
- **THEN** a submenu panel appears to the side showing the Deep Research tool row

#### Scenario: Tool row displays label from schema title
- **WHEN** the deployment configuration property has `"title": "Deep research"`
- **THEN** the tool row label reads "Deep research"

#### Scenario: Tool row displays humanized key when title is absent
- **WHEN** the deployment configuration property `deep_research` has no `title`
- **THEN** the tool row label reads the humanized key ("Deep research"), with no i18n lookup involved

#### Scenario: Selected tool shows check icon
- **WHEN** the Deep Research tool is selected (toggled on)
- **THEN** the tool row displays the ui-kit trailing check mark

#### Scenario: Unselected tool hides check icon
- **WHEN** the Deep Research tool is unselected (toggled off)
- **THEN** the tool row does not display a trailing check icon

---

### Requirement: Tools bottom sheet rendering (mobile)

On mobile viewports, tapping the "Tools" item in the bottom sheet SHALL navigate to a stacked bottom sheet view displaying tool toggle rows (matching the Chat Settings bottom sheet navigation pattern).

#### Scenario: Mobile tools view opens
- **WHEN** the user taps "Tools" in the mobile `+` menu bottom sheet
- **THEN** a stacked bottom sheet view appears with tool toggle rows and a back navigation control

#### Scenario: Mobile back navigation returns to main menu
- **WHEN** the user taps the back control in the Tools bottom sheet
- **THEN** the view returns to the main `+` menu bottom sheet

---

### Requirement: Tool toggle interaction

Clicking/tapping a tool row SHALL toggle its `isSelected` state. The toggle is immediate (no network request).

#### Scenario: Toggle on
- **WHEN** the user clicks an unselected tool row
- **THEN** the tool becomes selected and displays a check icon

#### Scenario: Toggle off
- **WHEN** the user clicks a selected tool row
- **THEN** the tool becomes unselected and the check icon is removed

---

### Requirement: Tool selection initial state

Tool toggle state SHALL be initialized from the deployment configuration schema property's `default` value.

#### Scenario: Default is false — tool starts unselected
- **WHEN** the schema property has `"default": false`
- **THEN** the tool row starts in the unselected state

#### Scenario: Default is true — tool starts selected
- **WHEN** the schema property has `"default": true`
- **THEN** the tool row starts in the selected state

#### Scenario: No default — tool starts unselected
- **WHEN** the schema property has no `default` field
- **THEN** the tool row starts in the unselected state (treated as `false`)

---

### Requirement: Tool state reset on deployment change

When the selected deployment changes, all tool toggle states SHALL be reinitialized from the new deployment's configuration schema defaults. Previous user toggles are discarded.

#### Scenario: Switch deployment — state resets
- **WHEN** the user changes the selected deployment from deployment A (where Deep Research was toggled on) to deployment B
- **THEN** the tool toggle state is reinitialized from deployment B's schema defaults, regardless of what was toggled on deployment A

#### Scenario: Switch to deployment without tools — tools hide
- **WHEN** the user changes to a deployment whose schema contains no boolean property
- **THEN** the chip row and the Tools menu item are no longer rendered

---

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

---

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

---

### Requirement: Tool choices sent in completion request

When the user sends a message, the selected tool states SHALL be included in the message's `custom_content.configuration_value` as key-value pairs (e.g. `{ "deep_research": true }`).

`custom_content.configuration_value` SHALL contain only the active tool toggle states. A submitted starter's or form's own answer (the value tied to the `dial:widget: "buttons"` schema property the user picked) SHALL be sent solely through `custom_content.form_value` and SHALL NOT be merged into `configuration_value` — DIAL Core validates `configuration_value` against the deployment's entry configuration schema, and echoing a mid-conversation form answer through that field fails validation against that schema.

#### Scenario: Tool selected — value sent as true
- **WHEN** the user sends a message with the Deep Research tool toggled on
- **THEN** the completion request's `custom_content.configuration_value` includes `{ "deep_research": true }`

#### Scenario: Tool unselected — value sent as false
- **WHEN** the user sends a message with the Deep Research tool toggled off
- **THEN** the completion request's `custom_content.configuration_value` includes `{ "deep_research": false }`

#### Scenario: Starter configuration is not merged into tool configuration
- **WHEN** a submitted starter has its own `form_value: { "button": 4 }` AND the Deep Research tool is toggled on
- **THEN** the completion request's `custom_content.configuration_value` is `{ "deep_research": true }` only
- **AND** `custom_content.form_value` is `{ "button": 4 }`

#### Scenario: Starter submitted with no active tool config sends no configuration_value
- **WHEN** a submitted starter has its own `form_value: { "button": 4 }` AND no tool is toggled on
- **THEN** the completion request's `custom_content` has no `configuration_value` field

#### Scenario: DIAL Core receives configuration in custom_fields
- **WHEN** the backend processes a message with `custom_content.configuration_value: { "deep_research": true }`
- **THEN** the DIAL Core completion request body contains `custom_fields: { configuration: { "deep_research": true } }`

#### Scenario: Tool configuration preserves message content
- **WHEN** the backend processes a non-empty user message with `custom_content.configuration_value`
- **THEN** the DIAL Core completion request contains the original non-empty `messages[].content`
- **AND** the configuration is additionally sent through `custom_fields.configuration`

### Requirement: Tool choices persisted in conversation history

Whenever a completion mode creates or replaces a user message, the backend SHALL persist the supplied `custom_content.configuration_value` on that user message alongside attachments and form values. The frontend SHALL store the same custom content on its optimistic user message before streaming begins. Regenerate SHALL reuse the configuration stored on the user message preceding the regenerated assistant response. Edit SHALL preserve the edited message's existing configuration and form values while applying attachment changes.

#### Scenario: Appended message retains tool state
- **WHEN** the backend appends a user message with `custom_content.configuration_value: { "deep_research": true }`
- **THEN** the persisted conversation user message contains the same `configuration_value`

#### Scenario: Optimistic message matches completion request
- **WHEN** the frontend sends a regular message or submitted starter with tool configuration
- **THEN** the optimistic user message and the completion request contain the same `custom_content`

#### Scenario: Regenerate uses message-specific tool state
- **WHEN** a conversation contains multiple user messages with different tool states AND the user regenerates an assistant response
- **THEN** the completion uses the `configuration_value` stored on the user message immediately preceding that response
- **AND** it does not fall back to a different earlier message while the target message has configuration

#### Scenario: Edit preserves message custom content
- **WHEN** the user edits a message that has `configuration_value` or `form_value`
- **THEN** the replacement user message retains those values while its text and attachments are updated

---

### Requirement: Library isolation for tools menu

The `libs/conversation-input` library SHALL render the tools submenu entirely from props:
- `toolsMenuItems: ToolMenuItem[]` — resolved tool items with `id`, `label`, `icon: ReactNode`, `isSelected: boolean`.
- `onToolToggle: (toolId: string) => void` — callback to toggle a tool.
- `canRemoveTools?: boolean` — whether chips are dismissible, defaulting to `true`.

The library SHALL NOT read the `removable-tools` UI feature itself, nor import or reference: deployment configuration schemas, app config, env vars, server-api modules, generated API clients, or any app-level context/provider. Resolving `OverlayFeature.RemovableTools` into the `canRemoveTools` boolean is the app's job, done at the same `useUiFeature` call sites that already gate `chat-settings` and `input-files`.

#### Scenario: Empty tools array — no menu item rendered
- **WHEN** `toolsMenuItems` is an empty array or undefined
- **THEN** the "Tools" menu item is not rendered in the `+` menu

#### Scenario: Non-empty tools array — menu item rendered
- **WHEN** `toolsMenuItems` contains at least one item
- **THEN** the "Tools" menu item is rendered in the `+` menu

---

### Requirement: RTL support for tools menu

The tools submenu SHALL use logical Tailwind CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) for all directional spacing and positioning.

Submenu chevron icons indicating the submenu direction SHALL be mirrored in RTL using `rtl:scale-x-[-1]`.

#### Scenario: RTL layout — submenu opens from start edge
- **WHEN** the document direction is RTL
- **THEN** the desktop submenu panel appears to the inline-start side of the trigger item and chevron icons are mirrored

---

### Requirement: Accessibility for tools menu

The tools menu SHALL support full keyboard navigation:
- Arrow keys navigate between tool rows in the submenu.
- Enter/Space toggles the focused tool row.
- Escape closes the submenu and returns focus to the "Tools" trigger.

The "Tools" trigger SHALL have `aria-haspopup="menu"` and `aria-expanded` reflecting submenu visibility.

Decorative icons (`IconTool`, `IconTelescope`, and the ui-kit check mark) SHALL have `aria-hidden="true"`.

Tool labels SHALL be the accessible name for each row (no separate `aria-label` needed since the label text is visible).

#### Scenario: Keyboard toggle
- **WHEN** the user focuses a tool row and presses Enter or Space
- **THEN** the tool's selected state toggles

#### Scenario: Escape closes submenu
- **WHEN** the user presses Escape while the tools submenu is open
- **THEN** the submenu closes and focus returns to the "Tools" trigger item

---

### Requirement: i18n keys for tools menu

The following i18n keys SHALL be added to `apps/chat/src/i18n/locales/en.json`:

| Key | Default value | Usage |
|-----|---------------|-------|
| `tools.menuTitle` | `"Tools"` | Top-level menu item label |
| `tools.removeTool` | `"Remove {{label}}"` | Accessible label of a chip's × button |
| `tools.stateOn` | `"On"` | Visible chip state text while the tool is on (`stateOnLabel`) |
| `tools.stateOff` | `"Off"` | Visible chip state text while the tool is off (`stateOffLabel`) |

#### Scenario: Labels use i18n values
- **WHEN** the Tools menu renders in a locale that has translated `tools.menuTitle`
- **THEN** the menu item displays the translated label

---

### Requirement: Memoization

The `useToolsMenu` hook SHALL memoize:
- The derived `ToolMenuItem[]` array with `useMemo` (dependencies: derived tool definitions, selection state, icon).
- The `onToolToggle` callback with `useCallback`.
- The `toolConfigurationValue` record with `useMemo`.

This prevents unnecessary re-renders of `AddAttachmentButton` and its children on every parent render.

#### Scenario: Stable reference when inputs unchanged
- **WHEN** the parent component re-renders but tool state and deployment configuration have not changed
- **THEN** the `toolsMenuItems` array reference remains the same object

---

### Requirement: Feature gating decision

Whether tools exist at all SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, and SHALL NOT be gated by any operator config value. Their visibility is controlled solely by the deployment schema containing at least one boolean property (capability = supported).

Only their *removability* is gated, by the `removable-tools` UI feature. Turning it off never hides a tool — it removes the add/remove affordances around one.

No role-based restriction applies.

#### Scenario: Tool visibility checks the schema alone
- **WHEN** the app evaluates whether to show tools
- **THEN** it checks only the deployment configuration schema — not `features.*` flags and not any client-config value

#### Scenario: removable-tools never hides a tool
- **WHEN** `isEnabled('removable-tools')` is `false` and the schema exposes two boolean properties
- **THEN** both tool chips still render, and both still toggle

---

### Requirement: No new observability/telemetry

The system SHALL NOT introduce new analytics events, metrics, or telemetry for tool toggles or tool-inclusive completion requests. Existing request metrics continue to apply.

#### Scenario: No new events emitted
- **WHEN** the user toggles a tool or sends a message with tool configuration
- **THEN** no additional analytics events are dispatched beyond existing completion-request metrics

---

### Requirement: No new caching or rate limiting

The feature SHALL NOT introduce new backend endpoints. The existing deployment-configuration endpoint caching (60s TTL, key `deployments:configuration:<userSub>:<deploymentName>`) applies unchanged.

#### Scenario: Config cache behavior unchanged
- **WHEN** the frontend selects a deployment
- **THEN** its configuration schema is served from the existing 60s deployment-configuration cache
