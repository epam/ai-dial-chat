## ADDED Requirements

### Requirement: Dashboard composition exposes supported card grid and icon settings

ScheduledTasks SHALL accept and forward cardStyles to grid/cards and expose className, sortIcon and typed gridLayout settings in design.md. Layout SHALL depend on available scoped inline space, not colliding host utilities. The default sort control SHALL use the real Tabler arrows-sort icon; custom and null icons SHALL be supported without affecting its name.

#### Scenario: Compact dashboard fits three columns

- **WHEN** a host configures maxColumns 3, minCardWidth 320px, maxWidth 1120px, gap 20px, cardHeight 184px
- **THEN** the grid has three columns when at least 1000px is available, two when at least 660px is available, and one below that; skeletons use the same dimensions.

#### Scenario: Nested card styles pass through the page component

- **WHEN** the host changes title/status colors through ScheduledTasks.cardStyles
- **THEN** rendered cards receive the settings without direct grid composition or private-class selectors.

#### Scenario: Custom or absent sort icon preserves accessibility

- **WHEN** sortIcon is customized or explicitly null
- **THEN** the icon changes or disappears, and the translated button name, keyboard action and sorting behavior remain intact.

### Requirement: Card status presentation is explicit and backward compatible

ScheduledTaskItem SHALL support an optional exported Active/Paused/Completed status enum. Explicit status SHALL take precedence over isActive; omission SHALL preserve existing isActive behavior. Status labels and per-status badge/title styles SHALL be host-configurable. No lifecycle SHALL be inferred from absent nextRunTime alone.

#### Scenario: Paused and completed reproduce transparent badges

- **WHEN** the host supplies Paused/Completed with transparent badge background and secondary title color
- **THEN** both render the translated status and requested styling without inspecting descendants or CSS hashes.

#### Scenario: Existing callers retain active behavior

- **WHEN** an existing host supplies only isActive
- **THEN** the card behaves as before and is not newly classified Completed.

#### Scenario: Missing next-run timestamp is not completion evidence

- **WHEN** a task lacks nextRunTime but the host has not supplied Completed
- **THEN** the library does not introduce a Completed badge.

### Requirement: Dashboard incremental failure does not replace loaded content

ScheduledTasks SHALL support distinct incremental error/retry props and preserve its cards while a later page fails. The app SHALL consume common trigger descriptions for schedule text, preserving next-run information as a separate product concept. Search highlighting, unread badges, banner and card navigation SHALL remain intact.

#### Scenario: Retry is shown alongside existing cards

- **WHEN** a later page fails while cards are already visible
- **THEN** cards remain, an accessible localized incremental error/retry appears, and retry delegates to the supplied callback.

#### Scenario: Metadata absence does not degrade a supported repeat label

- **WHEN** a task's trigger is supported but optional model/prompt is absent
- **THEN** its recurring description remains meaningful and does not become Custom merely because edit metadata is absent.

