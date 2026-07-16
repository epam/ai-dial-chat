## 1. Hook implementation (vertical slice — hook alone, unit-testable in isolation)

- [x] 1.1 Create `apps/chat/src/hooks/files/useGridEditingScroll.ts` porting the legacy logic from `development:apps/chat/src/components/FileManager/hooks/useGridEditingScroll.ts`: internal `knownRowIdsRef`/`knownRowIdsInitializedRef`/subscribed-`GridApi` refs, `defaultResolveTargetNode` (prefers `isTemporary`), `findRowElement`, `scrollRowIntoView` (double `requestAnimationFrame` + `ensureNodeVisible('middle')` + DOM `scrollIntoView` fallback), and the public `{ handleGridApiChange, reset }` shape described in design.md D4. Add a JSDoc explaining WHY the hook binds AG Grid events imperatively instead of via `gridOptions` (ui-kit's `GridOptions` type does not forward `onCellEditingStarted`/`onRowDataUpdated`).
- [x] 1.2 Implement `handleGridApiChange(api)`: remove listeners from any previously-tracked `GridApi` (if different from the new one), attach `cellEditingStarted` and `rowDataUpdated` listeners to the new `api` via `api.addEventListener`, and store the new `api` in a ref for future cleanup/removal.
- [x] 1.3 Implement the `cellEditingStarted` handler: guard `!api.isDestroyed()` and `event.rowIndex != null`, then call `api.ensureIndexVisible(event.rowIndex)`.
- [x] 1.4 Implement the `rowDataUpdated` handler: iterate `api.forEachNode`, build the current id set, diff against `knownRowIdsRef` (skip diffing — only seed — when `knownRowIdsInitializedRef.current` is `false`), resolve the target node via `resolveTargetNode`, and call `scrollRowIntoView(api, targetNode)` when a target is found.
- [x] 1.5 Implement `reset()`: clears `knownRowIdsRef`/`knownRowIdsInitializedRef` back to their initial (uninitialized) state, matching the legacy `reset` behavior.

## 2. Unit tests for the hook

- [x] 2.1 Add `apps/chat/src/hooks/files/tests/useGridEditingScroll.spec.ts` covering: `cellEditingStarted` calls `ensureIndexVisible` with the event's row index; a destroyed API skips the call; first `rowDataUpdated` after mount/`reset()` seeds ids without scrolling; a `rowDataUpdated` introducing a new `isTemporary` row triggers `ensureNodeVisible`/`scrollIntoView` for that row; a `rowDataUpdated` with no new ids triggers neither; switching to a new `GridApi` instance via a second `handleGridApiChange` call removes listeners from the old instance and attaches to the new one. Mock `GridApi`/`IRowNode` per the ui-kit `FileManagerGridRow`/AG Grid Community types — do not import real AG Grid internals.
- [x] 2.2 Test names describe observable behavior (e.g., "scrolls the temporary new-folder row into view when a new row appears"), not implementation details.

## 3. Wire the hook into DialFileManagerShell (both hosts inherit automatically)

- [x] 3.1 In `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`, call `useGridEditingScroll()` and pass its `handleGridApiChange` as the main `<DialFileManager>`'s `onGridApiChange` prop — leave the destination-folder popup's existing `handleDestinationFolderPopupGridApiChange` wiring on the popup untouched.
- [x] 3.2 Call the hook's `reset()` when `activeTab` changes (the shell already receives `activeTab` as a prop), so a tab switch's full row-set replacement is not misread as "new rows appeared."

## 4. RTL and accessibility check

- [x] 4.1 Confirm no physical-direction Tailwind classes or ARIA attributes are touched by this change (the hook only calls AG Grid API methods and native DOM `scrollIntoView`); note in the PR description that RTL behavior is identical since scroll position is vertical/index-based, not inline-direction-based.

## 5. Verification

- [x] 5.1 Run `npm exec nx test chat` for the touched files (hook unit tests + any existing `DialFileManagerShell` tests that assert its rendered `<DialFileManager>` props).
- [x] 5.2 Run `npm exec nx lint chat`.
- [x] 5.3 Close with `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0` over the affected project set.
