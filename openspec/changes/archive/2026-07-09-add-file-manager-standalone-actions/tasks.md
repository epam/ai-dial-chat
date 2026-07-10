## 1. Resolve the deferred actionProfile branch

- [x] 1.1 In `apps/chat/src/hooks/files/useDialFileManager.ts`'s `actionLabels` `useMemo`, wrap the existing `labels[DialFileManagerActions.Copy] = ...`, `labels[DialFileManagerActions.Move] = ...`, and `labels[DialFileManagerActions.Duplicate] = ...` assignments in an additional `actionProfile !== DialFileManagerActionProfile.Attach` condition, inside the existing `if (uploadEnabled)` block. Leave the `Rename` and `Delete` assignments unconditional on `actionProfile`, exactly as today
- [x] 1.2 Add `actionProfile` to the `actionLabels` `useMemo`'s dependency array
- [x] 1.3 Remove the placeholder comment (`// actionProfile is not yet branched on below...`) and the exhaustiveness-only `switch (actionProfile) { ... }` block near the top of the hook. Confirm `DialFileManagerActionProfile`'s exhaustiveness is still enforced somewhere `actionProfile` is consumed (the new conditional's `!==` comparison against a specific enum member does not by itself protect against a future added enum member — if the removed `switch`'s exhaustiveness guarantee needs to be preserved, keep a minimal exhaustive `switch`/lookup at the point where `actionProfile` is read, per design.md D3)
- [x] 1.4 Run `npm exec nx lint chat` — must pass (confirms no unused imports/dead code left from the removed switch)

## 2. Regression tests — attach modal excludes Copy/Move/Duplicate

- [x] 2.1 Add tests to `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx`: `variant=Attach` (→ `actionProfile=Attach`) with `my_files` + WRITE permission does NOT include `Copy`/`Move`/`Duplicate` in `actionLabels`, but DOES include `Rename` and `Delete`
- [x] 2.2 Add a test confirming `variant=Standalone` (→ `actionProfile=Browse`) with `my_files` + WRITE permission includes all six actions (Download, Delete, Rename, Copy, Move, Duplicate) — a regression guard that this change does not accidentally narrow the standalone matrix while fixing attach
- [x] 2.3 Add a test confirming `shared`/`organization` tabs show Download only, unaffected by `actionProfile`, for both `Attach` and `Browse`
- [x] 2.4 Run `npm exec nx test chat` — must pass

## 3. Component-level regression coverage

- [x] 3.1 Add a test to `apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx` (or extend an existing one) asserting the rendered file manager's `my_files` row/tree/bulk menus do not surface Copy/Move/Duplicate labels
- [x] 3.2 Add or extend a test in `apps/chat/src/pages/DialFileManagerPage/tests/DialFileManagerPage.spec.tsx` asserting `my_files` continues to surface Copy/Move/Duplicate/Rename/Delete, and `shared`/`organization` surface Download only — matching the acceptance-criteria wording ("Copy/Move/Duplicate menu items present on my_files; Share/Info absent" — Share/Info were never added by any prior slice, so their absence needs no new code, only a test asserting they are indeed absent)
- [x] 3.3 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 4. Full verification and OpenSpec docs

- [x] 4.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
- [x] 4.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass (pre-existing, unrelated prettier error in `apps/chat/src/pages/auth/Login.tsx` remains; confirmed byte-identical to `origin/development-1.0`, not touched by this change)
- [x] 4.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
- [x] 4.4 Confirm no backend/OpenAPI changes were introduced (this slice is frontend-only) — `git status` on `apps/chat-api/` and `libs/chat-api-client/` should show no changes from this slice
- [x] 4.5 Confirm `DialFileManagerPage.tsx` still passes `actionProfile: DialFileManagerActionProfile.Browse` (not changed to `Full`) — a verification step per design.md D2, not a code change
