## Context

The originally-drafted plan for this slice (see the #7503 roadmap note carried in this change's history) assumed the legacy Redux-era `apps/chat/src/components/Files/SelectFolderModal.tsx` (present only on `origin/development`, not on `development-1.0`) would need a from-scratch replacement — a new host component wrapping ui-kit's `DialDestinationFolderPopup` directly, gated by a new `DialFileManagerVariant.FolderPicker` + `DialFileManagerActionProfile.Full`.

That assumption was invalidated by direct investigation after `add-file-manager-copy-move` shipped. Reading the installed `@epam/ai-dial-ui-kit` package's type declarations shows `DialFileManager` internally owns the entire destination-folder-popup lifecycle via `FileManagerContext`:

```ts
// node_modules/@epam/ai-dial-ui-kit/dist/src/components/FileManager/FileManagerContext.d.ts
handleCopyTo: (destinationFolder: string) => void;
handleMoveTo: (destinationFolder: string, sourceFolder?: string) => void;
handleOpenDestinationFolderPopup: (mode: DestinationFolderMode) => void;
handleCloseDestinationFolderPopup: () => void;
openDestinationFolderPopup: boolean;
destinationFolderMode: DestinationFolderMode;
```

Clicking the Copy/Move row action (visible because `add-file-manager-copy-move` added `DialFileManagerActions.Copy`/`.Move` to `actionLabels`) calls `handleOpenDestinationFolderPopup`, which mounts `DialDestinationFolderPopup` internally, browsing the same `items` tree already passed to the outer `DialFileManager`. Confirming the destination fires `handleCopyTo`/`handleMoveTo`, which call the exact `onCopyFiles(items, destinationFolder)` / `onMoveToFiles(items, sourceFolder, destinationFolder)` props `add-file-manager-copy-move` already wired. This was verified live by the reporter (folders-only view, working "Add folder" button, working hidden-files toggle, no row actions on folders inside the popup) before this design was written.

The only customization surface exposed to the host app is the `destinationFolderPopupOptions` prop on `DialFileManager`:

```ts
// FileManager.d.ts
export type DialFileManagerDestinationFolderPopupOptions = Pick<DestinationFolderPopupProps,
  'setDestinationFolderPath' | 'destinationFolderPath' | 'addFolderLabel' | 'copyLabel' |
  'moveLabel' | 'hiddenFilesSwitcherLabel' | 'header' | 'onCreateFolder' |
  'onCreateFolderValidate' | 'folderCreationValidationMessages' | 'disabledPathTooltip' |
  'emptyStateTitle' | 'emptyStateDescription'
> & {
  getCopyHeader?: (itemsCount: number, itemName?: string) => string;
  getMoveHeader?: (itemsCount: number, itemName?: string) => string;
  processDestinationFolderPath?: (path: string) => string;
};
```

`DialFileManagerShell` never passes this prop today (verified: zero references to `destinationFolderPopupOptions` in `apps/chat/src`), so the popup renders ui-kit's hardcoded English defaults (`"Copy"`, `"Move"`, `"Add folder"`, `"Show hidden files"`). This is the actual gap this change closes, per the repo's i18n rule (`openspec/config.yaml` design rules: "All user-visible strings go through react-i18next").

## Goals / Non-Goals

**Goals:**
- Wire `destinationFolderPopupOptions` on `DialFileManagerShell` with i18n-translated `copyLabel`/`moveLabel`/`addFolderLabel`/`hiddenFilesSwitcherLabel`.
- Add a dynamic, count-aware popup title via `getCopyHeader`/`getMoveHeader` (mirrors the existing `deleteConfirmTitle(names)` pattern in `DialFileManagerPage`).
- Wire `sourceFolder` (Move mode only) so the popup can disable the source folder itself as a destination, with `disabledPathTooltip` explaining why.
- Add folder-picker-specific `emptyStateTitle`/`emptyStateDescription` (a folder with no subfolders still needs a coherent empty state inside the popup).
- Verify (with a regression test, not new production code, if it already works) that "Add folder" inside the popup targets the popup's own currently-browsed path via the inherited `onCreateFolder`/`onCreateFolderValidate` fallback, not the outer grid's path.
- Formally spec this previously-undocumented capability (`file-manager-folder-picker`).

**Non-Goals:**
- A new `SelectFolderModal` host component (see Context — not needed).
- `DialFileManagerVariant.FolderPicker` / `DialFileManagerActionProfile.Full` implementation.
- Rename/Delete row actions inside the popup — the current ui-kit `DialFileManagerDestinationFolderPopupOptions` type exposes no `actionLabels` override for the popup's internal tree, and live testing confirmed no context menu renders on its rows. This is a ui-kit capability gap, not something the app can work around by passing different options. Documented as an open question for a future ui-kit version, not solved here.
- Cross-tab (Shared/Organization) destination picking.
- Any change to `onCopyFiles`/`onMoveToFiles` request/response handling — those are unchanged from `add-file-manager-copy-move`.

## Decisions

### D1 — No new component; extend `DialFileManagerShell`'s existing options-building pattern

**Decision**: Add `destinationFolderPopupOptions` construction to `DialFileManagerShell.tsx`, following the exact shape already used for `deleteConfirmationOptions`/`conflictResolutionPopupOptions` (a `useMemo` in the shell that maps pre-translated `labels.*` fields into the ui-kit options object), fed by new fields on `DialFileManagerShellLabels` that `DialFileManagerPage` populates via `useTranslation`.

**Rationale**: This is a pure options-wiring change, not a new UI surface — no new component folder, no new tests/spec structure beyond what already covers `DialFileManagerShell`. Matches the shell's established "shell never calls `useTranslation`; every host resolves labels" convention (see `DialFileManagerShellLabels`'s own doc comment).

