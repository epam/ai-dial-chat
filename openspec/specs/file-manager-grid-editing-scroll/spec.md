# Spec: file-manager-grid-editing-scroll

## Purpose

`useGridEditingScroll`: scrolling inline renames and new-row placeholders into view in both file-manager hosts.

## Requirements

### Requirement: useGridEditingScroll hook contract

`libs/chat-shared/src/file-manager/useGridEditingScroll/useGridEditingScroll.ts (@epam/ai-dial-chat-shared)` SHALL export a `useGridEditingScroll(options?: UseGridEditingScrollOptions)` hook returning `{ handleGridApiChange: (api: GridApi<FileManagerGridRow>) => void; reset: () => void }`. `UseGridEditingScrollOptions` SHALL accept an optional `resolveTargetNode?: (newNodes: IRowNode<FileManagerGridRow>[]) => IRowNode<FileManagerGridRow> | null`, defaulting to preferring the first node whose `data?.isTemporary` is `true`, falling back to the first entry of `newNodes`, matching the legacy `defaultResolveTargetNode` heuristic (`development:apps/chat/src/components/FileManager/hooks/useGridEditingScroll.ts`).

**State ownership**: the hook owns its internal `knownRowIdsRef`/`knownRowIdsInitializedRef`/currently-subscribed-`GridApi` refs; no new context is introduced. `reset()` clears the known-row-id tracking (for use when the shell's `activeTab` changes and the grid's row set is expected to fully replace, avoiding a false "new row" scroll on tab switch).

#### Scenario: Hook returns a stable handleGridApiChange callback

- **WHEN** `useGridEditingScroll()` is called
- **THEN** the returned `handleGridApiChange` reference is stable across re-renders (memoised with no reactive dependencies beyond internal refs)

---

### Requirement: Grid API captured via onGridApiChange on the main grid

