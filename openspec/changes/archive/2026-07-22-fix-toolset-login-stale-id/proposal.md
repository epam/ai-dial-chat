## Why

In the Toolset Editor, clicking "Log In" for a brand-new (never-saved) toolset fails on the
first click and only succeeds on the second. `AuthSection`'s `handleLogIn` calls
`onEnsureSaved()` to persist the toolset (which creates it and asynchronously updates the
parent's `draftToolsetId` state), but then immediately uses the `toolsetId` **prop** captured in
the same render's closure — still `''` for a new toolset — to initiate the OAuth popup or send
the API-key login request. The login call is sent with an empty toolset id and fails. Once the
form re-renders with the real id (after the first failed attempt), every later click uses the
correct id and succeeds, which is why the bug is easy to miss: it only reproduces on the very
first login for a brand-new toolset.

## What Changes

- `onEnsureSaved` (in `ToolsetEditor.tsx`, passed to `AuthSection`) returns the persisted
  toolset id on success (or `false` on failure) instead of a plain boolean.
- `AuthSection.handleLogIn` uses the id returned by `onEnsureSaved()` — not the `toolsetId` prop
  — for `initiateOAuthLogin`, `getToolset` (Cancelled-recheck path), and `loginToolset`, so the
  very first login call for a new toolset always targets the id that was just created.
- No change to persisted data shapes, API contracts, or the already-logged-in / logout flows.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `toolset-authentication`: the "Persist unsaved changes before login" requirement is
  strengthened to require that the login call use the id returned by the persist step itself,
  not a possibly-stale `toolsetId` value from before the persist completed.

## Impact

- `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx` (`handleLogIn`, `Props`)
- `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` (`handleEnsureSaved`,
  `persistFormIfChanged`)
- No backend, API contract, or database changes.
