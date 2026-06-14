## ADDED Requirements

### Requirement: User can drag to resize the sidebar panel
The `ConversationSourcesPanel` SHALL render a drag handle on its left edge that lets the user adjust the panel width between a fixed minimum and a dynamic maximum of 50% of the current viewport width.

#### Scenario: User drags handle to increase width
- **WHEN** the user drags the resize handle to the left
- **THEN** the panel width increases up to the maximum allowed width

#### Scenario: User drags handle to decrease width
- **WHEN** the user drags the resize handle to the right
- **THEN** the panel width decreases down to the minimum allowed width

#### Scenario: Width is clamped at minimum
- **WHEN** the user drags the handle beyond the minimum width boundary
- **THEN** the panel width stops at the minimum and does not shrink further

#### Scenario: Width is clamped at maximum
- **WHEN** the user drags the handle beyond 50% of the current viewport width
- **THEN** the panel width stops at 50% of the viewport width and does not grow further

#### Scenario: Maximum width updates when viewport is resized
- **WHEN** the browser window is resized to a new width
- **THEN** the panel's maximum allowed width updates to 50% of the new viewport width

---

### Requirement: Panel width is persisted across sessions
The system SHALL save the panel width to `localStorage` when the user finishes a resize interaction and restore it on the next page load.

#### Scenario: Width is saved after drag ends
- **WHEN** the user releases the resize handle after dragging
- **THEN** the new width is written to `localStorage` under the key `conversationSourcesWidth`

#### Scenario: Saved width is restored on reload
- **WHEN** the page loads and a valid width value exists in `localStorage` under `conversationSourcesWidth`
- **THEN** the panel opens at that saved width

#### Scenario: Fallback to default width when no stored value
- **WHEN** the page loads and no value exists in `localStorage` for `conversationSourcesWidth`
- **THEN** the panel opens at the default width of 360px

#### Scenario: Stored width is clamped to allowed bounds on restore
- **WHEN** the page loads and the stored width exceeds 50% of the current viewport width or falls below the minimum
- **THEN** the panel opens at the nearest bound (min or 50% of viewport width)

---

### Requirement: Resizing is disabled on mobile viewports
On mobile viewports, the panel SHALL render at full width with no visible resize handle and no drag behaviour.

#### Scenario: No resize handle on mobile
- **WHEN** the viewport is at the mobile breakpoint
- **THEN** no resize handle is rendered on the panel

#### Scenario: Panel is full-width on mobile regardless of stored width
- **WHEN** the viewport is at the mobile breakpoint and a width is stored in `localStorage`
- **THEN** the panel fills the full viewport width and the stored width is ignored
