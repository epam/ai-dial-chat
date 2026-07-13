## Context

`add-file-manager-copy-move` wired `onCopyFiles(items: DialCopiedItem[], destinationFolder: string)` to `POST /api/v1/files/copy`, with `copyFolderItem` handling recursive folder copy via `expandFolderContents`. `add-file-manager-select-folder-modal` established that `DialFileManager` owns significant internal behavior beyond what its public prop list suggests — confirmed by reading the installed package's `FileManagerContext.d.ts`/`FileManager.d.ts` and, for that slice, the compiled bundle for the destination-folder-popup's internal handlers.

The same investigation method applied here to `handleDuplicate`, found in `node_modules/@epam/ai-dial-ui-kit/dist/index-U9Eh_lOr.js`:

```js
// Duplicate handler (bound to the Duplicate action in grid/tree/bulk menus)
(files) => {
  const destinationFolder = files.at(0)?.parentPath ?? '/';
  const resolved = resolveConflictsWithStrategy(destinationFolder, files, false);
  onCopyFiles?.(resolved, destinationFolder);
  onDuplicateSuccess?.();
}

// resolveConflictsWithStrategy(destinationFolder, files, overwriteIfConflict, metadata?)
(destinationFolder, files, overwriteIfConflict, metadata) => {
  const existingNames = new Set(getDestinationFiles(destinationFolder).map(f => f.name));
  return files.map((file) => {
    const hasConflict = existingNames.has(file.name);
    const resolvedName = (overwriteIfConflict && hasConflict)
      ? file.name
      : uniqueName(file.name, existingNames, file.nodeType);   // always true here — overwriteIfConflict is false
    if (!overwriteIfConflict || !hasConflict) existingNames.add(resolvedName);
    return {
      sourceUrl: file.path,
      destinationUrl: `${destinationFolder}/${resolvedName}`,
      overwrite: overwriteIfConflict && hasConflict,            // always false here
      nodeType: file.nodeType ?? DialFileNodeType.ITEM,
      ...metadata,
    };
  });
}

// uniqueName(name, existingNames, nodeType) — the naming algorithm
(name, existingNames, nodeType) => {
  if (!existingNames.has(name)) return name;
  const makeCandidate = nodeType === DialFileNodeType.FOLDER
    ? (base, n) => `${base} (${n})`
    : (base, n) => {
        const dot = base.lastIndexOf('.');
        const stem = dot > 0 ? base.slice(0, dot) : base;
        const ext = dot > 0 ? base.slice(dot) : '';
        return `${stem} (${n})${ext}`;
      };
  for (let n = 1; ; n++) {
    const candidate = makeCandidate(name, n);
    if (!existingNames.has(candidate)) return candidate;
  }
}
```

(Variable names above are de-minified for readability; the actual minified identifiers are `kv`, `h`/`resolveConflictsWithStrategy`, `$`/duplicate-handler in the bundle.)

This is the exact "file (1).pdf", "file (2).pdf" pattern the original roadmap asked us to build, already implemented, sourced from the file manager's own already-loaded folder listing (`getDestinationFiles`, populated from the `items` this app already passes in) — no server round-trip for name resolution, and no possibility of the app's naming logic drifting from what the grid/tree already display as "existing."

`isDuplicateFolderAvailable` — the prop gating whether folders can be duplicated at all — defaults to `true` in the bundle (`isDuplicateFolderAvailable: C = !0` in the destructured props of the internal file-manager component). This app's BFF already supports recursive folder copy (`copyFolderItem`), so there is no reason to override this default to `false`.

## Goals / Non-Goals

**Goals:**
- Add `DialFileManagerActions.Duplicate` to the `my_files`, WRITE-gated action-label set (grid, tree, bulk toolbar), matching Copy/Move/Rename's existing gating rule.
- Add one i18n key for the Duplicate label.
- Verify (with a regression test) that `onCopyFiles` — designed and already tested for cross-folder copy in `add-file-manager-copy-move` — behaves correctly when `destinationFolder === sourceFolder`, since that is exactly what ui-kit's `handleDuplicate` produces.
- Verify multi-select duplicate: duplicating several items at once, where ui-kit's naming resolution must avoid both the existing folder contents *and* collisions between the newly-duplicated items themselves.
- Formally spec this capability (`file-manager-duplicate`).

**Non-Goals:**
- Any new BFF endpoint, DTO field, or `onDuplicate` hook handler.
- Any naming-algorithm code in this app.
- Overriding `isDuplicateFolderAvailable` or `customDuplicateAction`.
- Duplicate on `shared`/`organization` tabs — out of scope, matches Copy/Move/Rename's existing `my_files`-only boundary in `file-manager-tabs`.

## Decisions

### D1 — No new hook handler; reuse `onCopyFiles` as-is

**Decision**: `useDialFileManager` gets no `onDuplicate` function. `DialFileManagerShell` passes the same `onCopyFiles` it already passes for Copy — ui-kit internally routes Duplicate through that same prop.

**Rationale**: verified directly in the compiled bundle (see Context) — there is no separate `onDuplicateFiles` prop on `DialFileManagerProps` to wire even if we wanted to; `onDuplicateSuccess` exists only as an internal callback within ui-kit's own composition hook and is not exposed on the public props surface, so it cannot be hooked from the app side regardless.

**Alternative considered**: pass `customDuplicateAction` and reimplement the naming/dispatch ourselves — rejected. This would duplicate (pun intended) already-correct, already-tested ui-kit logic, diverge from its conflict-set computation (which is guaranteed consistent with what the grid/tree currently render), and increase this app's maintenance surface for zero product benefit.