**Alternative considered**: build the options object directly inside `DialFileManagerPage` and pass it down as a single opaque prop — rejected because `DialFileManagerShell` already owns every other `*PopupOptions`/`*ToolbarOptions` construction from `labels.*`; doing this one differently would break the established pattern for no benefit.

### D2 — `copyLabel`/`moveLabel` reuse the existing action-label translations

**Decision**: `destinationFolderPopupOptions.copyLabel`/`.moveLabel` reuse the same `DialFileManagerI18nKeys.CopyAction`/`.MoveAction` strings already added in `add-file-manager-copy-move` for the grid/tree/bulk action labels (`"Copy"`/`"Move"`), rather than introducing separate `dialFileManager.copyPopupButton` keys.

**Rationale**: The popup's `copyLabel`/`moveLabel` are literally the confirm-button text for the same operation the action menu triggered — using the same translated string avoids a second key that would need to stay in sync with the first, and matches how `deleteLabel`/`deleteConfirmLabel` already differ only when the UX genuinely calls for different wording (compare: the delete confirmation dialog *does* use a distinct `DeleteConfirmButton` key, because "Delete" as a menu action and "Delete" as a destructive-confirm button warrant separately reviewable copy — copy/move popups are not destructive-confirm dialogs, so this distinction does not apply).

### D3 — `getCopyHeader`/`getMoveHeader` mirror the `deleteConfirmTitle` render-function pattern

**Decision**: `DialFileManagerShellLabels` gains `getCopyHeader: (count: number, name?: string) => string` and `getMoveHeader: (count: number, name?: string) => string`, resolved in `DialFileManagerPage` via `t(DialFileManagerI18nKeys.CopyHeaderSingle/Multiple, { name/count })`, exactly mirroring the existing `deleteConfirmTitle(names)` two-key (single/multiple) i18n pattern already in the same file.

**Signature note**: the popup passes `(itemsCount, itemName)` — `itemName` is defined only when `itemsCount === 1`. The single-item translation uses `{{name}}`; the multi-item translation uses `{{count}}` — matching how `DeleteConfirmTitleSingle`/`DeleteConfirmTitleMultiple` already split.

### D4 — `sourceFolder` wired for Move only; Copy has no analogous restriction

