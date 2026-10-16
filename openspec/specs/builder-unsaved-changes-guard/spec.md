# builder-unsaved-changes-guard Specification

## Purpose

Protects unsaved work in every builder reached from the Catalog **Create** button (Quick Apps and other schema apps, Custom App, Toolset, Skill, Prompt) and in the Scheduled task create/edit form. A single router-level leave guard (`useBuilderLeaveGuard` on react-router's `useBlocker`) and one shared "Discard unsaved changes?" dialog owned by `UnsavedChangesContext` cover navigation-rail clicks, the mobile navigation sheet, browser Back/Forward, the builder's own Back/Cancel, and Log out.

## Requirements

### Requirement: Guarded builders

The leave guard SHALL apply to every builder a user reaches from the Catalog **Create** menu and to the Scheduled task form:

| Route | Page that owns the guard |
|---|---|
| `ROUTES.AppsEditor` (`ApplicationEditorPage` with `kind` QuickApp, covering Quick Apps and every runner schema, including schema apps rendered by `SchemaAppSetup`) | `ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) |
| `ROUTES.CustomAppEditor` | `ApplicationFormEditor` |
| `ROUTES.ToolsetEditor` | `ToolsetApplicationEditor` (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`) |
| `ROUTES.PromptEditor` | `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` |
| `ROUTES.SkillEditor` | `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` |
| `ROUTES.ScheduledTaskCreate` | `ScheduledTaskCreatePage` |
| `ROUTES.ScheduledTaskEdit` | `ScheduledTaskEditPage` |

The guard applies in both create and edit mode. It SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It is active wherever the builder route itself is available.

#### Scenario: Every builder is guarded
- **WHEN** a user has unsaved edits in any of the builders above and activates a nav rail item
- **THEN** the "Discard unsaved changes?" dialog opens and the URL does not change

### Requirement: Unsaved-changes context owns the dialog

`UnsavedChangesContext` (`apps/chat/src/context/UnsavedChangesContext.tsx`) SHALL follow the `ThemeContext` pattern: `createContext<T | undefined>(undefined)`, a memoised value, and a consumer hook `useUnsavedChanges()` that throws a clear error when used outside the provider.

`UnsavedChangesProvider` SHALL be mounted inside the authenticated tree in `apps/chat/src/AppRoot.tsx`, above `<App />`, so that both the builder pages and `Navigation` are descendants. It owns:

- the active registration: whether a builder is mounted and dirty;
- the single dialog instance and the action that runs on confirm;
- an "unload allowed" flag, which the builder's `beforeunload` listener consults.

The context value SHALL expose:

- `hasUnsavedChanges: boolean`;
- `requestDiscard(onDiscard: () => void): void`. This opens the dialog. On **Discard changes**, it sets the unload-allowed flag, closes the dialog, and runs `onDiscard`. On **Keep editing** or any dismissal, it closes the dialog and runs nothing.

#### Scenario: Hook outside the provider throws
- **WHEN** `useUnsavedChanges()` is called outside `UnsavedChangesProvider`
- **THEN** it throws an error naming the provider

#### Scenario: Nothing registered
- **WHEN** no builder is mounted
- **THEN** `hasUnsavedChanges` is `false`

### Requirement: Leave-guard hook blocks navigation while dirty

The app hook `useBuilderLeaveGuard({ isDirty })` (`apps/chat/src/hooks/unsaved-changes/useBuilderLeaveGuard.ts`) SHALL be the only caller of react-router's `useBlocker`. Each builder page SHALL call it exactly once. It returns `{ allowNextNavigation(): void }`.

**Registration.** The hook SHALL register `isDirty` with `UnsavedChangesContext` while the page is mounted, and SHALL unregister on unmount. It SHALL keep the latest `isDirty` in a ref, so that the blocker predicate reads it synchronously at navigation time.

**Blocking.** A transition SHALL be blocked when all of the following hold:

1. `isDirty` is `true`;
2. `allowNextNavigation()` has not been called since the last transition;
3. the next location differs from the current one in `pathname` or `search`. A hash-only change is never blocked.

Blocking covers PUSH, REPLACE and POP (browser Back/Forward). A blocked transition SHALL open the context's dialog:

- **Discard changes** calls `blocker.proceed()`, so the user lands on exactly the chosen destination, and makes no API call.
- **Keep editing**, Escape, the close control and an outside click call `blocker.reset()`. The URL, form values, selection and scroll position are left unchanged.

**One-shot bypass.** `allowNextNavigation()` SHALL let exactly one following transition through. A builder calls it right before its own post-save exit navigation, so that a save that has not yet re-rendered `isDirty` to `false` does not block itself.

**Stale dialog.** When the blocked transition goes away without an answer, the hook SHALL close the dialog it opened without running either outcome. This happens when the blocker leaves the `blocked` state (a post-save exit navigated past it, and the router reset every blocker on that completed navigation) or when the builder unmounts. A dialog opened for a different request, such as Log out, SHALL be left open.

**Unload warning.** While `isDirty` is `true`, the hook SHALL register a `beforeunload` listener that calls `preventDefault()` unless the context's unload-allowed flag is set. The listener SHALL be removed when the builder becomes clean and on unmount.

