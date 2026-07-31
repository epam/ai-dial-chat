## ADDED Requirements

### Requirement: Tools menu item visibility

The system SHALL render a "Tools" item in the conversation input `+` menu only when all of the following conditions are met:
1. The client config `deepResearchToolId` is a non-empty string (env var `DEEP_RESEARCH_TOOL_ID` is set).
2. The selected deployment's configuration schema (`selectedDeploymentConfiguration`) is loaded.
3. The schema's `properties` object contains a key matching `deepResearchToolId` that has a boolean-typed value (either explicit `"type": "boolean"` or a boolean `default`).

When any condition is not met, the "Tools" item SHALL NOT render and the `+` menu SHALL behave identically to its current state.

#### Scenario: All conditions met — Tools item visible
- **WHEN** `DEEP_RESEARCH_TOOL_ID=deep_research` is set AND the deployment configuration schema contains `properties.deep_research` with `type: "boolean"`
- **THEN** the `+` menu renders a "Tools" item with `IconTool` icon between existing items and Chat Settings

#### Scenario: Env var unset — Tools item hidden
- **WHEN** `DEEP_RESEARCH_TOOL_ID` is not set (client config `deepResearchToolId` is `null`)
- **THEN** the `+` menu does not render a "Tools" item

#### Scenario: Deployment has no configuration — Tools item hidden
- **WHEN** `selectedDeploymentConfiguration` is `null` (fetch failed or deployment has no configuration endpoint)
- **THEN** the `+` menu does not render a "Tools" item

#### Scenario: Schema does not contain the configured tool id — Tools item hidden
- **WHEN** the deployment configuration schema's `properties` does not contain a key matching `deepResearchToolId`
- **THEN** the `+` menu does not render a "Tools" item

#### Scenario: Schema property is not boolean — Tools item hidden
- **WHEN** the deployment configuration schema property matching `deepResearchToolId` does not have `type: "boolean"` and does not have a boolean `default` value
- **THEN** the `+` menu does not render a "Tools" item

---

### Requirement: Tools submenu rendering (desktop)

On desktop viewports, the "Tools" menu item SHALL open a submenu panel (nested within the `DialDropdown`) displaying tool toggle rows.

Each tool row SHALL display:
- An icon (`IconTelescope` for the Deep Research tool) with `aria-hidden`
- The tool label (from schema property `title`, falling back to i18n key `tools.deepResearchFallback`)
- A trailing check icon (`IconCheck`) when the tool is selected, hidden when unselected

The submenu panel SHALL use `aria-haspopup="menu"` on the trigger item and the panel SHALL have `role="menu"`.

#### Scenario: Desktop submenu opens on hover/focus
- **WHEN** the user hovers or focuses the "Tools" item in the desktop dropdown
- **THEN** a submenu panel appears to the side showing the Deep Research tool row

#### Scenario: Tool row displays label from schema title
- **WHEN** the deployment configuration property has `"title": "Deep research"`
- **THEN** the tool row label reads "Deep research"

#### Scenario: Tool row displays fallback label when title is absent
- **WHEN** the deployment configuration property has no `title` field
- **THEN** the tool row label reads the i18n fallback value ("Deep research")

#### Scenario: Selected tool shows check icon
- **WHEN** the Deep Research tool is selected (toggled on)
- **THEN** the tool row displays a trailing `IconCheck`

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

#### Scenario: Switch to deployment without tools — menu hides
- **WHEN** the user changes to a deployment whose schema does not contain the configured tool id
- **THEN** the Tools menu item is no longer rendered

---

### Requirement: Tool choices sent in completion request

When the user sends a message, the selected tool states SHALL be included in the message's `custom_content.configuration_value` as key-value pairs (e.g. `{ "deep_research": true }`).

The tool configuration values SHALL be merged with any existing `configuration_value` from starters or forms. Tool values take precedence (spread after other values).

#### Scenario: Tool selected — value sent as true
- **WHEN** the user sends a message with the Deep Research tool toggled on
- **THEN** the completion request's `custom_content.configuration_value` includes `{ "deep_research": true }`

#### Scenario: Tool unselected — value sent as false
- **WHEN** the user sends a message with the Deep Research tool toggled off
- **THEN** the completion request's `custom_content.configuration_value` includes `{ "deep_research": false }`

#### Scenario: Tool value merged with starter configuration
- **WHEN** a starter has set `configuration_value: { "starter_key": "value" }` AND the Deep Research tool is toggled on
- **THEN** the final `custom_content.configuration_value` is `{ "starter_key": "value", "deep_research": true }`

#### Scenario: DIAL Core receives configuration in custom_fields
- **WHEN** the backend processes a message with `custom_content.configuration_value: { "deep_research": true }`
- **THEN** the DIAL Core completion request body contains `custom_fields: { configuration: { "deep_research": true } }`

