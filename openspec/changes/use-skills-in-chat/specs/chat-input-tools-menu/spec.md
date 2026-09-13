# Spec Delta: chat-input-tools-menu

## MODIFIED Requirements

### Requirement: Tools visibility

The system SHALL derive the available tools from the selected deployment's configuration schema alone. Every boolean-typed property (explicit `"type": "boolean"`, or no `type` with a boolean `default`) of `selectedDeploymentConfiguration.properties` is one tool, in schema order.

Tools SHALL always be surfaced as a row of chips rendered directly in the conversation input — every tool, selected or not, in schema order. The chip body toggles the tool and `aria-pressed` reflects the state.

Whether a chip can additionally be taken off the input is governed by the `removable-tools` UI feature (`OverlayFeature.RemovableTools`), which is in `DEFAULT_ENABLED_UI_FEATURES`:

- **`removable-tools` enabled** — each chip additionally carries a × button that drops it from the row, turning the tool off if it was on. Dismissal is view state of the input: the chip returns when the tool is switched on again from the `+` menu, and every dismissal is forgotten when the deployment offers a different tool list. The `+` menu additionally renders a "Tools" item (desktop submenu / mobile bottom sheet).
- **`removable-tools` disabled** — every chip is a persistent toggle. No chip renders a ×, no dismissal state exists, and the `+` menu SHALL NOT render a "Tools" item, since there is nothing to bring back. Where tools are the only content that menu would hold — attachments, chat settings, and every overlay-menu entry (prompts, and skills when the `skillUsageEnabled` flag is on) all unavailable, as in a typical overlay embed — the `+` button SHALL NOT render at all.

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
- **WHEN** `isEnabled('removable-tools')` is `false` AND attachments, chat settings, the prompts overlay, and the skills overlay (when `skillUsageEnabled` is enabled) are all unavailable
- **THEN** the input renders the tool chips and no `+` button

#### Scenario: Skills overlay alone keeps the `+` button rendered
- **WHEN** `isEnabled('removable-tools')` is `false` AND attachments and chat settings are unavailable AND `skillUsageEnabled` is enabled
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