**Memoisation.** The returned callback SHALL be stable (`useCallback`), and the blocker predicate SHALL be stable through refs.

#### Scenario: Clean builder navigates freely
- **WHEN** `isDirty` is `false` and the user activates any navigation
- **THEN** the navigation happens and no dialog opens

#### Scenario: Browser Back is blocked
- **WHEN** `isDirty` is `true` and the user presses the browser Back button
- **THEN** the dialog opens and the URL stays on the builder route

#### Scenario: Discard changes continues to the chosen destination
- **WHEN** the dialog was opened by clicking the Scheduler nav item and the user chooses Discard changes
- **THEN** the app is on `ROUTES.ScheduledTasks` and no create or update request was sent

#### Scenario: Keep editing keeps the edits
- **WHEN** the user chooses Keep editing or presses Escape
- **THEN** the dialog closes, the builder is still shown with every edit intact, and the URL has not changed

#### Scenario: Hash-only change is not blocked
- **WHEN** `isDirty` is `true` and only `location.hash` changes
- **THEN** no dialog opens

#### Scenario: Post-save exit is not blocked
- **WHEN** a Save succeeds, and the builder calls `allowNextNavigation()` and then navigates to its return URL in the same tick while `isDirty` is still `true`
- **THEN** the navigation proceeds with no dialog

#### Scenario: Save completing behind an open dialog closes it
- **WHEN** a Save is still running, the user clicks a nav item and the dialog opens, and the Save then completes and its post-save exit navigates to the return URL
- **THEN** the app is on the return URL and the dialog is closed

#### Scenario: Reload while dirty warns natively
- **WHEN** `isDirty` is `true` and the user reloads, closes the tab, or follows a full-page link such as the `<a href="/">` logo
- **THEN** the browser's native unload warning is requested; when `isDirty` is `false`, no `beforeunload` listener is registered

### Requirement: Builder's own Back and Cancel use the same guard

A builder's own Back and Cancel controls SHALL navigate to their return URL without a guard of their own. The router-level guard intercepts that navigation, so the dialog is the same one the user sees for any other exit.

The builder pages SHALL stop calling `useUnsavedChangesGuard` themselves, and SHALL opt out of the libs' built-in guards. The Prompt page does so by passing `onDirtyChange`. The Scheduled task pages do so by omitting `initialValues`. As a result, no second dialog is ever shown.

A control that does not leave the page SHALL NOT open the dialog. An example is the Skill editor's Back while a supporting file is selected.

#### Scenario: Cancel with edits shows exactly one dialog
- **WHEN** a user with unsaved edits activates the builder's Cancel
- **THEN** the "Discard unsaved changes?" dialog opens, and it is the only dialog on screen

#### Scenario: Back on a clean builder leaves immediately
- **WHEN** a user with no edits activates Back
- **THEN** the app navigates to the return URL with no dialog

### Requirement: Two-option unsaved-changes dialog

The provider SHALL render `ConfirmationDialog` from `@epam/ai-dial-chat-shared` with `ConfirmationPopupVariant.Danger`, using these strings:

| Element | Key | English copy |
|---|---|---|
| Title | `unsavedChanges.title` | "Discard unsaved changes?" |
| Message | `unsavedChanges.message` | "You have unsaved changes. Leaving now will discard them." |
| Confirming action | `unsavedChanges.confirmLabel` | "Discard changes" |
| Cancelling action | `unsavedChanges.cancelLabel` | "Keep editing" |

There SHALL be no third action.

Focus behaviour SHALL be as follows:

- Initial focus lands inside the dialog.
- When the dialog closes after Keep editing, focus returns to the previously focused element.
- Escape, the close control and an outside click act as **Keep editing**.

The dialog SHALL render no directional icon and SHALL rely on the kit's flex footer. It therefore lays out correctly under `dir="rtl"` without mirroring.

#### Scenario: Dialog content
- **WHEN** a blocked navigation opens the dialog
- **THEN** the dialog is announced with the accessible name "Discard unsaved changes?", shows the message, and offers exactly the two buttons "Discard changes" and "Keep editing", both reachable with Tab

#### Scenario: RTL layout
- **WHEN** the document direction is `rtl`
- **THEN** the button order mirrors through flex layout and no glyph is flipped

### Requirement: Log out asks about unsaved changes first

`Navigation` (`apps/chat/src/components/Navigation/Navigation.tsx`) SHALL route the `onLogout` of both `UserMenu` and `NavigationSheet` through `useUnsavedChanges()`.

- **Clean.** When `hasUnsavedChanges` is `false`, Log out SHALL open `LogoutConfirmationModal` exactly as before.
- **Dirty.** When `hasUnsavedChanges` is `true`, Log out SHALL call `requestDiscard(performLogout)` and SHALL NOT open `LogoutConfirmationModal`.
  - **Keep editing** leaves the user signed in on the builder with the edits intact, and `logout()` is not called.
  - **Discard changes** runs `performLogout` directly, with no second confirmation.

