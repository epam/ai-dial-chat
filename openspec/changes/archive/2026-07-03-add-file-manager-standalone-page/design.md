## Context

`extract-dial-file-manager-shell` produced `DialFileManagerShell` and `variant`/`actionProfile` on `useDialFileManager` specifically so this page would be a thin host, not a reimplementation. Today there is no route for a standalone file manager (`ROUTES` enum has `Root`, `Login`, `Catalog`, `Conversations`, `AppsEditor`, `ToolsetEditor`, `ToolsetEditorCallback` — no file-manager entry), and `NAVIGATION_CONFIG` has only Home and Catalog entries. The legacy Redux page (`git show development:apps/chat/src/components/FileManager/FileManager.tsx`) lived at `/file-manager`, rendered `DialFileManager` directly (no popup chrome), and triggered its initial fetch once app data was ready — this design mirrors that top-level structure using the BFF-backed hook instead of Redux, at a new route rather than the legacy path (see Decision 1).

## Goals / Non-Goals

**Goals:**

- A `/files` route reachable from the main navigation, browsing My/Shared/Organization tabs with the same columns, dates, and CRUD the attach modal already has.
- Root listing loads automatically on page mount, with no user navigation required (AC #4).
- Full mobile + desktop + RTL support for the new page chrome.

**Non-Goals:**

- No attach footer, no attach-only selection constraints on this page (AC #3).
- No copy/move/duplicate/share/metadata/upload-archive, no `SelectFolderModal`/`folder-picker` UI, no Review tab — all explicitly deferred to #7503/#7504/#7505.
- No `libs/*` extraction of the shell (#7506).
- No interaction with `useDialFileManagerState` (the attach-modal's open/close boolean) — confirmed in the prerequisite change's design.md as fully independent.

## Decisions

### 1. Route path: `/files`

Short, top-level path reflecting the page's purpose. Rejected: `/file-manager` (the legacy `development`-branch page's exact route) — the product owner preferred the shorter `/files` for the new BFF-backed page rather than reclaiming the old path verbatim; since the legacy page was already removed from routing before this change, there is no live route to migrate away from, only a fresh registration. Also rejected: a versioned or nested path (e.g. `/catalog/files`) — no product requirement calls for one.

### 2. Bucket resolution: `useUser()` from `apps/chat/src/context/auth/UserContext.tsx`

Same source the attach modal already uses (`ConversationView.tsx:163-164` and `ConversationRoute.tsx:119`: `const bucket = user?.bucket ?? '';`). `DialFileManagerPage` calls `useUser()` directly (no new context) and derives `bucket` the identical way. Rejected: adding a new "current bucket" context — the existing `UserContext` already carries `.bucket` as part of `UserProfile`; a new context would just be an indirection with no behavioral benefit and would violate "no drive-by abstraction" scope discipline.

### 3. `actionProfile: 'browse'` selection semantics

Per the prerequisite change's design.md Decision 3, `'browse'` currently computes an identical `actionLabels` set to `'attach'` (My/Shared/Organization CRUD parity, Delete/Rename only on My files). The standalone page relies on the ui-kit's default multi-select grid behavior for its bulk toolbar (already present in `gridOptions`/`bulkActionsToolbarOptions` moved into the shell) — no new selection logic is introduced. `autoSelectUploadedItems` is passed as `true` on the standalone page (matches legacy page behavior: newly uploaded files appear selected).

### 4. Page structure: mirror `AppsEditor.tsx`, not a new pattern

`apps/chat/src/pages/AppsEditor/AppsEditor.tsx` is the closest existing full-page component (`FC`, dedicated `*I18nKeys` enum, data via a context hook, local `useState`/`useMemo`/`useCallback`). `DialFileManagerPage` follows the same shape: top-level `FC`, `DialFileManagerI18nKeys` additions in `apps/chat/src/constants/translation-keys.ts`, `bucket` via `useUser()`, `useDialFileManager({ bucket, variant: 'standalone', actionProfile: 'browse' })`, and `useNotification()` wired the same way the modal wires it (`onNotification: showNotification`).

### 5. Initial mount load

No new effect is required — `useDialFileManager`'s existing load effect already fires on mount when `variant: 'standalone'` is passed (delivered and tested by the prerequisite change). `DialFileManagerPage` does not call `retry()` explicitly on mount; it relies on the hook's own mount-time fetch.

### 6. Layout: full-height flex container under the app header, no page chrome

`DialFileManagerPage` renders no title, header, or other chrome of its own — `DialFileManagerShell` fills the entire route. Desktop: the page's root container is `min-h-0` + flex-grow inside the existing app shell, mirroring how `CatalogView` fills available space under the app's global header. Mobile: the shell's existing responsive grid/tree/toolbar behavior (already ui-kit-driven and unchanged by the prior extraction) is reused as-is. No `sm:`/`md:`/`lg:` prefixes, no custom breakpoints.

## Risks / Trade-offs

- [Risk] Any external bookmark/deep-link still pointing at the legacy `/file-manager` path will 404 rather than reach the new page, since this change registers `/files` instead → [Mitigation] the legacy page was already removed from routing before this change (no live `/file-manager` route exists today either), so this is not a regression from current behavior — it is an accepted trade-off of the product owner's path choice (Decision 1), not something this change needs to redirect or alias.
- [Risk] `DialFileManagerPage` and `DialFileManagerModal` both call `useDialFileManager` independently with different `variant`s; if a user has both a conversation with the attach modal open and the standalone page open in different tabs, there are two independent hook instances with no shared cache → [Mitigation] this matches the modal's own current isolation model (no shared file-listing cache exists today either); explicitly out of scope to add one.
- [Trade-off] Not adding a dedicated bucket-resolution context (Decision 2) means `DialFileManagerPage` duplicates the one-line `user?.bucket ?? ''` expression already present in two other files → accepted as a 1-line duplication, not worth a new abstraction (three occurrences of a one-liner is still below the threshold where extraction pays for itself, per repo convention of avoiding premature abstraction).
