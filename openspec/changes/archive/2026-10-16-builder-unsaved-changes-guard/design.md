## Context

The motivation and scope are in `proposal.md`. The normative behaviour is in `specs/builder-unsaved-changes-guard/spec.md` and the delta specs. This document explains how the pieces fit together.

### What the code does today

- **Router.** `apps/chat/src/main.tsx` mounts `<BrowserRouter>`. The `useBlocker` in react-router `8.3.0` calls `useDataRouterContext`, so it throws outside a data router.
- **Existing guard.** `useUnsavedChangesGuard` (`libs/chat-shared/src/hooks/useUnsavedChangesGuard.ts`) defers a callback and adds a `beforeunload` listener. Three places use it, and each wraps only its own Back/Cancel:
  - the Skill page (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`), via the kit `ConfirmationPopup`;
  - `libs/prompt-editor` `PromptEditor`, via `ConfirmationDialog`;
  - `libs/scheduled-tasks` `ScheduledTaskCreateForm`, via `ConfirmationDialog`.

  All three show "Discard unsaved changes?" with **Keep editing** and a confirm button. The confirm button reads "Discard" from the app keys, and "Discard changes" as the scheduled lib's default.
- **Editors without a guard.** `ApplicationFormEditor` (Quick App / Schema App / Custom App) and the Toolset editor have none. Their Back/Cancel call `navigate(ROUTES.Catalog)` directly.
- **Exits from a builder.**
  - The nav rail uses `<Link to>` (`apps/chat/src/components/Navigation/Navigation.tsx`).
  - The mobile sheet and Settings call `navigate()`.
  - The overlay host calls `navigate()` (`apps/chat/src/hooks/overlay/useConversationListBridge.ts`).
  - Browser Back/Forward also leaves.
  - Full-page exits: the logos (`<a href="/">`), the Toolset OAuth redirect, and Log out.
- **Log out.** `useLogout` (`apps/chat/src/hooks/logout/useLogout.ts`) only toggles `LogoutConfirmationModal`. Its confirm handler awaits `logout()` and then calls `window.location.replace(ROUTES.Login)`, or `reset()` in overlay mode.
- **Dirty sources that already exist.**
  - `useMetadataForm().isDirty` (`libs/builder-form/src/hooks/useMetadataForm.ts`). It is available to both the app editors and the toolset editor, but neither reads it.
  - The Skill lib's `onDirtyChange`.
  - Prompt's internal `isDirty`, which is not exposed.
  - `hasScheduledTaskFormChanges`.
  - The Quick App iframe's `DIRTY_STATE` message, which the host ignores.

## Goals / Non-Goals

**Goals**
- One mechanism that catches every in-app transition out of a builder, including POP, plus Log out.
- One dialog: the existing two-option "Discard unsaved changes?" with Keep editing and Discard changes.
- Builders contribute only `isDirty`. Libs learn nothing about routing.

**Non-Goals**
- A Save option in the dialog.
- A custom dialog for tab close, reload, the logo links, or OAuth redirects. Browsers allow only their native prompt there.
- Autosave.
- Route-object or loader migration.
- Guarding pages that are not builders.

## Decisions

### D1. Data router with an unchanged route tree

`main.tsx` builds a module-scope `createBrowserRouter([{ path: '*', element: <AppRoot /> }])` and renders `<RouterProvider router={router} />`.

- `AppRoot` is the current provider stack plus `<Routes>`, moved out verbatim.
- `RootErrorBoundary` and `#interactive-tooltip-portal` stay outside the router.
- Data routers support descendant `<Routes>` under a splat route. So `app.tsx` and every `useNavigate`/`useLocation` caller stay untouched.

A router supports only one active blocker. Only one builder page is ever mounted, so this holds. The hook's JSDoc documents it.

*Alternatives:* the proposal compares a guard context for navigation (B), wrapping the navigator (C), and per-button guards (D). Converting to route objects was rejected: the diff is large and buys nothing here.

### D2. `UnsavedChangesContext` owns the dialog; `useBuilderLeaveGuard` owns blocking

Log out is not a router transition, yet it must know whether a builder is dirty. A small app-level context is therefore unavoidable.

- **Context.** `apps/chat/src/context/UnsavedChangesContext.tsx` follows the `ThemeContext` pattern. It is mounted inside the authenticated branch of `AppRoot`, wrapping `<App />`.
- **Provider state.**
  - `registration`: `{ isDirty }` of the mounted builder, or `null`.
  - `pending`: `{ onDiscard, onKeep }` while the dialog is open.
  - `unloadAllowedRef`.
- **Provider rendering.** The provider renders the single `ConfirmationDialog` (`libs/chat-shared/src/components/ConfirmationDialog/ConfirmationDialog.tsx`, `ConfirmationPopupVariant.Danger`) with the `unsavedChanges.*` labels.
- **Context value.** It is memoised (`useMemo`):
  - `hasUnsavedChanges`;
  - `requestDiscard(onDiscard)`, the public API used by Log out;
  - an internal `register`/`open` pair used by the hook.

The hook, `apps/chat/src/hooks/unsaved-changes/useBuilderLeaveGuard.ts`:

```ts
const useBuilderLeaveGuard = ({ isDirty }) => {
  const { register, open, unloadAllowedRef } = useUnsavedChangesInternal();
  const dirtyRef = useRef(isDirty); dirtyRef.current = isDirty;
  const bypassRef = useRef(false);
  useEffect(() => register(isDirty), [isDirty]);          // + unregister on unmount
  const blocker = useBlocker(useCallback(({ currentLocation: c, nextLocation: n }) => {
    if (bypassRef.current) { bypassRef.current = false; return false; }
    return dirtyRef.current && (c.pathname !== n.pathname || c.search !== n.search);
  }, []));
  useEffect(() => {
    if (blocker.state === 'blocked') open({ onDiscard: blocker.proceed, onKeep: blocker.reset });
  }, [blocker.state]);
  // beforeunload while isDirty, skipped when unloadAllowedRef.current
  return { allowNextNavigation: useCallback(() => { bypassRef.current = true; }, []) };
};
```

Key points:

- **Refs.** A builder's own post-save exit calls `navigate()` in the same tick that its state is set clean. Reading `isDirty` from render would block that exit. `allowNextNavigation()` is the explicit escape hatch for this case. The `dirtyRef` mirror keeps the predicate stable, so `useBlocker` does not re-register on every keystroke.
- **`search` is compared.** Editors switch mode through query parameters (`?id=`, `?schema=`).
- **`useUnsavedChangesGuard` is kept.** It stays in `chat-shared`, unchanged, for libs that run without a host guard. The new hook stays in the app because it uses routing (AGENTS.md §Library isolation).

*Alternative:* a dialog rendered per page, plus a separate context only for Log out. Rejected because it means two dialog code paths with the same copy.

### D3. Back/Cancel stop guarding themselves

Pages make Back/Cancel a plain `navigate(returnUrl)` and let the blocker intercept it.

- The Skill page deletes its `useUnsavedChangesGuard` and its `ConfirmationPopup`.
- Prompt passes `onDirtyChange`, which turns off the lib's built-in guard.
- The Scheduled task pages stop passing `initialValues`, which is that lib's existing opt-out.

This leaves one "leaving" path and one dialog, and the lib defaults stay intact for external hosts.

### D4. Log out

`useLogout` gains `performLogout`, which is the body of today's `LogoutConfirmationModal.handleConfirm` moved without changes. The modal then calls it.

`Navigation` passes `onLogout={handleLogout}` to both `UserMenu` and `NavigationSheet`:

```ts
const handleLogout = hasUnsavedChanges ? () => requestDiscard(performLogout) : openLogout;
```

On **Discard changes**, `requestDiscard` sets `unloadAllowedRef.current = true` before running `performLogout`. This keeps the builder's `beforeunload` listener from raising the native prompt on `window.location.replace`. The flag resets when the dialog next opens, and on provider unmount.

Overlay mode needs no special case. There, `reset()` unmounts the builder under `RequireAuth`.

*Alternatives:*
- Chaining the unsaved-changes dialog into the "Log out?" dialog. Rejected: two dialogs for one click.
- Keeping the native prompt. Rejected: it fires after the server `logout()`, so "Stay on page" would leave a dead session.

### D5. Dirty detection details

- **Schema App Setup.** `SchemaAppSetup` emits `onChange` during mount, for the required-properties sync and `onDefaultValues`. `ApplicationFormEditor` keeps `setupBaselineRef`. While Setup reports initialisation, the baseline is replaced rather than marked dirty. Setup reports initialisation either through a narrow signal added to `apps/chat/src/pages/ApplicationEditor/setup/SchemaAppSetup.tsx` or through `onDefaultValues` updating the baseline. Comparison is a structural deep-equal; stable JSON is enough for these plain objects.
- **Custom App Setup.** A controlled form, compared against the loaded values.
- **Quick App iframe.** `DIRTY_STATE` is handled as described in the `app-editor-flow` delta. It resets on `SAVE_SUCCESS` and on reload.
- **Toolset.** One comparison of the whole form — Metadata and Setup — against a baseline: the seeded form, replaced by the last persisted one. The editor reports clean after the Log In draft persist. (Planned as `metadata.isDirty` OR'd with a Settings baseline; changed because re-baselining `useMetadataForm` with `reset(values)` also clears its touched and submit-attempt state.)
- **Reverting edits.** Reverting yields clean everywhere, because every source compares against a baseline. The one exception is the iframe, whose revert semantics are its own.

### D6. Testing approach

**Context and hook.** These get unit tests through `createMemoryRouter` + `RouterProvider`, the first such tests in the repo. They cover:

- PUSH, POP and REPLACE blocking;
- hash-only changes passing;
- the one-shot `allowNextNavigation`;
- Discard → proceed, and Keep editing/Escape → reset;
- `beforeunload` registration and the `unloadAllowedRef` skip;
- `requestDiscard` running or not running its callback;
- the provider-missing error.

**Navigation.** The spec renders with a stubbed context value to cover the dirty versus clean Log out branches.

**Page specs.** Specs that mock `react-router`, such as Prompt and Skill, mock `useBuilderLeaveGuard` instead. They assert:

- the `isDirty` wiring;
- that Back/Cancel call `navigate` unguarded;
- that `allowNextNavigation` runs before the post-save navigation.

### Memoisation

- The context value is wrapped in `useMemo`. The hook's callback uses `useCallback`. The blocker predicate is kept stable through refs.
- `handleLogout` is wrapped in `useCallback`.
- No `React.memo` is needed.

### Accessibility and RTL

`ConfirmationDialog` and the kit `Popup` already provide focus trap, return focus, Escape, and dialog naming. There are no new icons. Layout comes from the kit's flex footer, so no RTL work is needed beyond logical classes on any wrapper we add.

## Risks / Trade-offs

- **[Risk] The router switch changes the root of every page.** → Mitigation: keep the tree verbatim under a splat route. Smoke-test login, overlay-close, conversation deep links, catalog `?itemId=`, and the toolset OAuth callback through the existing specs. Land it as its own commit.
- **[Risk] A builder's post-save `navigate()` is blocked by its own stale `isDirty`.** → Mitigation: call `allowNextNavigation()` before every post-save exit, with one success-path test per builder.
- **[Risk] The `DIRTY_STATE` payload is unverified.** → Mitigation: accept only a boolean `isDirty`, so a wrong guess fails open (no dialog) rather than closed. Metadata edits are still detected. Confirm the payload with the QuickApps owners.
- **[Risk] Schema App initialisation marks the form dirty.** → Mitigation: capture the baseline during initialisation (D5), with a regression test.
- **[Risk] A context is introduced at app scope.** → Mitigation: it is narrow (dirty flag + one dialog), it is not read by anything outside builders and `Navigation`, and it holds no persisted state.
- **[Trade-off] Overlay host navigation opens the dialog inside the overlay.** This is intended: the navigation is cancelled exactly as it is in-app.

## Migration Plan

1. **Commit 1:** router migration (`main.tsx`). No behaviour change.
2. **Commit 2:** context, hook, i18n keys, Log out wiring, and the builders that need no lib change: `ApplicationFormEditor`, Quick App iframe, Scheduled task pages, Skill page.
3. **Commit 3:** `onDirtyChange` in `libs/prompt-editor` and `libs/toolset-editor` with their READMEs, Prompt and Toolset page wiring, and removal of the `skillEditor.unsavedChanges*` keys and the `discard*` label plumbing.
4. **Commit 4:** `docs/architecture.md` and the `openspec/config.yaml` router wording.

**Rollback:** revert commits 2–3 to restore today's per-button guards and Log out; revert commit 1 to restore `<BrowserRouter>`. No data or API migration is involved.

## Open Questions

1. Confirm the QuickApps iframe `DIRTY_STATE` payload (`{ isDirty: boolean }`?) and whether the iframe clears it itself after `TRIGGER_SAVE`.
2. The confirm label changes from "Discard" to "Discard changes" on the Skill, Prompt and Scheduled task pages. This is assumed to be the copy product asked for; confirm it.
