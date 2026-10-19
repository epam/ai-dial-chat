## Why

Users can lose unsaved work in a builder without any warning. "Builder" here means any editor reached from the Catalog **Create** button: Quick Apps and other schema apps, Custom App, Toolset, Skill and Prompt. The Scheduled task create/edit form is included as well. Today, clicking Chat, Scheduler, Catalog, Files or Settings in the navigation rail, using the mobile navigation sheet, pressing the browser Back button, or logging out simply leaves the editor.

The warning exists only in part of the app today:

- The Skill and Prompt editors and the Scheduled task form confirm only their **own** Back/Cancel buttons. They do this through `useUnsavedChangesGuard` (`libs/chat-shared/src/hooks/useUnsavedChangesGuard.ts:16`), which shows the two-option "Discard unsaved changes?" dialog with **Keep editing** and **Discard changes**.
- The application editors (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx:275`) and the Toolset editor have no guard at all.
- Log out is actively harmful today. `LogoutConfirmationModal` awaits `logout()` on the server and only then calls `window.location.replace` (`apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx:25,44`). So the browser's `beforeunload` prompt, where one exists, fires after the session is already gone.
- Router-level interception is impossible today. The app mounts `<BrowserRouter>` (`apps/chat/src/main.tsx:54`), and react-router's `useBlocker` requires a data router (`node_modules/react-router/dist/development/lib/hooks.js:1248`).

## What Changes

- **Data router.** `<BrowserRouter>` in `apps/chat/src/main.tsx` is replaced by `createBrowserRouter` + `<RouterProvider>`. A single splat root route renders the existing provider stack and the descendant `<Routes>`, unchanged. This is required for `useBlocker`.
- **One guard for every builder.**
  - A new `UnsavedChangesContext` (`apps/chat/src/context/`) owns the single unsaved-changes dialog.
  - Each builder page calls a new `useBuilderLeaveGuard({ isDirty })` (`apps/chat/src/hooks/`). It blocks every in-app location change while the builder is dirty: `<Link>`, `navigate()`, the nav rail, the mobile sheet, Settings, overlay-host navigation, and browser Back/Forward.
  - While dirty, the hook also keeps the browser's `beforeunload` warning on.
- **The dialog stays the familiar two-option one.**

  | Element | Copy | Key |
  |---|---|---|
  | Title | "Discard unsaved changes?" | — |
  | Message | "You have unsaved changes. Leaving now will discard them." | — |
  | Confirm button | **Discard changes** | `unsavedChanges.confirmLabel` |
  | Cancel button | **Keep editing** | `unsavedChanges.cancelLabel` |

  - **Discard changes** continues to the destination the user chose.
  - **Keep editing** keeps the user on the builder with the edits intact.
  - The existing copy moves from `skillEditor.unsavedChanges*` to neutral `unsavedChanges.*` keys.
  - The confirm label becomes "Discard changes", which the scheduled-task lib already uses as its default. The Skill, Prompt and Scheduled task pages currently show "Discard".
- **Back/Cancel inside a builder** become plain navigations that the router guard intercepts, so the same dialog shows everywhere. The Skill page drops its own `useUnsavedChangesGuard`. The Prompt and Scheduled task pages opt out of their libs' built-in guards, so no second dialog ever appears.
- **Log out while dirty.**
  - Log out first shows the same dialog. **Keep editing** leaves the user signed in on the builder.
  - **Discard changes** logs out directly, without the second "Log out?" confirmation, and without the native unload prompt.
  - With a clean builder, or outside builders, Log out behaves exactly as today.
- **Dirty reporting per builder:**

  | Builder | Change |
  |---|---|
  | `ApplicationFormEditor` | Uses `useMetadataForm`'s `isDirty` plus a Setup baseline. For Quick Apps, also the iframe's `DIRTY_STATE` message, which is ignored today. |
  | `libs/toolset-editor` | Gains `onDirtyChange`. |
  | `libs/prompt-editor` | Gains `onDirtyChange`. Passing it turns the lib's built-in guard off. |
  | Skill | Keeps its existing `onDirtyChange`. |
  | Scheduled task pages | Compute `hasScheduledTaskFormChanges` themselves and stop passing `initialValues`. |

## Capabilities

### New Capabilities
- `builder-unsaved-changes-guard`: the cross-builder leave guard. It covers which navigations are blocked, the two-option dialog and its outcomes, `beforeunload`, the guarded Log out, the per-builder dirty contract, accessibility and i18n.

### Modified Capabilities
- `navigation-routing`: the router is mounted as a data router (`createBrowserRouter` + `RouterProvider`).
- `skill-editing`: "Dirty-navigation guard" now covers any navigation away, not just Cancel/Back, through the shared guard. The Back control on a supporting file stays unguarded.
- `skill-authoring`: the Cancel scenario uses the shared `unsavedChanges.*` dialog.
- `scheduled-task-create-form`: both app pages stop passing `initialValues` and use the shared guard. The lib's opt-in behaviour stays for other hosts.
- `prompt-editor`: adds `onDirtyChange`, which also turns the lib's built-in guard off.
- `toolset-authoring`: adds `onDirtyChange`, and reports clean after the Log In draft persist, before the login continues.
- `app-editor-flow`: `AppEditorIframe` consumes the iframe's `DIRTY_STATE` message.
- `user-menu`: Log out asks about unsaved changes first while a builder is dirty.

## Non-goals

- A **Save** option in the dialog. This was considered and dropped by product: the dialog keeps the current two options.
- A custom dialog for other full-page unloads: tab close, reload, the `<a href="/">` logos, and OAuth redirects. Browsers allow only their native `beforeunload` prompt there.
- Autosave or draft persistence.
- Guarding non-builder surfaces such as Settings, catalog panels, the file manager or the chat input.
- Rewriting route declarations into a route-object tree, or adopting loaders/actions.

## Alternatives considered

| Option | Correctness | Cost / risk | Verdict |
|---|---|---|---|
| **A. Data router + `useBlocker` (picked)** | Catches every in-app transition, including Back/Forward | One-time `main.tsx` change. Tests of the guard need `createMemoryRouter`. | Picked. It is the only option that covers Back/Forward. |
| B. A context that every nav entry point must call | Misses Back/Forward and stray `navigate()` calls | Every current and future entry point must remember to use it | Rejected for navigation. It is used only for Log out, which is not a router transition. |
| C. Wrap `UNSAFE_NavigationContext.navigator` | POP needs a fragile history re-push hack | Relies on an unstable API | Rejected |
| D. Baseline: extend per-button guards to the app and toolset editors | Does not address the ticket (rail and sheet) | Low | Rejected |

Log out alternatives:

1. **Picked:** dirty → unsaved-changes dialog → **Discard changes** logs out directly.
2. Unsaved-changes dialog → then the "Log out?" dialog. Rejected because it chains two dialogs for one click.
3. Leave it to the native `beforeunload`. Rejected because it fires after the server logout.

Verified fact: `useBlocker` requires a data router, as seen in the `react-router@8.3.0` source.

Assumption to verify with the QuickApps team: the iframe's `DIRTY_STATE` payload is `{ isDirty: boolean }`. It is referenced in `apps/chat/src/types/apps-editor.ts:48` and is never parsed in this repo.

## Acceptance criteria

1. With unsaved edits in any listed builder, the "Discard unsaved changes?" dialog opens whenever the user tries to leave, and the URL does not change until the user chooses. This covers:
   - a nav rail item;
   - a mobile sheet item;
   - Settings;
   - browser Back;
   - the builder's own Back/Cancel.
2. **Discard changes** lands on exactly the chosen destination and makes no API call. **Keep editing**, Escape, the close control and an outside click all keep the edits and the URL.
3. With unsaved edits, Log out opens the same dialog.
   - **Keep editing** leaves the user signed in on the builder, and `logout()` is not called.
   - **Discard changes** calls `logout()` once and signs out with no further dialog and no native prompt.
   - With no edits, Log out shows today's "Log out?" confirmation.
4. A clean builder, or one whose edits were reverted, navigates without a dialog. A builder's own exit right after a successful Save is not blocked.
5. Reloading or closing the tab while dirty triggers the browser's native warning.
6. Existing and new tests pass. `npm run validate:docs` and `npm run validate:specs` pass.

## Impact

- **Global provider and root, flagged as scope creep.**
  - `apps/chat/src/main.tsx` switches router type.
  - A new app-level `UnsavedChangesProvider` is mounted inside the authenticated tree.
  - Every existing route, provider and hook keeps working, because data routers support descendant `<Routes>`.
- **App code:**
  - `apps/chat/src/context/UnsavedChangesContext.tsx` (new);
  - `apps/chat/src/hooks/unsaved-changes/` (new);
  - `apps/chat/src/components/Navigation/Navigation.tsx` and `apps/chat/src/hooks/logout/useLogout.ts` (Log out);
  - the builder pages under `apps/chat/src/pages/`.
- **Libs.** Both changes are additive and backward compatible. `libs/prompt-editor` and `libs/toolset-editor` each gain `onDirtyChange`. They learn nothing about routing; the host supplies the callback.
- **i18n:**
  - New keys: `unsavedChanges.title`, `unsavedChanges.message`, `unsavedChanges.confirmLabel` ("Discard changes"), `unsavedChanges.cancelLabel`. The title, message and Keep editing copy are the existing strings.
  - Removed: `skillEditor.unsavedChanges*`.
- **Docs:**
  - `docs/architecture.md`: the router line and the new context.
  - `openspec/config.yaml`: the routing wording.
  - The `libs/prompt-editor` and `libs/toolset-editor` READMEs.
- **Rollback.** The router migration and the guard are separate commits.
  - Reverting the guard commits restores the per-button guards and today's Log out.
  - Reverting the router commit restores `<BrowserRouter>`.
  - No data or API changes are involved.
