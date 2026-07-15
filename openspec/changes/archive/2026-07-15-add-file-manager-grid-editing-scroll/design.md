## Context

Legacy reference (`git show development:apps/chat/src/components/FileManager/hooks/useGridEditingScroll.ts`):

- Returns `{ isEditing, freezeItems, additionalGridOptions, reset }`, where `additionalGridOptions` is a `GridOptions<FileManagerGridRow>` fragment (`onCellEditingStarted`, `onCellEditingStopped`, `onRowDataUpdated`, `suppressRowVirtualisation`) spread directly into AG Grid's own `gridOptions` prop, because the legacy `FileManager.tsx` rendered AG Grid's `GridOptions` type directly (no host/library boundary in between).
- `onCellEditingStarted`: sets `isEditing = true` and calls `params.api.ensureIndexVisible(params.rowIndex)` on a `setTimeout(0)`.
- `onRowDataUpdated`: diffs `knownRowIdsRef` (the previously-seen row id set) against the new node list; any id not previously known is a "new node" candidate. `resolveTargetNode` (default: prefer `node.data?.isTemporary`, else first new node) picks the row to scroll to, then `scrollRowIntoView` calls `api.ensureNodeVisible(node, 'middle')` inside a double `requestAnimationFrame`, plus a DOM `querySelector('[row-id="..."]')?.scrollIntoView({ block: 'center' })` fallback for rows AG Grid hasn't mounted yet at `ensureNodeVisible` time.
- `freezeItems`/`useFreeze` froze the grid's row-data reference while `isEditing` was true, to stop AG Grid re-sorting/re-filtering the row out from under the user mid-edit — this depended on `FileManager.tsx` piping `fileTreeItems` through `freezeItems` before handing them to AG Grid's `rowData`.

Current architecture is materially different: `DialFileManagerShell` renders `@epam/ai-dial-ui-kit`'s `<DialFileManager>`, which owns AG Grid internally. The MCP-verified `DialFileManager` props confirm:

- `gridOptions: GridOptions` exists, but the ui-kit's own `GridOptions` type (verified via `getEntityDetails("type", "GridOptions")`) only forwards `columnDefs`, `filterable`, `dateLocale`, `dateOptions`, `showFiles`, `showFolders`, `visibleColumns`, `selectionMode`, `wrapCustomCellRenderers`, `allowDisabledContextMenu`, `actionLabels` — **no** `onCellEditingStarted`/`onRowDataUpdated`/`suppressRowVirtualisation` pass-through. The legacy `additionalGridOptions`-spread approach has no equivalent entry point.
- `onGridApiChange: (api: GridApi) => void` **is** a top-level prop, giving the host a live `GridApi<FileManagerGridRow>` reference — this is the exact type `DialFileManagerShell.tsx:14` already imports from `ag-grid-community` and already uses for the destination-folder popup's inner grid (`handleDestinationFolderPopupGridApiChange`, `DialFileManagerShell.tsx:348-419`). The main `<DialFileManager>` element does not currently pass `onGridApiChange`.
- `FileManagerGridRow` (verified via MCP) still has `isTemporary?: boolean`, so the legacy `defaultResolveTargetNode` heuristic (prefer the temporary/new-folder placeholder row) still applies unchanged.

## Goals / Non-Goals

**Goals:**

- Restore scroll-into-view behavior for (a) starting an inline rename and (b) a new-folder placeholder row appearing, on both the attach modal grid and the standalone page grid.
- Reuse the exact legacy scroll heuristics (`ensureNodeVisible('middle')` + DOM fallback, `isTemporary`-preferring resolution) so behavior matches the pre-migration UX bit-for-bit.
- Keep the fix entirely inside `apps/chat/src/hooks/files/` and `DialFileManagerShell` — no ui-kit changes, no new props requested from the design system.

**Non-Goals:**

- Freezing row order during edit (legacy `freezeItems`/`useFreeze`). The current `useDialFileManager` already holds `items` in React state that only changes on explicit list-refresh/retry-counter events, not on every render, so the reordering risk `freezeItems` guarded against in the Redux-selector-driven legacy code does not reproduce here; if a regression is observed later it is a separate, narrowly-scoped follow-up.
- Scroll-into-view inside the destination-folder popup's own inner grid. The popup already wires its own `onGridApiChange` (`handleDestinationFolderPopupGridApiChange`) for conflict-resolution purposes; the popup has no rename affordance (per `file-manager-folder-picker` spec: "no row-level context actions" inside the popup), and its "Add folder" flow creates a folder in a typically-short, already-visible list. No new-folder scroll wiring is added there in this change — see Open Questions.
- Any AG Grid version bump or ui-kit prop request. `GridApi.addEventListener` for `cellEditingStarted`/`rowDataUpdated` is public AG Grid Community API surface, already reachable through the existing `onGridApiChange` prop.

