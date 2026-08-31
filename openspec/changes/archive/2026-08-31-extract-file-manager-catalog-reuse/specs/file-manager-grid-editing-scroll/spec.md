## MODIFIED Requirements

### Requirement: useGridEditingScroll hook contract

`libs/chat-shared/src/file-manager/useGridEditingScroll` SHALL canonically
export `useGridEditingScroll(options?)`, returning
`{ handleGridApiChange: (api: GridApi<FileManagerGridRow>) => void; reset(): void }`.
Options SHALL retain the current optional `resolveTargetNode` callback and its
temporary-node-first fallback. Internal known-row and subscribed-API refs remain
hook-owned. `chat-hooks` SHALL compatibility-re-export the same contract.

#### Scenario: Callback is stable

- **WHEN** the hook re-renders
- **THEN** `handleGridApiChange` retains its identity

### Requirement: Grid API captured via onGridApiChange on the main grid

The shared `DialFileManagerShell` SHALL pass this handler to the main grid and
SHALL preserve the distinct destination-folder popup handler.

#### Scenario: Main grid is wired

- **WHEN** the shared shell renders its main grid
- **THEN** its `onGridApiChange` is the hook handler

#### Scenario: Destination grid is unaffected

- **WHEN** the folder picker reports its API
- **THEN** the existing destination-popup handler receives it

### Requirement: Scroll-into-view on inline rename start

On `cellEditingStarted`, the hook SHALL call `ensureIndexVisible(rowIndex)` only
when the index exists and the API is not destroyed.

#### Scenario: Rename scrolls

- **WHEN** inline editing begins on a live off-screen row
- **THEN** that row index is made visible

#### Scenario: Destroyed grid is a no-op

- **WHEN** the event arrives after grid destruction
- **THEN** no grid scrolling API is called

### Requirement: Scroll-into-view on new row appearing

On `rowDataUpdated`, the hook SHALL preserve its current id diff,
temporary-node preference, first-update/reset seed guard, double
`requestAnimationFrame`, `ensureNodeVisible(node, 'middle')`, destroyed-grid
guard, and `[row-id]`/`[row-index]` DOM `scrollIntoView` fallback.

#### Scenario: New temporary folder scrolls

- **WHEN** a new temporary row id appears after initialization
- **THEN** the resolved row is centered through the grid and DOM fallback

#### Scenario: Initial data only seeds

- **WHEN** the first update occurs after mount or reset
- **THEN** ids are seeded and no scrolling occurs

#### Scenario: No new ids means no scroll

- **WHEN** an update contains only known row ids
- **THEN** neither grid nor DOM scrolling occurs

#### Scenario: Deferred callback guards destruction

- **WHEN** the grid is destroyed before the deferred callback
- **THEN** grid scrolling is skipped while an existing DOM row may still use
  the fallback

### Requirement: Both hosts inherit the behavior with no per-host wiring

The attach modal and standalone page SHALL inherit grid-editing scroll behavior
from the hook invoked inside the shared shell, without direct hook references.

#### Scenario: Attach host inherits rename scrolling

- **WHEN** a row is renamed in the attach host
- **THEN** the shell scrolls it without modal-level wiring

#### Scenario: Page host inherits new-folder scrolling

- **WHEN** a folder placeholder is inserted on the standalone page
- **THEN** the shell scrolls it without page-level wiring

### Requirement: RTL and accessibility are unaffected

The vertical scroll behavior SHALL remain direction-agnostic and SHALL not add
physical-direction utilities, ARIA changes, focus-order changes or tab stops.

#### Scenario: RTL behavior is identical

- **WHEN** the document direction is RTL
- **THEN** rename and new-row vertical scrolling match LTR behavior
