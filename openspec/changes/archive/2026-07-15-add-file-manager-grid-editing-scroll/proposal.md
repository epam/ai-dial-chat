## Why

The legacy Redux-based file manager (`apps/chat/src/components/FileManager/hooks/useGridEditingScroll.ts` on `development`) auto-scrolled the AG Grid so an inline-rename cell or a newly-inserted "new folder" placeholder row stayed visible while the user typed. The current ui-kit-based file manager (`DialFileManagerShell` + `useDialFileManager`, introduced across the #7501–#7504 phases) has no equivalent: on a folder with enough rows to require scrolling, starting an inline rename or clicking "New folder" can leave the edited row off-screen with no automatic scroll-into-view, so the user loses sight of what they are typing. This is the last UX parity gap called out in GitHub issue #7505 (step 16 of the migration roadmap) before the ui-kit migration reaches full parity with the legacy grid's editing ergonomics.

## What Changes

- Add a new `useGridEditingScroll` hook (`apps/chat/src/hooks/files/useGridEditingScroll.ts`) that ports the legacy hook's row-tracking/scroll logic onto the ui-kit integration surface: it captures the AG Grid `GridApi<FileManagerGridRow>` via `DialFileManager`'s existing `onGridApiChange` prop (not currently wired on the main grid — only on the destination-folder popup's inner grid today, `DialFileManagerShell.tsx:402`) and subscribes directly to the AG Grid instance's native `cellEditingStarted` and `rowDataUpdated` events via `GridApi.addEventListener`, since `@epam/ai-dial-ui-kit`'s `GridOptions` type does not forward raw AG Grid event callbacks.
- Wire `onGridApiChange` and the hook on the main `<DialFileManager>` element inside `DialFileManagerShell` so both existing hosts — `DialFileManagerModal` (attach) and `DialFileManagerPage` (standalone) — inherit the scroll behavior with no per-host code.
- Preserve the legacy behavior exactly: on `cellEditingStarted`, call `ensureIndexVisible` for the row being edited; on `rowDataUpdated`, diff previously-known row ids against the current set, resolve the newly-appeared row (preferring `FileManagerGridRow.isTemporary` — the new-folder placeholder — falling back to the first new row), and scroll it into view via `ensureNodeVisible('middle')` plus a DOM `scrollIntoView` fallback for the case where AG Grid virtualization has not yet mounted the row element.
- Document, rather than implement, the boundary for the destination-folder popup's inner grid: it has no rename affordance and no `onCreateFolder`-triggered row-scroll requirement beyond what "Add folder" already does inside its own small viewport (see design.md).

## Capabilities

### New Capabilities

- `file-manager-grid-editing-scroll`: the `useGridEditingScroll` hook contract, how `DialFileManagerShell` wires it to the main grid via `onGridApiChange`, and the scroll-trigger behavior for inline rename and new-folder-row creation.

### Modified Capabilities

_None._ `file-manager-shell`'s existing requirements (grid/tree/toolbar option-bag assembly, upload/download/error overlays) are unchanged — this change only adds new wiring on top of the shell's already-documented `DialFileManager` prop assembly; it does not alter any existing requirement or scenario in `file-manager-shell`.

## Impact

- **New file**: `apps/chat/src/hooks/files/useGridEditingScroll.ts` (+ `tests/useGridEditingScroll.spec.ts`).
- **Modified file**: `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` — adds `onGridApiChange` on the main `<DialFileManager>` and consumes the new hook's `additionalGridOptions`/callbacks are not applicable (ui-kit does not expose that extension point); instead the shell passes a `ref`-like callback and lets the hook attach grid listeners imperatively.
- **No backend, no DTO, no i18n, no new dependency.** Purely a frontend interaction-polish change.
- **Hosts affected**: `DialFileManagerModal` (attach) and `DialFileManagerPage` (standalone) both inherit the fix automatically through the shared shell — no changes needed in either host file.
- **Not breaking**: additive only; rollback is deleting the hook and its two call sites in the shell.