`performLogout` SHALL be extracted from `LogoutConfirmationModal`'s confirm handler into `useLogout` (`apps/chat/src/hooks/logout/useLogout.ts`), keeping its behaviour, and the modal SHALL reuse it. Its behaviour is:

1. Await `logout()`, logging and swallowing a failure.
2. In overlay mode, `reset()` the auth state.
3. Otherwise, call `window.location.replace(ROUTES.Login)`.

Because the context sets the unload-allowed flag before running `performLogout`, the builder's `beforeunload` listener SHALL NOT raise the native prompt during that replace.

#### Scenario: Keep editing cancels the logout
- **WHEN** a builder has unsaved edits, the user activates Log out, and chooses Keep editing
- **THEN** `logout()` is not called, the user is still signed in, and the builder shows the edits

#### Scenario: Discard changes logs out without further prompts
- **WHEN** a builder has unsaved edits, the user activates Log out, and chooses Discard changes
- **THEN** `logout()` is called once, the page is replaced with `ROUTES.Login`, and neither `LogoutConfirmationModal` nor the native unload prompt appears

#### Scenario: Clean state keeps today's confirmation
- **WHEN** no builder is dirty and the user activates Log out
- **THEN** `LogoutConfirmationModal` opens and the unsaved-changes dialog does not

#### Scenario: Mobile sheet Log out is guarded the same way
- **WHEN** a builder has unsaved edits and the user taps Log out in the navigation sheet
- **THEN** the sheet closes and the unsaved-changes dialog opens

### Requirement: Per-builder dirty contract

Each builder page SHALL pass `isDirty` to `useBuilderLeaveGuard` as described below. In every case, editing a field and reverting it to its original value SHALL count as clean.

**`ApplicationFormEditor` (Quick App, Schema App, Custom App)**
- `isDirty` is `metadata.isDirty` (from `useMetadataForm` in `libs/builder-form`), OR'd with the Setup dirtiness.
- Quick App: the Setup dirtiness is the latest `DIRTY_STATE` value reported by `AppEditorIframe`.
- Schema App and Custom App: Setup values are deep-compared against a baseline.
  - The baseline is re-captured after the Setup section's own initialisation: `SchemaAppSetup`'s required-properties sync and `onDefaultValues`.
  - Initialisation therefore never marks the form dirty.
- The builder's own successful-save exits call `allowNextNavigation()` first. The exits are `navigate(returnUrl)` and `switchToCreatedApp`.

**Toolset**
- `isDirty` comes from the new `ToolsetEditor` `onDirtyChange` (see `toolset-authoring`).
- `onSaveComplete` calls `allowNextNavigation()` before navigating.

**Prompt**
- `isDirty` comes from the new `PromptEditor` `onDirtyChange` (see `prompt-editor`).
- The page's post-save `navigate(returnUrl)` is preceded by `allowNextNavigation()`.

**Skill**
- `isDirty` is the existing `onDirtyChange` state.
- The success `onNavigate` calls `allowNextNavigation()` first.

**Scheduled task (create and edit pages)**
- `isDirty` is `hasScheduledTaskFormChanges(values, baseline)`, computed on the page.
- The post-save navigation calls `allowNextNavigation()` first.

#### Scenario: Schema app initialisation is clean
- **WHEN** a schema-app editor mounts and `SchemaAppSetup` applies defaults and required properties
- **THEN** `isDirty` is `false` and navigating away opens no dialog

#### Scenario: Quick App iframe edits are detected
- **WHEN** the embedded Quick App editor posts `DIRTY_STATE` with `{ isDirty: true }` and the user clicks the Files nav item
- **THEN** the dialog opens; Discard changes lands on `ROUTES.FileManager`

#### Scenario: Reverted edit is clean
- **WHEN** the user changes a skill's description and changes it back
- **THEN** activating a nav item opens no dialog

#### Scenario: Normal Save exit is not intercepted
- **WHEN** the user saves a valid prompt through the editor's own Save button
- **THEN** the app navigates to the return URL without showing the dialog

### Requirement: Unsaved-changes i18n keys

All dialog strings SHALL go through `react-i18next`. The keys SHALL live in `apps/chat/src/i18n/locales/en.json`, and an `UnsavedChangesI18nKeys` enum SHALL be added to `apps/chat/src/constants/translation-keys.ts`:

- `unsavedChanges.title`: "Discard unsaved changes?"
- `unsavedChanges.message`: "You have unsaved changes. Leaving now will discard them."
- `unsavedChanges.confirmLabel`: "Discard changes"
- `unsavedChanges.cancelLabel`: "Keep editing"

The former `skillEditor.unsavedChanges*` keys, and the prompt and scheduled-task `discard*` label wiring that reused them, SHALL be removed from the app.

#### Scenario: Strings are translated
- **WHEN** the dialog renders
- **THEN** every visible label comes from an `unsavedChanges.*` key

### Requirement: Observability

The guard SHALL emit no telemetry or metrics events, and dialog outcomes are not tracked.

#### Scenario: No analytics on dialog actions
- **WHEN** the user chooses any dialog option
- **THEN** neither the guard nor the dialog makes any analytics or metrics call