**Decision**: `destinationFolderPopupOptions.sourceFolder` (per `FileManagerContextValue`'s extension of the options type: `DialFileManagerDestinationFolderPopupOptions & { sourceFolder?: string }`) is set from the currently-selected items' common parent folder, computed the same way `onMoveToFiles`'s cross-folder-vs-rename partition already computes a parent folder (`add-file-manager-copy-move` design D3). It is passed only when the popup is opened in Move mode; Copy mode leaves it `undefined` since copying into the same folder is a valid, intentional "duplicate via picker" action (distinct from the dedicated same-folder-duplicate feature planned for a separate change) and should not be blocked.

**`disabledPathTooltip`**: uses the ui-kit-provided default English string ("Unavailable for the original path...") *unless* an i18n override is trivial to add — the design intentionally provides an i18n key for this to close the same compliance gap as the labels above.

### D5 — Verify, don't assume, the "Add folder" path-targeting behavior

**Decision**: `onCreateFolder`/`onCreateFolderValidate`/`folderCreationValidationMessages` are **not** overridden in `destinationFolderPopupOptions` — per the type definition, when omitted the popup falls back to the same-named props already passed to the outer `DialFileManager` (`onCreateFolder`, `onCreateFolderValidate` from `useDialFileManager`). Because `useDialFileManager.onCreateFolder`'s second parameter is the *folder path passed at call time* (not the hook's own `folderPath` state — see `apps/chat/src/hooks/files/useDialFileManager.ts`'s `onCreateFolder` signature `(_file, folderPath: string, _fileId)`), this should already resolve correctly to wherever the popup is currently browsing, not the outer grid's location. A unit/integration test verifies this rather than assuming it — if it turns out to target the wrong path, the fix is to add an explicit `destinationFolderPopupOptions.onCreateFolder` override that reads the popup's own path, which is why the type exposes that override at all.

### D6 — Rename/Delete-in-popup is a documented ui-kit limitation, not solved

**Decision**: No workaround is attempted. `DialFileManagerDestinationFolderPopupOptions` has no hook for the popup's internal action labels, and the popup's rendered rows have no context menu (confirmed live). Building a custom folder-tree-only picker just to regain this one legacy behavior would reintroduce the "build our own component" cost this change is specifically avoiding, for a feature (renaming a folder while mid-copy) with low observed demand.

**Alternative considered**: fork/wrap `DialDestinationFolderPopup`'s tree rendering ourselves with custom row actions — rejected as disproportionate; flagged as an open question to revisit if a future ui-kit release adds the hook, or if user feedback shows this is actually needed.

## Risks / Trade-offs

**Reusing `CopyAction`/`MoveAction` keys for two different UI surfaces (D2)** → if the menu-action wording and the popup-button wording ever need to diverge (e.g. "Copy" menu item vs. "Copy here" popup button), the shared key becomes a blocker. Mitigation: low risk today (both contexts use the same short verb in every other file manager the team has shipped); splitting the key later is a small, isolated follow-up if it happens.

**`sourceFolder` computed from a "common parent" heuristic (D4)** → if a multi-select Move spans items from different parent folders, there is no single "source folder" to disable. Mitigation: when the selection has no single common parent, `sourceFolder` is simply left `undefined` (no restriction applied) rather than guessing — DIAL Core's `moveResource` 409 remains the safety net for the case where the popup didn't proactively block it.

**Assuming (D5) instead of building a path-aware override** → if the fallback path-targeting turns out wrong in testing, this design's D5 becomes moot and D5's fallback plan (explicit override) must be implemented instead. Mitigation: this is exactly why D5 is written as "verify with a test," not "assume and ship" — tasks.md makes the test a gating step before closing the slice, not an afterthought.

## Migration Plan

1. Add `destinationFolderPopupOptions` construction to `DialFileManagerShell.tsx` and pass it to `DialFileManager`.
2. Extend `DialFileManagerShellLabels` with `addFolderLabel`, `hiddenFilesSwitcherLabel` (popup context — may reuse the toolbar's existing `hiddenFilesLabel` value, see tasks), `getCopyHeader`, `getMoveHeader`, `disabledPathTooltip`, `folderPickerEmptyStateTitle`/`Description`.
3. Resolve those fields via `useTranslation` in `DialFileManagerPage.tsx`, adding new i18n keys.
4. Compute and pass `sourceFolder` for Move mode from the current selection.
5. Add a regression test proving "Add folder" inside the popup creates the folder at the popup's browsed path.
6. Write the `file-manager-folder-picker` capability spec documenting the full behavior (ui-kit-owned mechanics + this change's additions).

**Rollback**: revert the `destinationFolderPopupOptions` prop and the new label fields — the popup keeps working on ui-kit defaults, exactly as it does today. No data or contract changes to roll back.

## Open Questions

- **Rename/Delete inside the popup**: revisit if a future `@epam/ai-dial-ui-kit` release exposes `actionLabels` for the destination-folder popup's tree (see AGENTS.md's UI Kit Breaking Changes & Migration section for the CHANGELOG-check procedure when that upgrade happens).
- **Multi-parent Move selections and `sourceFolder`**: is "no restriction when there's no single common parent" the right default, or should the popup instead disable *each* individual source folder in that case? `disabledPathTooltip` only supports one tooltip text, not a per-path map, so a per-folder restriction isn't expressible via the current ui-kit API either way — left as a future ui-kit capability question, same bucket as the rename/delete gap.
