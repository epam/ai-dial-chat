## Context

`AuthSection.tsx`'s `handleLogIn` (`apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`)
already persists unsaved changes via `onEnsureSaved()` before logging in, per the existing
"Persist unsaved changes before login" requirement in `toolset-authentication`. For the OAuth
branch, it then calls `initiateOAuthLogin(auth, savedToolsetId)`
(`apps/chat/src/utils/toolsets.ts:226`), which builds the authorize URL synchronously from `auth`
— the in-memory form state — via `buildToolsetAuthorizeUrl` (`toolsets.ts:97`). That function
returns `null` whenever `auth.clientId` or `auth.authorizationEndpoint` is empty.

For a toolset relying on DIAL Core's dynamic client registration (OAuth "With Login", no manual
client config), those two fields are never present in `auth` before save — the Settings step
doesn't even render them in that mode (`AuthSection.tsx:290`) — and they only exist in Core's
response once the toolset has been created/updated (Core performs RFC 7591 registration during
that call and returns `client_id`/`authorization_endpoint` in `authSettings` on a subsequent
`getToolset`, per `apps/chat-api/src/toolsets/toolsets.service.ts:393`). `onEnsureSaved()` only
returns the resolved toolset id, not the updated `authSettings`, so `auth` is still empty when
`initiateOAuthLogin` runs, `buildToolsetAuthorizeUrl` returns `null`, and the login fails with
`InvalidConfig` → the generic "Failed to log in" toast, before any popup opens.

The codebase already has the right shape of fix for a structurally identical problem: the
`openToolsetOAuthPopup()` / `navigateToolsetOAuthPopup()` pair
(`toolsets.ts:183`, `toolsets.ts:191`) exists specifically for callers that "need to fetch the
toolset's auth config first" and can't validate synchronously — used today by the QuickApps
postMessage login relay. `initiateOAuthLogin` is the synchronous, single-call convenience used
when `auth` is already known to be complete (the Catalog and "with login & config" Editor paths).

## Goals / Non-Goals

**Goals:**

- Make the very first OAuth "With Login" click succeed for a brand-new toolset when the client is
  dynamically registered by Core, without changing behavior for any path where `auth` already
  carries a valid `clientId`/`authorizationEndpoint`.
- Preserve the existing "open the popup synchronously in the click handler" requirement so Safari/
  browser popup blockers don't fire (the fix must not turn the OAuth "With Login" path into an
  async-then-`window.open`, which popup blockers treat as programmatic).
- Keep the fix scoped to the Editor's brand-new-toolset case; do not change the Catalog login path
  or the already-logged-in-toolset re-login path, which already have complete `auth` state loaded
  from `toolsetDtoToForm`.

**Non-Goals:**

- No backend/API changes — `getToolset` already returns Core-issued `authSettings` for a
  dynamically registered client; this is purely about the frontend fetching and using it at the
  right time.
- No change to how dynamic registration itself works in Core.
- Not attempting to eagerly predict or pre-register a client id before the user clicks "Log in" —
  Core only registers on create/update.

## Decisions

**Reuse the existing open-then-navigate popup pair instead of `initiateOAuthLogin`.**
In `handleLogIn`, when `auth.authenticationType === OAuth` and mode is "With Login" (no manually
configured `clientId` present in `auth`), open the popup synchronously first with
`openToolsetOAuthPopup()` (still inside the click handler, before any `await`), exactly like the
QuickApps relay already does. After that, run the existing `onEnsureSaved()` persist step, then
fetch the just-saved toolset (`getToolset(savedToolsetId)`) and merge its `authSettings` into a
local `resolvedAuth` value, then call `navigateToolsetOAuthPopup(popup, resolvedAuth,
savedToolsetId, ToolsetCredentialsLevel.User)` instead of `initiateOAuthLogin`. This keeps every
already-working path — Catalog login, "with login & config", re-login on an existing toolset —
untouched, since they still call `initiateOAuthLogin` with `auth` that's already complete.

*Alternative considered*: have `onEnsureSaved()` itself return the freshly fetched
`authSettings` alongside the id, and merge them into `auth` via `onAuthChange` before calling
`initiateOAuthLogin` as before. Rejected because it reintroduces the synchronous-`window.open`
timing problem — the popup must open synchronously in direct response to the click; inserting an
`await getToolset(...)` before `window.open` (as `initiateOAuthLogin` does internally) risks the
browser treating the popup as programmatically triggered and blocking it. The open-then-navigate
pair sidesteps this because it's the established pattern for exactly this "config known only
after an async step" situation.

**Detect "dynamic registration, not yet resolved" locally, not via a new flag.**
Trigger the fetch-and-merge path whenever OAuth + "With Login" is selected and `auth.clientId` is
still empty at click time (mirroring the guard `AuthSection.tsx:290` already uses to decide
whether to render the manual client fields). No new state field is introduced — this reuses the
existing `withLogin`/`clientId` shape the Settings step already tracks.

**Merge fetched `authSettings` into `auth` state after a successful open+navigate**, not only into
a local throwaway variable, so that if the OAuth popup later succeeds and the component reloads
the toolset (existing success-path refetch), the editor's own state is already consistent with
what Core returned — avoiding a second silent mismatch on a following interaction (e.g. re-login).

## Risks / Trade-offs

- [Risk] Opening a same-origin blank popup before `onEnsureSaved()`/`getToolset` resolves means
  the popup sits blank for the duration of the create + refetch network calls, which is slightly
  more visible to the user than the previous single-step flow. → Mitigation: this is the same
  window the QuickApps relay already leaves blank during its own fetch; no new UX pattern, and the
  interval is bounded by two fast, already-existing sequential calls.
- [Risk] If `getToolset` after create returns `authSettings` without `clientId` (e.g. Core hasn't
  finished registering, or registration failed silently upstream), the fix still surfaces the
  existing generic `ErrorLoginFailed`/`InvalidConfig` toast rather than a more specific message. →
  Mitigation: out of scope for this fix (Core-side registration failure is a separate concern);
  the existing toast still communicates failure without opening a dead popup, which is strictly
  better than today's silent no-op-then-toast for the working case.
- [Risk] Duplicating some persist-then-fetch logic between the OAuth-with-login-dynamic branch and
  the existing OAuth Cancelled-result reconciliation branch (`AuthSection.tsx:168`, which already
  calls `getToolset`). → Mitigation: factor the "fetch toolset, merge authSettings into auth"
  step into one small helper used by both call sites rather than duplicating the mapping logic.

## Migration Plan

Frontend-only change behind no flag; ships in the next Chat release. No data migration. Rollback
is a plain revert since no persisted schema or API contract changes.
