## Context

`useDialFileMutations` (`apps/chat/src/hooks/files/useDialFileMutations.ts`) exposes two independent callbacks to the vendor `DialFileManager` component (`@epam/ai-dial-react-file-manager`):

- `onCreateFolderValidate(name, parentFolder): string | null` (lines 198-225) — synchronous, client-side validation only (empty name, forbidden symbols, leading dot, reserved marker name, length, sibling conflict).
- `onCreateFolder(_file, newFolderPath, _fileId): Promise<void>` (lines 148-196) — parses `newFolderPath` into `{ parentVirtualPath, name }`, resolves the target bucket/path, and calls the `createFolder` BFF endpoint unconditionally.

The existing `file-manager-folder-creation` spec documents `onCreateFolderValidate` as "Called by `DialFileManager` during name input (before `onCreateFolder`)" — i.e. the spec assumes the vendor component gates confirmation on the validation result. Issue #7968 demonstrates that assumption doesn't hold in the Publish/file-manager UI: pressing Enter (or clicking the folder row) while a validation error is showing still triggers `onCreateFolder`. Since `onCreateFolder` trusts the caller, the invalid folder gets created anyway.

The BFF's own `CreateFolderDto` validation (`@Matches`, `@IsNotEqual(MARKER_NAME)`) and the `409` marker-conflict check are a separate, already-independent safety net — they are unaffected by this change and remain the authoritative backstop.

## Goals / Non-Goals

**Goals:**
- Make `onCreateFolder` defend itself: re-run `onCreateFolderValidate` against the resolved `name`/`parentFolder` before calling `createFolder(...)`, and no-op (no BFF call, no `isCreatingFolder` flicker) when validation fails.
- Keep `onCreateFolderValidate`'s rules as the single source of truth — no duplicated validation logic.
- Preserve current behavior for valid input exactly (same BFF call shape, same cache-merge, same error-toast-on-failure behavior).

**Non-Goals:**
- Changing the vendor `DialFileManager` component or its Enter-key/confirm handling.
- Changing backend validation (`CreateFolderDto`) or the marker-conflict (`409`) logic.
- Guaranteeing the sibling-duplicate pre-check is accurate for every call site (see Decision 2) — the server-side `409` check remains authoritative for conflicts, exactly as the existing spec already states ("best-effort pre-check").

## Decisions

1. **Re-validate inside `onCreateFolder` itself, not by hardening the vendor contract.** Alternative considered: report the gap upstream to `@epam/ai-dial-react-file-manager` and wait for a fix. Rejected as the sole remedy — the vendor package is out of this repo's control, and the hook can close the gap unilaterally without waiting on an external release.

2. **Resolving `parentFolder: DialFile` for the validation call.** `onCreateFolder` only receives `newFolderPath` (a full virtual path); the hook already has `currentFolder: DialFile | undefined` (the currently browsed folder) via `UseDialFileMutationsOptions`, but the code comment above the hook notes folders can be created from a destination-folder popup browsing a *different* folder than the outer grid — so `currentFolder` is not always the right parent.
   - Decision: after computing `parentApiPath` via `parseNewFolderVirtualPath`, use `currentFolder` directly when `currentFolder`'s resolved path matches `parentApiPath` (the common case: creating in the folder currently being browsed). When it doesn't match (the destination-popup case), build a minimal `DialFile` shim (`{ id, path: parentApiPath, name, folderId, nodeType: DialFileNodeType.FOLDER, items: [] }`) with an empty `items` array.
   - Consequence: the empty-name/forbidden-symbols/leading-dot/reserved-name/length checks always run correctly (they don't depend on `items`); the sibling-duplicate check only has real sibling data when `currentFolder` matches, otherwise it degrades to "no known siblings" and relies on the BFF's `409` response — consistent with the existing spec's framing of the client-side conflict check as a best-effort pre-check, not a behavior regression.
   - Alternative considered: thread the full per-folder `cache: Map<string, ListFilesItemDto[]>` (owned by `useDialFileListing`) into `useDialFileMutations` so `onCreateFolder` can always look up accurate siblings. Rejected for this fix's scope — it would require converting `ListFilesItemDto[]` cache entries to `DialFile[]` inline (a mapping that doesn't currently exist in this hook) purely to strengthen a check that is already explicitly best-effort and already has an authoritative server-side backstop. Revisit only if a future bug report shows the degraded case causing real user-facing false negatives.

3. **No new error UI.** `onCreateFolder`'s new early-return doesn't surface its own message — `DialFileManager` already renders `onCreateFolderValidate`'s error inline as the user types/confirms. The defensive check only prevents the BFF call and silently keeps the invalid state as-is; no double-error flicker.

## Risks / Trade-offs

- [Risk] The `parentFolder` shim used in the destination-popup case has an empty `items` array, so a genuine sibling-name conflict created via that path won't be caught client-side → Mitigation: the BFF's marker-probe `409` check is authoritative and unaffected; `DialFileManager` already surfaces BFF errors inline (existing behavior, per spec: "failures (including 409) propagate to `DialFileManager`").
- [Risk] Duplicate validation (vendor's own check plus this hook's re-check) adds one extra synchronous function call per confirm attempt → Mitigation: `onCreateFolderValidate` is already a pure, synchronous, cheap function (no BFF call); negligible cost.
- [Trade-off] This is a defensive/duplicative fix by design (the hook re-checks what the vendor component was already supposed to check) — acceptable since it closes the reported bug immediately without depending on an external package update.

## Migration Plan

No data migration; pure client-side logic change with no BFF contract change. Ships as a normal patch. Rollback is a straight revert of the hook change.

## Open Questions

None — the fix location and validation source are both confirmed and already exist in the codebase.
