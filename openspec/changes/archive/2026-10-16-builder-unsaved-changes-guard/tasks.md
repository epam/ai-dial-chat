# Tasks

**Slicing strategy: risk-first, then vertical.**

1. Prove the data-router switch first. It carries the highest risk and changes no behaviour.
2. Build the context, the hook and the guarded Log out.
3. Wire one builder end to end. Custom App / Schema App goes first because it needs no lib change.
4. Widen to the other builders one at a time. Each slice can be verified on its own.

The design is in `design.md`. The requirements are in `specs/**`.

## 1. Data router migration (risk-first, no behaviour change)

- [x] 1.1 In `apps/chat/src/main.tsx`:
  - Move the provider stack and the existing `<Routes>` (`NotificationProvider` … `</Routes>`) into an `AppRoot` component. (Implemented in its own module, `apps/chat/src/AppRoot.tsx`, so the spec can render it without `main.tsx`'s root-mount side effects.)
  - Create a module-scope `createBrowserRouter([{ path: '*', element: <AppRoot /> }])`.
  - Render `<RouterProvider router={router} />` in place of `<BrowserRouter>`.
  - Keep `RootErrorBoundary` and `#interactive-tooltip-portal` outside the router.
- [x] 1.2 Add `apps/chat/src/tests/main-router.spec.tsx`. It renders `AppRoot` under `createMemoryRouter` and asserts two things:
  - a probe calling `useBlocker(false)` does not throw;
  - `/login` still resolves to the login page.

**Verification:** `npm run test:file -- apps/chat/src/tests/main-router.spec.tsx`, then `npm run verify:changed` and `npm run build:quiet` (bundling is affected).

## 2. Context, guard hook, i18n and Log out

- [x] 2.1 Add these keys to `apps/chat/src/i18n/locales/en.json`, plus an `UnsavedChangesI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`:

  | Key | Copy |
  |---|---|
  | `unsavedChanges.title` | "Discard unsaved changes?" |
  | `unsavedChanges.message` | "You have unsaved changes. Leaving now will discard them." |
  | `unsavedChanges.confirmLabel` | "Discard changes" |
  | `unsavedChanges.cancelLabel` | "Keep editing" |

- [x] 2.2 Implement `apps/chat/src/context/UnsavedChangesContext.tsx` (design D2, `ThemeContext` pattern):
  - `UnsavedChangesProvider` holds the registration, the pending dialog actions and `unloadAllowedRef`.
  - It renders one `ConfirmationDialog` (`ConfirmationPopupVariant.Danger`) with the `unsavedChanges.*` labels.
  - Wrap the context value in `useMemo`.
  - Export `useUnsavedChanges()`, which returns `hasUnsavedChanges` and `requestDiscard` and throws outside the provider.
  - Export an internal hook for `register`, `open` and `unloadAllowedRef`.
- [x] 2.3 Mount `UnsavedChangesProvider` inside the authenticated branch of `AppRoot` (`apps/chat/src/AppRoot.tsx`), wrapping `<App />`.
- [x] 2.4 Implement `apps/chat/src/hooks/unsaved-changes/useBuilderLeaveGuard.ts` (design D2):
  - Register `isDirty` with the context, and unregister on unmount.
  - Use `useBlocker` with a ref-stable predicate: block on a pathname or search change, never on a hash-only change.
  - When the blocker reaches the `blocked` state, open the dialog wired to `proceed`/`reset`.
  - Add a one-shot `allowNextNavigation`.
  - Register a `beforeunload` listener while dirty, skipped when `unloadAllowedRef` is set.
  - In JSDoc, explain why refs are used and why the hook is page-level only.
- [x] 2.5 In `apps/chat/src/hooks/logout/useLogout.ts`, add `performLogout`, moving `LogoutConfirmationModal`'s confirm body there unchanged. `apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx` then calls it.
- [x] 2.6 In `apps/chat/src/components/Navigation/Navigation.tsx`, add a `handleLogout` (`useCallback`):
  - while `hasUnsavedChanges`, call `requestDiscard(performLogout)`;
  - otherwise, call `openLogout`.

  Pass it to both `UserMenu` and `NavigationSheet`.
- [x] 2.7 RTL: add no directional icon and use only logical Tailwind classes on any added wrapper. Add an `rtl` render assertion in the context spec: both buttons are present by role and no mirroring class is applied.
- [x] 2.8 Write unit tests in `apps/chat/src/context/tests/UnsavedChangesContext.spec.tsx`:
  - `useUnsavedChanges` throws outside the provider;
  - `hasUnsavedChanges` follows the registration;
  - in `requestDiscard`, Discard changes runs the callback once, while Keep editing and Escape do not;
  - the dialog has the accessible name "Discard unsaved changes?" and exactly two buttons.
- [x] 2.9 Write unit tests in `apps/chat/src/hooks/unsaved-changes/tests/useBuilderLeaveGuard.spec.tsx`, using `createMemoryRouter` + `RouterProvider` + the provider:
  - a clean builder passes navigation through;
  - while dirty, PUSH, REPLACE and POP (`router.navigate(-1)`) are blocked;
  - hash-only changes pass;
  - Discard changes lands on the chosen location;
  - Keep editing keeps the location;
  - `allowNextNavigation` lets exactly one transition through;
  - `beforeunload` is registered only while dirty, is skipped after `requestDiscard` confirms, and is removed on unmount.
- [x] 2.10 Update `apps/chat/src/components/Navigation/tests/Navigation.spec.tsx` (`apps/chat/src/components/LogoutConfirmation/tests/LogoutConfirmationModal.spec.tsx` needed no change: it mocks the same modules `useLogout` now calls, and still passes):
  - dirty Log out opens the unsaved-changes dialog and not the logout modal;
  - Keep editing does not call `logout`;
  - Discard changes calls `logout` once and opens no modal;
  - clean Log out opens the modal as before;
  - the mobile-sheet Log out follows the same branch.

**Verification:**
- `npm run test:file -- apps/chat/src/context/tests/UnsavedChangesContext.spec.tsx`
- `npm run test:file -- apps/chat/src/hooks/unsaved-changes/tests/useBuilderLeaveGuard.spec.tsx`
- `npm run test:file -- apps/chat/src/components/Navigation/tests/Navigation.spec.tsx`
- `npm run test:file -- apps/chat/src/components/LogoutConfirmation/tests/LogoutConfirmationModal.spec.tsx`

Then run `npm run verify:changed`.

## 3. Vertical slice: Custom App and Schema App (`ApplicationFormEditor`)

- [x] 3.1 Add Setup dirtiness in `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`:
  - add `setupBaselineRef` and a deep-equal comparison;
  - re-capture the baseline during `SchemaAppSetup` initialisation, meaning the required-properties sync and `onDefaultValues` (design D5), with the narrowest signal needed in `apps/chat/src/pages/ApplicationEditor/setup/SchemaAppSetup.tsx`;
  - set `isDirty = metadata.isDirty || setupDirty`.
- [x] 3.2 Call `useBuilderLeaveGuard({ isDirty })` in `ApplicationFormEditor`. Call `allowNextNavigation()` before the post-save `navigate(returnUrl)` and before `switchToCreatedApp`. Keep `handleCancel` as a plain `navigate(ROUTES.Catalog)`.
- [x] 3.3 Test in `apps/chat/src/pages/ApplicationEditor/tests/customAppDefinition.spec.tsx` and `apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx`, moving the guard cases to `createMemoryRouter` + provider:
  - a freshly mounted schema app is clean;
  - editing Name and then clicking a nav link opens the dialog;
  - Discard changes lands on the chosen route with no request;
  - Keep editing keeps the values;
  - a successful Save exits without the dialog.

**Verification:** `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/customAppDefinition.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx`, then `npm run verify:changed`.

## 4. Vertical slice: Quick App (iframe dirty state)

- [x] 4.1 Add `DirtyState = 'DIRTY_STATE'` to `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`, and update the `ValidityState` doc comment.
- [x] 4.2 Update `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`:
  - handle `DIRTY_STATE` with the same source and origin checks as `VALIDITY_STATE`, accepting only a boolean `isDirty`;
  - reset to `false` on `SAVE_SUCCESS` and on reload;
  - expose the value through `onDirtyChange`, forward it through `apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`, and OR it into `ApplicationFormEditor`'s `isDirty`.
- [x] 4.3 Test:
  - in `apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx`: an own-window message reports `true`; foreign-window and non-boolean messages are ignored; `SAVE_SUCCESS` clears the state;
  - in `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`: a dirty iframe opens the dialog on navigation, and Discard changes lands on the chosen route.

**Verification:** `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`, then `npm run verify:changed`.

## 5. Vertical slice: Scheduled task pages

- [x] 5.1 Update `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx`:
  - stop passing `initialValues` and the `discard*` labels to `ScheduledTaskCreateForm`;
  - set `isDirty = hasScheduledTaskFormChanges(values, DEFAULT_VALUES)`;
  - wire `useBuilderLeaveGuard`;
  - call `allowNextNavigation()` before the post-save navigation.
- [x] 5.2 Make the same changes in `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`, using the hydrated values as the baseline. Keep `isDirty` `false` until the task has loaded.
- [x] 5.3 Remove the now-unused `discard*` labels from `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskFormLabels.ts`. Leave the lib's `labels.discard*` API untouched.
- [x] 5.4 Test in `apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx` and `apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx`:
  - editing the form and clicking a nav item opens the shared dialog exactly once;
  - Discard changes lands on the chosen route;
  - a pristine or reverted form leaves immediately;
  - a successful create or update exits without the dialog.

**Verification:** `npm run test:file -- apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ScheduledTaskEditPage/tests/ScheduledTaskEditPage.spec.tsx`, then `npm run verify:changed`.

## 6. Vertical slice: Skill

- [x] 6.1 Update `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`:
  - remove `useUnsavedChangesGuard` and its `ConfirmationPopup`;
  - make Cancel, and Back from `SKILL.md`, call `navigateAway` directly; Back from a supporting file stays non-navigating;
  - wire `useBuilderLeaveGuard({ isDirty })`;
  - call `allowNextNavigation()` before the success `onNavigate`.
- [x] 6.2 Update `apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`, mocking `useBuilderLeaveGuard`:
  - the hook receives the dirty state;
  - Cancel and Back call `navigate` unguarded;
  - Back from a supporting file does not navigate;
  - success calls `allowNextNavigation` before navigating.

  Remove the old popup assertions.

**Verification:** `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`, then `npm run verify:changed`.

## 7. Vertical slice: Prompt

- [x] 7.1 In `libs/prompt-editor/src/components/PromptEditor/PromptEditor.tsx` and `libs/prompt-editor/src/models/prompt-editor-props.ts`, add `onDirtyChange`. When it is provided:
  - report the dirty state on mount and on every change;
  - skip the built-in `ConfirmationDialog` and `beforeunload`;
  - have Back and Cancel call `onBack`/`onCancel` directly.

  **Architecture guard:** add no routing, i18n, app context or host URL.
- [x] 7.2 Update `apps/chat/src/pages/PromptEditor/PromptEditor.tsx`:
  - pass `onDirtyChange` and wire `useBuilderLeaveGuard`;
  - drop the `discard*` label wiring;
  - call `allowNextNavigation()` before the post-save `navigate(returnUrl)`.
- [x] 7.3 Remove the `skillEditor.unsavedChanges*` keys from `apps/chat/src/i18n/locales/en.json`, and the matching `SkillEditorI18nKeys` members from `apps/chat/src/constants/translation-keys.ts`, now that no caller remains.
- [x] 7.4 Update `libs/prompt-editor/README.md` (props table and example for `onDirtyChange`), then run `npm run validate:docs`.
- [x] 7.5 Test:
  - in `libs/prompt-editor/src/components/PromptEditor/tests/PromptEditor.spec.tsx`: with `onDirtyChange`, Cancel calls `onCancel` immediately and the callback reports `true` then `false` across an edit and its revert; without it, the old dialog still opens;
  - in `apps/chat/src/pages/PromptEditor/tests/PromptEditor.spec.tsx`, mocking the guard hook: the wiring is correct, and a successful save calls `allowNextNavigation` before navigating.

**Verification:** `npm run test:file -- libs/prompt-editor/src/components/PromptEditor/tests/PromptEditor.spec.tsx` and `npm run test:file -- apps/chat/src/pages/PromptEditor/tests/PromptEditor.spec.tsx`, then `npm run verify:changed`.

## 8. Vertical slice: Toolset

- [x] 8.1 In `libs/toolset-editor/src/components/ToolsetEditor/ToolsetEditor.tsx`:
  - add `onDirtyChange`, fed by one comparison of the whole form — Metadata and Setup — against a baseline that is the seeded form and then the last persisted one;
  - report `false` after a successful `persistFormIfChanged`, before the Log In continues.
  - (The original plan OR'd `metadata.isDirty` with a Settings-only baseline. `useMetadataForm`'s `reset(values)` can re-baseline it, but it also clears `touched` and the submit-attempt count, so a Log In draft persist mid-edit would hide the Metadata validation errors already on screen; a whole-form baseline kept in the editor avoids that. The OAuth login runs in a popup, so the page itself never redirects; clean is reported synchronously right after the persist.)

  **Architecture guard:** add no routing, `/api` path or app context.
- [x] 8.2 Update `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`:
  - hold the dirty state and wire `useBuilderLeaveGuard`;
  - keep `handleBack` as a plain navigation;
  - call `allowNextNavigation()` in `onSaveComplete`.
- [x] 8.3 Update `libs/toolset-editor/README.md` with the new prop, then run `npm run validate:docs`.
- [x] 8.4 Test:
  - in `libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`: dirty is reported on edit and on revert; Log In reports clean once its draft persist succeeds, and stays dirty when it fails;
  - in `apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`: a dirty nav click opens the dialog; a successful save exits without the dialog.

**Verification:** `npm run test:file -- libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx` and `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`, then `npm run verify:changed`.

## 9. Docs and close-out

- [x] 9.1 Update `docs/architecture.md`:
  - change the `main.tsx` line to "createBrowserRouter + RouterProvider (single splat route) + the provider stack";
  - add `UnsavedChangesContext` to the contexts list, with a one-line note on the builder leave guard.
- [x] 9.2 Fix the `openspec/config.yaml` context wording:
  - "Routing: React Router v6 (BrowserRouter…)" should give the actual version and the data-router setup;
  - "main.tsx — wraps app in BrowserRouter" should be corrected the same way.
- [x] 9.3 Run `npm run validate:docs` and `npm run validate:specs`.
- [x] 9.4 Follow-up (recorded only, out of scope): confirm the `DIRTY_STATE` payload with the QuickApps team (design Open Question 1).
- [x] 9.5 Run `npm run verify:full` once. (typecheck, lint, format and every project's tests pass; the one failure, `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` "model undefined", is unrelated: a local `apps/chat-api/.env` sets `UTILITY_MODEL`, which leaks into `ConfigService` during the full run. It passes on its own.)

## Implementation notes

- `AppRoot` lives in `apps/chat/src/AppRoot.tsx`, not inside `main.tsx`, so specs can render it without the root mount.
- Builder page specs that render real routes use `apps/chat/src/hooks/unsaved-changes/tests/render-with-leave-guard.tsx` (data router + provider; `rerenderRoutes` for mock-driven re-renders).
- `AppEditorIframe` reads `isDirty` from `payload.isDirty` (like `VALIDITY_STATE`) or from the message itself, accepting only a boolean, while the payload is unconfirmed (9.4).
- `ApplicationFormEditor` re-baselines Metadata and Setup after a metadata-first create switches the page into edit mode, so the saved app does not read as dirty.
- `useBuilderLeaveGuard` closes the dialog it opened once its blocked transition is gone unanswered (the blocker left `blocked`, or the builder unmounted): a Save that completes behind the open dialog and navigates away no longer leaves a stale dialog whose Discard would run a dead `proceed()`. `UnsavedChangesContext`'s internal `open` returns that close callback; it never closes a newer request such as Log out.
