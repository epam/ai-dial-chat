# Spec: file-manager-grid-editing-scroll

## Purpose

`useGridEditingScroll`: scrolling inline renames and new-row placeholders into view in both file-manager hosts.

## Requirements

### Requirement: useGridEditingScroll hook contract

`apps/chat/src/hooks/files/useGridEditingScroll.ts` SHALL export a `useGridEditingScroll(options?: UseGridEditingScrollOptions)` hook returning `{ handleGridApiChange: (api: GridApi<FileManagerGridRow>) => void; reset: () => void }`. `UseGridEditingScrollOptions` SHALL accept an optional `resolveTargetNode?: (newNodes: IRowNode<FileManagerGridRow>[]) => IRowNode<FileManagerGridRow> | null`, defaulting to preferring the first node whose `data?.isTemporary` is `true`, falling back to the first entry of `newNodes`, matching the legacy `defaultResolveTargetNode` heuristic (`development:apps/chat/src/components/FileManager/hooks/useGridEditingScroll.ts`).

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
