## 1. Fix the confirmed badge-refresh bug

- [x] 1.1 In `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`'s `handleAuthChange`, change
  `if (patch.isLoggedIn === true)` to `if ('isLoggedIn' in patch)` so both a successful login and
  a successful logout trigger `refetchToolsets()`.
- [x] 1.2 Update the comment above the guard — it currently says "AuthSection only reports
  isLoggedIn=true after..."; rewrite it to explain both directions are confirmed-only patches.

## 2. Tests for the badge-refresh fix

- [x] 2.1 In `apps/chat/src/pages/ToolsetEditor/tests/ToolsetEditor.spec.tsx`, add/confirm a test
  that a logout (`onAuthChange({ isLoggedIn: false })` via the rendered `AuthSection`, or the
  mocked equivalent used by existing tests) triggers `refetchToolsets`. Added a
  `report-logout-success` button to the mocked `ToolsetEditorView` and a matching test
  `refetches toolsets after the auth section reports a successful logout`.
- [x] 2.2 Confirm the existing login-refresh test still passes unchanged with the widened guard.
  Confirmed — `refetches toolsets after the auth section reports a successful login` still
  passes.

## 3. Investigate the second symptom (Editor re-prompting login)

- [x] 3.1 Reproduce against a real DIAL Core-backed toolset: log in to an auth-configured
  toolset from the Editor, close the Editor via Cancel/back (without logging out), reopen the
  Editor for the same toolset. Record whether it shows logged-in or prompts to log in again.
  **Verified manually by the user against a real DIAL Core instance** with the task-1 fix
  applied: reopening the Editor correctly shows the logged-in state — it does not re-prompt
  login.
- [x] 3.2 If it shows logged-in correctly once the task-1 badge fix is applied — the reported
  symptom was the stale badge, not an independent Editor bug. Document this finding in the PR
  description and close out this change without further code changes for this symptom.
  **Confirmed**: this is the outcome — the "Editor re-prompts login" symptom in issue #8096 was
  the stale Catalog badge (fixed in task 1), not a separate Editor defect. No additional code
  change needed for this symptom.
- [x] 3.3 Not applicable — 3.2's outcome held, so no further investigation of Core-side status
  propagation was needed.

## 4. Verification

- [x] 4.1 `npm exec nx test chat -- ToolsetEditor` — all tests pass, including the new logout
  case. 21/21 tests pass in `ToolsetEditor.spec.tsx`, 84/84 across all `ToolsetEditor*` specs.
- [x] 4.2 Lint the touched files directly with `eslint` if the full `nx lint chat` is blocked by
  the pre-existing unrelated `@epam/ai-dial-quotations` typecheck failure (see prior change
  `toolset-auth-form-validation` for precedent). Ran `eslint` directly against
  `ToolsetEditor.tsx` and `ToolsetEditor.spec.tsx` — zero errors/warnings.
- [x] 4.3 Manually verify in the running app: log out of a toolset in the Editor, navigate to the
  Catalog, confirm the badge updates without a manual refresh. **Verified manually by the user**
  — the badge updates immediately after logout without a manual page refresh.