## Decisions

**D1 — Capture the grid via `onGridApiChange` + raw AG Grid event listeners, not a `gridOptions` extension.**
Rejected: asking ui-kit to add `onCellEditingStarted`/`onRowDataUpdated` passthrough to its `GridOptions` type — this would require an upstream ui-kit change and a version bump before this app-level fix could ship. Chosen: use the AG Grid `GridApi` instance already exposed via `onGridApiChange` and call `api.addEventListener('cellEditingStarted', handler)` / `api.addEventListener('rowDataUpdated', handler)` directly — these are core `ag-grid-community` `GridApi` methods, not ui-kit-specific, so they work against any AG Grid instance regardless of what the wrapping ui-kit component forwards through its own typed `gridOptions` prop. This mirrors how `DialFileManagerShell` already treats `GridApi` as a first-class import (`ag-grid-community`) for the destination-popup grid.

**D2 — Own the hook in `apps/chat/src/hooks/files/`, wire it once in `DialFileManagerShell`.**
Per `file-manager-shell`'s established pattern (shell owns all `DialFileManager` prop assembly so both hosts inherit behavior without duplication), the new hook is invoked inside `DialFileManagerShell`, not in `DialFileManagerModal`/`DialFileManagerPage`. The shell passes the hook's `handleGridApiChange` callback as the main grid's `onGridApiChange` prop.

**D3 — Row-id diffing lives in the hook, driven by AG Grid's own `rowDataUpdated` event, not by diffing the `items` prop in React.**
Alternative considered: skip AG Grid events entirely and diff `useDialFileManager`'s `items` array between renders in a `useEffect`. Rejected — `items` diffing in React would require re-deriving "is this row currently rendered/visible" from `GridApi.getRowNode(id)` anyway to call `ensureNodeVisible`, and would fire on every `items` reference change (e.g., unrelated sort/filter updates) rather than precisely on AG Grid's own internal `rowDataUpdated` lifecycle event, which is the exact signal the legacy hook relied on and is the more precise AG-Grid-native signal for "the grid just re-rendered its row set."

**D4 — Keep `additionalGridOptions`-shaped output for parity, but deliver it via imperative event binding instead of a props fragment.**
The new hook's public shape is `{ handleGridApiChange(api), reset() }` (no `isEditing`/`freezeItems` returned, since D-Non-Goal above drops the freeze behavior). `handleGridApiChange` internally calls `api.addEventListener(...)` on mount and `api.removeEventListener(...)` when a new `api` reference arrives or the component unmounts (tracked via a `useRef<GridApi | null>` holding the currently-subscribed instance).

## Risks / Trade-offs

- **[Risk] AG Grid may call `onGridApiChange` with a new `GridApi` instance across re-renders (e.g., grid remount on tab switch) without the hook re-subscribing.** → Mitigation: the hook's `handleGridApiChange` always removes listeners from the previously-tracked instance before attaching to the new one; the callback is stable via `useCallback` with no dependencies (it only touches refs), so `DialFileManagerShell` can pass it directly to `onGridApiChange` without triggering extra grid churn.
- **[Risk] `ensureNodeVisible`/`ensureIndexVisible` can be called after the grid API has been destroyed (async `requestAnimationFrame` callbacks firing post-unmount).** → Mitigation: port the legacy guard (`!api.isDestroyed()`) unchanged before calling any AG Grid method inside the deferred callback.
- **[Risk] No automated coverage for the exact double-`requestAnimationFrame` timing.** → Mitigation: unit-test the hook against a mocked `GridApi` (jest/vitest fake timers + `requestAnimationFrame` polyfill) asserting `ensureNodeVisible`/`ensureIndexVisible` are invoked with the expected node/index, without asserting on real browser layout timing.

## Migration Plan

Purely additive; no data migration. Rollback is a revert of the hook file and the two-line wiring change in `DialFileManagerShell` (`onGridApiChange` prop + hook invocation) — no other file depends on this hook.

## Open Questions

- Should the destination-folder popup's inner grid get the same scroll-on-new-folder behavior when "Add folder" is used inside it? The popup typically shows a short, folder-only listing where scrolling is less likely to be needed, and it has no rename affordance at all. Recommendation: leave out of scope for this change and revisit only if product/QA report the popup's own "Add folder" row appearing off-screen in practice — flag as a follow-up rather than speculatively wiring an unused extension point.
