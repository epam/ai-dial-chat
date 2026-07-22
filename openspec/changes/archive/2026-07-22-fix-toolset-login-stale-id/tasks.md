## 1. Propagate the persisted toolset id through `onEnsureSaved`

- [x] 1.1 In `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`, change `handleEnsureSaved` to
      return `(await persistFormIfChanged()) ?? false` instead of coercing the result to
      `boolean`, so it resolves to `string | false`.
- [x] 1.2 Update the `onEnsureSaved` prop type on `AuthSection` (in
      `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`'s `Props`) from
      `() => Promise<boolean>` to `() => Promise<string | false>`. Also updated the two
      intermediate pass-through components in the prop chain (`ToolsetEditorView.tsx`,
      `EditorForm/SettingsForm.tsx`) to the same type — not anticipated by the design doc, but
      required for the chain to typecheck end-to-end.

## 2. Use the returned id in `AuthSection.handleLogIn`

- [x] 2.1 In `handleLogIn` (`AuthSection.tsx`), capture the result of `onEnsureSaved()` into a
      local (e.g. `savedToolsetId`) and `return` early when it is `false`, same as today's
      `if (!saved) return;` check.
- [x] 2.2 Replace the `toolsetId` argument in `initiateOAuthLogin(auth, toolsetId)` with
      `savedToolsetId`.
- [x] 2.3 Replace the `toolsetId` argument in the Cancelled-result recheck `getToolset(toolsetId)`
      with `savedToolsetId`.
- [x] 2.4 Replace both the `url: toolsetId` field in the API-key `ToolsetLoginBodyDto` and the
      `loginToolset(toolsetId, body)` call with `savedToolsetId`.
- [x] 2.5 Leave every other use of the `toolsetId` prop in `AuthSection.tsx` (e.g. `isEditMode`,
      `handleConfirmLogout`) unchanged — they run before or independent of the persist step and
      are not stale.

## 3. Tests

- [x] 3.1 In `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/AuthSection.spec.tsx`, add a
      case: `onEnsureSaved` resolves to a freshly created id (distinct from the `toolsetId` prop
      passed in, simulating a brand-new toolset), clicking "Log In" (OAuth path) calls
      `initiateOAuthLogin` with that returned id, not the stale prop.
- [x] 3.2 Add the equivalent case for the API-key login path: `loginToolset` is called with the
      id `onEnsureSaved` resolved to.
- [x] 3.3 Add a case confirming that when `onEnsureSaved` resolves to `false`, `handleLogIn`
      returns without calling `initiateOAuthLogin` / `loginToolset` (existing failure-path
      behavior preserved) — already covered by the pre-existing "does not open a popup when
      saving unsaved changes fails" and "does not attempt to log in when saving unsaved changes
      fails" tests; no new test needed.
- [x] 3.4 In `apps/chat/src/pages/ToolsetEditor/tests/ToolsetEditor.spec.tsx`, verify
      `handleEnsureSaved`/`onEnsureSaved` resolves to the id `persistFormIfChanged` returns
      (covering both the create-new-toolset case and the unchanged-form short-circuit case),
      not just a boolean. Added an `invoke-ensure-saved` hook to the mocked `ToolsetEditorView`
      to exercise `onEnsureSaved` directly and render its resolved value for assertions.

## 4. Verify

- [x] 4.1 `npm exec nx test chat -- src/pages/ToolsetEditor` passes: 5 test files, 72 tests, all
      green (includes 2 new `AuthSection.spec.tsx` cases and 2 new `ToolsetEditor.spec.tsx`
      cases).
- [x] 4.2 `npm exec nx lint chat` passes with 0 errors (20 pre-existing warnings unrelated to
      this change remain, e.g. non-null-assertion warnings in `apply-chunk.spec.ts`).
- [x] 4.3 Manually verify in the running app: create a brand-new toolset, fill in OAuth or
      API-key settings, click "Log In" once — login succeeds on the first click.
