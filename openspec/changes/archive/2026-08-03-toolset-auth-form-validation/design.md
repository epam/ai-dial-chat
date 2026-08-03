## Context

`ToolsetEditor.tsx` already distinguishes two different ids:

- `routeToolsetId` (`searchParams.get(ToolsetEditorQuery.Id)`) — set only when the page was
  opened to edit a toolset that was already saved and closed. `isEditMode = Boolean(routeToolsetId)`
  (line 89) is the page's correct notion of "editing an existing saved toolset."
- `persistedToolsetId = routeToolsetId || draftToolsetId` — also becomes truthy the moment a
  brand-new toolset gets its *first* auto-save, which happens inside `AuthSection`'s own Log In
  flow (`onEnsureSaved` → `handleEnsureSaved` → `setDraftToolsetId(result.id)`, line 240) or
  when the user reaches a step that persists a draft.

`SettingsForm.tsx` and `AuthSection.tsx` are only ever given `toolsetId={persistedToolsetId}`
(`ToolsetEditor.tsx:493`). `AuthSection.tsx:98` then computes its own
`isEditMode = Boolean(toolsetId)` from that value — so once a fresh, never-before-saved toolset
picks up a `draftToolsetId`, `AuthSection`'s local `isEditMode` flips to `true` even though the
user is still in the create flow and has never had a server-stored `clientSecret` to skip
re-entering. That flip waives the Client Secret `required` label (`AuthSection.tsx:401`) and the
matching branch of `isToolsetAuthValid` (`utils/toolsets.ts:614`), which is what issue #8096
reports: the Secret field loses its asterisk and the Log In button stays disabled with no visual
explanation, because the client secret is silently treated as optional while some other
still-required field (or the secret itself, if the OAuth provider actually needs it) is missing.

The `toolset-authentication` spec's "OAuth credential fields" requirement is unconditional
("SHALL require client id and client secret before triggering the login"); commit `0c76df140`
introduced the edit-mode carve-out for a real case — re-logging-in on an **already-saved**
OAuth-with-config toolset, where Core never returns the stored `clientSecret` on
`GET /api/v1/toolsets/{id}`, so forcing re-entry every time would be a regression on its own.
That case is legitimate and must still work; the bug is that "already-saved toolset" and "has a
persisted id" are not the same thing.

## Goals / Non-Goals

**Goals:**

- Make the Client Secret field's `required` indicator and `isToolsetAuthValid`'s validity gate
  agree, in every state, about whether a client secret is needed.
- Only waive the client secret requirement when the toolset was opened for editing an existing,
  already-saved OAuth-with-config toolset (`routeToolsetId` present) — never for a toolset that
  picked up a draft id purely from an in-progress creation flow.
- Preserve the existing carve-out's intent: a user re-opening a saved OAuth-with-config toolset
  to log in again should not have to re-enter a secret Core never gives back.

**Non-Goals:**

- Fixing the catalog badge refresh, Quick Apps login, popup-close timing, or the no-auth 502 —
  tracked as separate changes (`toolset-auth-status-sync`, `quickapps-toolset-login`,
  `toolset-oauth-popup-close-delay`, `toolset-skip-auth-when-not-configured`).
- Changing whether/how `authSettings.clientId` is loaded from `GET /api/v1/toolsets/{id}` — if
  reproduction during implementation shows the button also stays disabled because `clientId`
  itself fails to load for a saved toolset, that is the `toolset-auth-status-sync` change's
  concern, not this one.

## Decisions

**Thread the page's real `isEditMode` down as an explicit prop instead of recomputing it.**
`ToolsetEditor.tsx` already computes the correct value at line 89. Add `isEditMode: boolean` to
`SettingsForm`'s and `AuthSection`'s `Props`, pass `isEditMode` (not `toolsetId`) from
`ToolsetEditor` → `SettingsForm` → `AuthSection`, and delete `AuthSection.tsx:98`'s local
`const isEditMode = Boolean(toolsetId);`. `toolsetId` (`persistedToolsetId`) keeps its existing
uses in `AuthSection` (building request bodies) and in `SettingsForm` (MCP URL, connect
visibility) unchanged — only the auth-required/validity gating switches to the new prop.

*Alternative considered:* keep deriving `isEditMode` from `toolsetId` but exclude
`draftToolsetId` from what's passed to `AuthSection`. Rejected — `AuthSection` still needs the
draft id for `onEnsureSaved`/login calls once a draft exists, so the prop would have to carry two
different ids under one name; an explicit boolean is clearer than overloading `toolsetId`.

**Keep `isToolsetAuthValid`'s signature and call sites, just fix what `isEditMode` means at the
call site.** `utils/toolsets.ts:598` already takes `isEditMode` as a parameter — no signature
change needed. `isToolsetFormValid` (line 623), which also calls `isToolsetAuthValid`, is called
from `ToolsetEditor.tsx`'s save path, which already has direct access to the correct
`isEditMode` (line 89) — confirm at implementation time that it passes that value, not something
derived from `persistedToolsetId`.

## Risks / Trade-offs

- [Risk] The fix could regress the case commit `0c76df140` was written for (re-login without
  re-entering secret on an already-saved toolset) → Mitigation: that case is exactly
  `routeToolsetId` truthy, which `isEditMode` still captures; add/keep a regression test asserting
  Secret stays optional there.
- [Risk] If `authSettings.clientId` fails to load for some saved OAuth-with-config toolsets (a
  possible overlap with the `toolset-auth-status-sync` bug), the Log In button may still show
  disabled after this fix, because `clientId` is unconditionally required. → Mitigation: this
  design does not claim to fix that; note it during manual verification and file/link it to
  `toolset-auth-status-sync` rather than expanding this change's scope.

## Open Questions

- None blocking implementation. Manual reproduction against issue #8096's repro steps during
  implementation should confirm whether the `isEditMode` prop fix alone resolves the reported
  symptom, or whether a `clientId`-loading gap (out of scope here) also contributes.
