## MODIFIED Requirements

### Requirement: Stage type includes optional content field

**Revised** (drops the `mcp_app` field previously proposed here — see `design.md` D5, third revision: DIAL Core does not attach a UI resource reference to individual stages, so no such field is populated or read anywhere in the codebase; MCP Apps tool discovery and message correlation are handled entirely by the `mcp-app-trigger` capability, independent of `Stage`).

The `Stage` interface in `libs/chat-shared` SHALL include `content?: string` in addition to `index`, `name`, and `status`. The field accumulates the stage's markdown body text across streaming chunks.

#### Scenario: Stage without content is valid
- **WHEN** a `Stage` object is constructed without `content`
- **THEN** TypeScript accepts it without error

#### Scenario: Stage with content is valid
- **WHEN** a `Stage` object is constructed with `content: "## Result\n...">`
- **THEN** TypeScript accepts it without error

---

### Requirement: `StageItem` collapses/expands its content body

**Revised** — `StageItem` no longer has any "Open app" action, `onOpenApp`/`openAppAriaLabel` prop, or `mcp_app` field to read; the MCP Apps trigger moved off the stage entirely and onto the message body, keyed by message index (see `mcp-app-trigger`'s requirements). `StageItem`'s only remaining concern is `content` collapse/expand.

Each `StageItem` SHALL render a header row (icon + name). When `stage.content` is present, the item SHALL be a button that toggles an animated content body (CSS grid-rows transition). When `stage.content` is absent, the item is a static row with no collapse toggle.

#### Scenario: Stage without content renders a plain row
- **WHEN** `stage.content` is undefined or empty
- **THEN** no toggle button is rendered

#### Scenario: Stage with content renders a collapsible button
- **WHEN** `stage.content` is a non-empty string
- **THEN** a button element is rendered and clicking it expands/collapses the content body