`DialFileManagerShell` SHALL pass `handleGridApiChange` (from `useGridEditingScroll`) as the `onGridApiChange` prop on the main `<DialFileManager>` element it renders (distinct from the destination-folder popup's own `onGridApiChange`, which remains wired to `handleDestinationFolderPopupGridApiChange` unchanged).

#### Scenario: Shell wires the hook to the main grid

- **WHEN** `DialFileManagerShell` renders its main `<DialFileManager>`
- **THEN** the element's `onGridApiChange` prop is `useGridEditingScroll`'s `handleGridApiChange`

#### Scenario: Destination-folder popup grid API wiring is unaffected

- **WHEN** the destination-folder popup opens and reports its own `GridApi` via `onGridApiChange`
- **THEN** `handleDestinationFolderPopupGridApiChange` (existing, per `file-manager-copy-move`/`file-manager-folder-picker`) still receives it; `useGridEditingScroll`'s callback is not invoked for the popup's inner grid

---

### Requirement: Scroll-into-view on inline rename start

When the captured `GridApi` emits a `cellEditingStarted` event, the hook SHALL call `api.ensureIndexVisible(event.rowIndex)` if `event.rowIndex != null` and `!api.isDestroyed()`.

#### Scenario: Starting inline rename scrolls the row into view

- **WHEN** the user starts inline-renaming a row that is currently scrolled out of view
- **THEN** the captured `GridApi`'s `ensureIndexVisible` is called with that row's index

#### Scenario: Editing-started event after grid destruction is a no-op

- **WHEN** a `cellEditingStarted` event fires after the grid API reports `isDestroyed() === true`
- **THEN** `ensureIndexVisible` is not called

---

### Requirement: Scroll-into-view on new row appearing (new-folder placeholder)

When the captured `GridApi` emits a `rowDataUpdated` event, the hook SHALL diff the current set of row ids (`node.data?.id` for every node in the event's grid) against the previously-known set, collect nodes whose id was not previously known, resolve a target node via `resolveTargetNode` (preferring `isTemporary`), and — if a target is resolved — call `api.ensureNodeVisible(targetNode, 'middle')` inside a double `requestAnimationFrame`, followed by a DOM `element.scrollIntoView({ block: 'center', behavior: 'auto' })` fallback using the row's `[row-id]`/`[row-index]` attribute, matching the legacy `scrollRowIntoView`/`findRowElement` helpers verbatim. The very first `rowDataUpdated` event after a `reset()` (or initial mount) SHALL NOT trigger a scroll — it only seeds the known-id set (matching the legacy `knownRowIdsInitializedRef` guard).

#### Scenario: New folder placeholder row scrolls into view

- **WHEN** the user clicks "New folder" and a temporary placeholder row (`isTemporary: true`) is inserted below the currently visible rows
- **THEN** `rowDataUpdated` fires, the placeholder row is resolved as the target, and `ensureNodeVisible`/`scrollIntoView` are invoked for it

#### Scenario: Initial row-data load does not trigger a spurious scroll

- **WHEN** the grid's first `rowDataUpdated` event fires after mount (or after `reset()`), populating rows for the first time
- **THEN** no scroll is triggered — the event only seeds `knownRowIdsRef`

#### Scenario: Unrelated row-data update with no new rows does not scroll

- **WHEN** `rowDataUpdated` fires because of a sort/filter change but no row ids are new relative to the previously known set
- **THEN** neither `ensureNodeVisible` nor `scrollIntoView` is called

#### Scenario: Destroyed grid API guards the deferred scroll callback

- **WHEN** the double-`requestAnimationFrame`-deferred scroll callback runs after the grid has been destroyed
- **THEN** `ensureNodeVisible` is not called (guarded by `!api.isDestroyed()`), and the DOM `scrollIntoView` fallback still runs if the row element is still present

---

### Requirement: Both hosts inherit the behavior with no per-host wiring

Because `useGridEditingScroll` is invoked and wired only inside `DialFileManagerShell`, `DialFileManagerModal` (attach) and `DialFileManagerPage` (standalone) SHALL both exhibit the scroll-on-rename and scroll-on-new-folder behavior without any code changes in either host file.

#### Scenario: Attach modal inherits scroll behavior

- **WHEN** a user renames a file inside `DialFileManagerModal`'s grid, scrolled out of view
- **THEN** the row scrolls into view, without `DialFileManagerModal.tsx` referencing `useGridEditingScroll` directly

#### Scenario: Standalone page inherits scroll behavior

- **WHEN** a user creates a new folder inside `DialFileManagerPage`'s grid, appended below the visible rows
- **THEN** the new placeholder row scrolls into view, without `DialFileManagerPage.tsx` referencing `useGridEditingScroll` directly

---

### Requirement: RTL and accessibility are unaffected

Scroll-into-view is a direction-agnostic browser/AG-Grid behavior (`ensureIndexVisible`/`ensureNodeVisible` operate on row index/vertical position, and the DOM `scrollIntoView` fallback does not read `dir`). This change SHALL NOT introduce any physical-direction Tailwind classes, and SHALL NOT alter any ARIA attribute, keyboard focus order, or tab stop already established by the ui-kit grid.

#### Scenario: Scroll behavior is identical in RTL

- **WHEN** the active language is Arabic (`dir="rtl"` on `<html>`)
- **THEN** the same rename/new-folder scroll-into-view behavior occurs, since row index and vertical scroll position do not depend on inline/horizontal direction

---

### Requirement: useGridEditingScroll hook contract

`libs/chat-shared/src/file-manager/useGridEditingScroll` SHALL canonically
export `useGridEditingScroll(options?)`, returning
`{ handleGridApiChange: (api: GridApi<FileManagerGridRow>) => void; reset(): void }`.
Options SHALL retain the current optional `resolveTargetNode` callback and its
temporary-node-first fallback. Internal known-row and subscribed-API refs remain
hook-owned. `chat-hooks` SHALL not re-export the contract; consumers SHALL
import it directly from `chat-shared`.

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