### Requirement: Tool choices persisted in conversation history

Whenever a completion mode creates or replaces a user message, the backend SHALL persist the supplied `custom_content.configuration_value` on that user message alongside attachments and form values. Regenerate SHALL reuse the configuration stored on the user message preceding the regenerated assistant response. Edit SHALL preserve the edited message's existing configuration and form values while applying attachment changes.

#### Scenario: Appended message retains tool state
- **WHEN** the backend appends a user message with `custom_content.configuration_value: { "deep_research": true }`
- **THEN** the persisted conversation user message contains the same `configuration_value`

#### Scenario: Regenerate uses message-specific tool state
- **WHEN** a conversation contains multiple user messages with different tool states AND the user regenerates an assistant response
- **THEN** the completion uses the `configuration_value` stored on the user message immediately preceding that response
- **AND** it does not fall back to a different earlier message while the target message has configuration

#### Scenario: Edit preserves message custom content
- **WHEN** the user edits a message that has `configuration_value` or `form_value`
- **THEN** the replacement user message retains those values while its text and attachments are updated

---

### Requirement: App-config pipeline for DEEP_RESEARCH_TOOL_ID

The backend SHALL expose `DEEP_RESEARCH_TOOL_ID` as a client-visible config value named `deepResearchToolId` through the existing `GET /api/v1/client-config` endpoint.

The env var is optional. When unset, `deepResearchToolId` SHALL be `null` in the response.

#### Scenario: Env var set — value in client config
- **WHEN** `DEEP_RESEARCH_TOOL_ID=deep_research` is configured
- **THEN** `GET /api/v1/client-config` returns `config.deepResearchToolId: "deep_research"`

#### Scenario: Env var unset — null in client config
- **WHEN** `DEEP_RESEARCH_TOOL_ID` is not set
- **THEN** `GET /api/v1/client-config` returns `config.deepResearchToolId: null`

---

### Requirement: Library isolation for tools menu

The `libs/conversation-input` library SHALL render the tools submenu entirely from props:
- `toolsMenuItems: ToolMenuItem[]` — resolved tool items with `id`, `label`, `icon: ReactNode`, `isSelected: boolean`.
- `onToolToggle: (toolId: string) => void` — callback to toggle a tool.

The library SHALL NOT import or reference: deployment configuration schemas, app config, env vars, server-api modules, generated API clients, or any app-level context/provider.

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

Decorative icons (`IconTool`, `IconTelescope`, `IconCheck`) SHALL have `aria-hidden="true"`.

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
| `tools.deepResearchFallback` | `"Deep research"` | Fallback label when schema property has no `title` |

#### Scenario: Labels use i18n values
- **WHEN** the Tools menu renders in a locale that has translated `tools.menuTitle`
- **THEN** the menu item displays the translated label

---

### Requirement: Memoization

The `useToolsMenu` hook SHALL memoize:
- The derived `ToolMenuItem[]` array with `useMemo` (dependencies: tool id, schema property, selection state).
- The `onToolToggle` callback with `useCallback`.
- The `toolConfigurationValue` record with `useMemo`.

This prevents unnecessary re-renders of `AddAttachmentButton` and its children on every parent render.

#### Scenario: Stable reference when inputs unchanged
- **WHEN** the parent component re-renders but tool state and deployment configuration have not changed
- **THEN** the `toolsMenuItems` array reference remains the same object

---

### Requirement: Feature gating decision

This feature is NOT gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. Visibility is controlled by:
1. Operator setting `DEEP_RESEARCH_TOOL_ID` env var (presence = enabled).
2. Deployment schema containing a matching boolean property (capability = supported).

No role-based restriction applies in this slice.

#### Scenario: No feature flag check
- **WHEN** the app evaluates whether to show the Tools menu
- **THEN** it checks only `config.deepResearchToolId` and deployment schema — not `features.*` flags

---

### Requirement: No new observability/telemetry

This slice introduces no new analytics events, metrics, or telemetry for tool toggles or tool-inclusive completion requests. Existing request metrics continue to apply.

#### Scenario: No new events emitted
- **WHEN** the user toggles a tool or sends a message with tool configuration
- **THEN** no additional analytics events are dispatched beyond existing completion-request metrics

---

### Requirement: No new caching or rate limiting

No new backend endpoints are introduced. The existing deployment-configuration endpoint caching (60s TTL, key `deployments:configuration:<userSub>:<deploymentName>`) and app-config caching (60s TTL) apply unchanged.

#### Scenario: Config cache behavior unchanged
- **WHEN** the frontend requests client config
- **THEN** `deepResearchToolId` is served from the existing 60s app-config cache