### D2 — `isDuplicateFolderAvailable` left at its default (`true`)

**Decision**: no prop is passed for `isDuplicateFolderAvailable`; ui-kit's default (`true`) stands.

**Rationale**: the only reason to set this to `false` would be if this app's backend couldn't handle recursive folder duplication — but it already can (`copyFolderItem`, shipped in `add-file-manager-copy-move`). Explicitly passing `true` would be a no-op that adds a line of code with no behavior change; omitting it is simpler and the default is not expected to change across minor ui-kit versions (per `apps/chat-api/AGENTS.md`'s sibling guidance for backend defaults: don't add code for behavior already covered by an existing default unless the design changes that default).

### D3 — New i18n key namespaced under `dialFileManager.*`, not `buttons.duplicate`

**Decision**: add `DialFileManagerI18nKeys.DuplicateAction = 'dialFileManager.duplicateAction'`, not reuse the existing `ButtonsI18nKeys.Duplicate = 'buttons.duplicate'` (already used elsewhere, for conversation duplication).

**Rationale**: matches the established pattern for every other file-manager action label (`RenameAction`, `DeleteAction`, `CopyAction`, `MoveAction` are all `dialFileManager.*`-namespaced, even though some happen to share English wording with generic `ButtonsI18nKeys` entries). Keeping the namespace separate means the file-manager Duplicate label can be translated/adjusted independently of the unrelated conversation-duplicate feature's wording, without coordinating a shared key across two features that have no other coupling.

### D4 — Regression test for the same-folder `onCopyFiles` edge case

**Decision**: add a test to `useDialFileManager.spec.tsx` that calls the hook's `onCopyFiles` with a `DialCopiedItem[]` whose `sourceUrl` and `destinationUrl` differ only by an incremented name segment within the *same* parent folder (simulating exactly what `handleDuplicate` produces), and asserts:
- The resulting `CopyItemDto[]` sent to the `copyFiles` server-api wrapper has `bucket`/`sourcePath` from the original item and `destinationPath` reflecting the incremented name.
- Cache invalidation still occurs correctly for the single affected folder (source and destination parent are the same key — invalidating it once is correct, not a bug, since `add-file-manager-copy-move`'s invalidation logic already collects affected folder keys into a `Set`, which naturally de-duplicates same-folder source/destination).
- No error/partial-failure toast fires on a clean success, matching the existing `onCopyFiles` behavior for ordinary cross-folder copy.

**Rationale**: `onCopyFiles` was designed and tested in `add-file-manager-copy-move` assuming (implicitly, not by any hard-coded check) that source and destination folders are typically different. Nothing in its implementation actually requires that — but this is worth a positive test rather than an assumption, per this repo's testing conventions (test names describe observable behavior).

## Risks / Trade-offs

**Dependence on ui-kit's internal `handleDuplicate` wiring** → if a future `@epam/ai-dial-ui-kit` upgrade changes how Duplicate dispatches (e.g. introduces a dedicated `onDuplicateFiles` prop, or changes the naming algorithm), this app's behavior changes silently since there is no app-level code enforcing the current contract. Mitigation: `apps/chat-api/AGENTS.md`'s sibling `AGENTS.md`-referenced UI Kit Breaking Changes procedure (check `CHANGELOG.md` for Breaking Changes entries on any ui-kit version bump) already covers this generally; the regression test in D4 also acts as an early-warning canary — if ui-kit stops routing Duplicate through `onCopyFiles`, the test's mocked `onCopyFiles`/`copyFiles` assertions would need updating, surfacing the change.

**Multi-select duplicate naming correctness depends entirely on ui-kit** → this app cannot independently verify the "(1)", "(2)" increment is collision-free across a batch without either re-testing ui-kit's own logic (out of scope — it's a third-party dependency) or relying on the existing BFF-side 409 safety net. Mitigation: the BFF's existing per-item 409→`"Conflict"` mapping (from `add-file-manager-copy-move`) is the residual safety net if ui-kit's client-side computation ever races with a concurrent write from another session — no new backend work needed, this net already exists.

## Migration Plan

1. Add `DialFileManagerI18nKeys.DuplicateAction` and the `en.json` entry.
2. Add `DialFileManagerActions.Duplicate` to `useDialFileManager`'s `actionLabels` computation for `my_files` when `uploadEnabled`.
3. Add `duplicateLabel` to `DialFileManagerShellLabels`; map it in `DialFileManagerShell.tsx`'s `actionLabels` `useMemo`.
4. Resolve `duplicateLabel` via `t(...)` in `DialFileManagerPage.tsx`.
5. Add the D4 regression test.
6. Write the `file-manager-duplicate` capability spec and the `file-manager-tabs` delta.

**Rollback**: remove the `Duplicate` entry from `actionLabels` — the action disappears from the UI; no data or contract changes to revert since nothing new was added to the BFF or the hook's request-building logic.

## Open Questions

- **`onDuplicateSuccess` is unreachable from the app** — there is no way to distinguish "duplicate succeeded" from "ordinary copy succeeded" in our own telemetry/notifications beyond what `onCopyFiles`'s existing success/failure toast already provides (which does not currently show a success toast on full success, per `add-file-manager-copy-move`'s design D_ — "copy is a background-ish action the user directly observes via the pasted item appearing"). If product feedback later wants a distinct "Duplicated" confirmation, it cannot be sourced from `onDuplicateSuccess`; it would need to be inferred client-side by detecting `destinationFolder === sourceFolder` before calling `onCopyFiles`'s existing logic — not attempted here since no such requirement exists in #7503's acceptance criteria.
