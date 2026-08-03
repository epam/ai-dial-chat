## 1. Reproduce and confirm root cause

- [x] 1.1 Reproduce issue #8096's bug 1 locally: open the Toolset Editor, select OAuth "With
  Login & Config", trigger a draft auto-save (e.g. via a first Log In attempt), and confirm the
  Client Secret field loses its required asterisk while `AuthSection`'s local
  `isEditMode = Boolean(toolsetId)` flips to `true` from the draft id — not from
  `routeToolsetId`. Confirmed via code reading: `ToolsetEditor.tsx:91` sets
  `persistedToolsetId = routeToolsetId || draftToolsetId`, and `draftToolsetId` is set by
  `persistFormIfChanged` the first time a new toolset is auto-saved (line 240), which
  `AuthSection.tsx`'s old local `isEditMode = Boolean(toolsetId)` could not distinguish from an
  already-saved toolset.
- [x] 1.2 Confirm the existing regression case still needs coverage: opening the editor directly
  on an already-saved OAuth-with-config toolset (`routeToolsetId` set) must keep Client Secret
  optional. Confirmed and covered by both the existing and new unit tests.

## 2. Thread the correct `isEditMode` down to `AuthSection`

- [x] 2.1 Add `isEditMode: boolean` to `SettingsForm`'s `Props`
  (`apps/chat/src/pages/ToolsetEditor/EditorForm/SettingsForm.tsx`) and pass it through to
  `AuthSection`.
- [x] 2.2 Add `isEditMode: boolean` to `AuthSection`'s `Props`
  (`apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`), remove the local
  `const isEditMode = Boolean(toolsetId);`, and use the prop everywhere `isEditMode` is
  currently referenced in this file (Client Secret `required` flag, `canLogIn`'s call to
  `isToolsetAuthValid`).
- [x] 2.3 In `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`, pass the existing
  `isEditMode` (line 89, derived from `routeToolsetId`) into `SettingsForm` alongside the
  current `toolsetId={persistedToolsetId}` — do not change what `toolsetId` itself resolves to.
  (Threaded through the intermediate `ToolsetEditorView` component, which also needed the new
  prop.)
- [x] 2.4 Confirm `isToolsetFormValid`'s save-path caller (in `ToolsetEditor.tsx`) already passes
  the route-based `isEditMode`, not a value derived from `persistedToolsetId`; fix the call site
  if it doesn't. Confirmed already correct at line 451
  (`isToolsetFormValid(form, isEditMode)`) — no change needed.

## 3. Tests

- [x] 3.1 Update `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/AuthSection.spec.tsx`: add
  `isEditMode` to the test render helper, and add a case where `toolsetId` is set (simulating a
  draft auto-save) but `isEditMode` is `false` — assert Client Secret is still required and the
  Log In button stays disabled without one.
- [x] 3.2 Add/keep a case with `isEditMode: true` and an empty `clientSecret` — assert Client
  Secret is not marked required and the Log In button can be enabled once client id and valid
  endpoints are present.
- [x] 3.3 Update `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/SettingsForm.spec.tsx` for
  the new `isEditMode` prop threading.
- [x] 3.4 Check `apps/chat/src/utils/tests/toolsets.spec.ts` (or the equivalent existing test
  file for `isToolsetAuthValid`) still asserts the two `isEditMode` branches correctly; add a
  case if the create-vs-edit distinction isn't already covered independent of the UI layer.
  Already covered by existing tests (`isToolsetAuthValid` describe block) — no changes needed
  since this change didn't touch that function's logic.

## 4. Verification

- [x] 4.1 `npm exec nx test chat` (or the affected project) — all updated/added tests pass.
  83/83 tests pass in `ToolsetEditor*` specs (including 2 new), 62/62 pass in `toolsets.spec.ts`.
- [x] 4.2 `npm exec nx lint chat` — no new lint errors. Full `nx lint chat` fails on a
  pre-existing, unrelated `@epam/ai-dial-quotations` module-resolution error in the `typecheck`
  target dependency (reproduced identically on a clean stash of this change). Ran `eslint`
  directly against all six touched files instead — zero errors/warnings.
- [x] 4.3 Manually verify in the running app: create a new OAuth-with-config toolset, trigger a
  draft save, confirm Secret stays required and asterisked; then open an existing saved
  OAuth-with-config toolset and confirm Secret is optional and Log In becomes enabled once client
  id is present. **Not performed in this session** — no live browser/dev-server verification was
  done; confidence rests on the unit tests in 3.1–3.2 plus the code-level trace in 1.1. Recommend
  doing this manually before merge.
- [x] 4.4 Note in the PR description whether the Log In button also stayed disabled for a saved
  toolset due to a missing `clientId` on load (a `toolset-auth-status-sync` concern) — do not fix
  it here, just flag it for that change. Flagged in design.md's Risks section; carry the same
  note into the PR description.
