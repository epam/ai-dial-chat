## Why

`ai-dial-quickapps-frontend` is a separate microfrontend, embedded via `<iframe>` in
`AppEditorIframe` (see `openspec/changes/add-app-editor-flow/specs/app-editor-flow/spec.md`,
"App editor iframe component") at the Settings step of `/apps-editor`. Its
`AgentAndToolsetChip`/`ToolsetLoginModal` components let a user pick a toolset for a Quick App
and, if that toolset requires OAuth, click "Log in". Today that just does
`window.open(authorizationEndpoint)` with no `redirect_uri`/`state` and nothing listens for a
result — the user has no way to learn, from inside the iframe, that the OAuth round-trip
finished.

**Correction (this revision)**: an earlier draft of this proposal described the existing admin
OAuth handshake in `toolset-authentication` as "a full-page redirect that stashes state in
`sessionStorage`". That was accurate when first written, but commit `09f18b646` ("Implement
OAuth login flow with new window/tab behavior and credential management"), merged to
`development` before this change landed, already rewrote `initiateOAuthLogin` to open the
provider via `window.open(url, '_blank', 'noopener,noreferrer')` instead of
`window.location.href = url`. That rewrite has a consequence the original author of
`09f18b646` did not account for: `noopener` severs the browsing-context-group link that
cross-window `sessionStorage` inheritance depends on, so the callback window opened by
`initiateOAuthLogin` never actually sees the `sessionStorage` entry the opener tab wrote. In
practice this means **the admin OAuth login flow, as merged, silently no-ops** — the callback
route reads an empty `sessionStorage`, treats the redirect state as absent, and closes the
popup without ever calling the login endpoint. This is a pre-existing bug independent of the
QuickApps work below, discovered while re-reviewing this proposal against the current
codebase, and this change now fixes it (see "What Changes").

That correction changes the shape of the "why," but not its bottom line: whatever mechanism
carries `{ toolsetId, credentialsLevel }` across the OAuth redirect cannot rely on
`sessionStorage` for **either** caller now, admin or QuickApps, because both go through a
`window.open`'d context. The two still need separate encodings (see D2/D6 in `design.md`)
because the QuickApps caller is cross-origin and needs a `postMessage` result and an
`originatingOrigin`, while the admin caller is same-origin and has no live listener to message
back to. But the underlying problem — no persisted storage survives the trip to the callback
window — is now shared, not iframe-specific.

- The login is triggered from `ai-dial-quickapps-frontend`'s own origin, a different origin
  from this app. A popup it opens never shares `sessionStorage` with us in any case —
  `sessionStorage` is only carried into a same-origin, non-`noopener` auxiliary browsing
  context, and here the popup's *opener* is not same-origin with us at all, on top of whatever
  window-features it's opened with.
- Navigating the iframe itself (or the whole `/apps-editor` tab) away for a full-page redirect
  would break the embedding and disrupt whatever else the user has open in Chat.

**Constraint from the requester**: do not register a second `redirect_uri` at the IdP. Every
toolset's OAuth client is registered with exactly one redirect URI
(`/toolset-editor/callback`), and that must stay true — no new callback route.

Investigated and ruled out:
- `apps/chat/src/utils/auth-toolset.ts` / the old `development`-branch `signInToolset`
  same-origin popup-polling trick — relies on opener and popup sharing Chat's origin, which
  doesn't hold when the opener is the QuickApps iframe.
- A new dedicated callback route (`/toolset-signin`) — rejected per the redirect-uri
  constraint above.
- Having Chat's top window open the popup on the iframe's behalf — rejected; it adds a
  message hop in both directions for no benefit, since a popup opened directly by the iframe
  already gets a direct `window.opener` handle back to that iframe.
- Keeping the admin flow on `sessionStorage` and only fixing the QuickApps side — rejected once
  the `noopener`/`sessionStorage` incompatibility above was found; leaving a known-broken admin
  flow untouched while shipping unrelated QuickApps work in the same file would leave a
  regression in production with no tracking.

## What Changes

- The callback component is relocated from `pages/ToolsetEditor/ToolsetEditorCallback.tsx` to
  `pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx` — a pure file move/rename, zero behavior
  change. `ROUTES.ToolsetEditorCallback`'s string value (`/toolset-editor/callback`) is
  untouched, only the enum member's comment is updated; see `design.md` D0 for why the
  component shouldn't keep living under the admin `ToolsetEditor` folder once it also serves
  the QuickApps popup flow.
- `ToolsetAuthCallback.tsx` (post-move) gains an early-return branch, checked **before** any
  `state` decode for the admin path: if `window.opener` is set and
  `window.name === 'quickapps-toolset-auth-popup'`, treat this as a popup opened by the
  QuickApps iframe rather than the admin editor's flow.
- In that branch: decode the OAuth `state` param as a `ToolsetPopupState` payload (produced by
  the *other* repo — see "Cross-repo contract" in `design.md`), call the existing
  `POST /api/v1/toolsets/:toolsetName/login` endpoint (unchanged — same DTO the admin flow
  already uses), then `window.opener.postMessage({...}, originatingOrigin)` with the result and
  `window.close()`.
- **Fix, not just addition**: the admin branch is rewritten to decode `{ toolsetId,
  credentialsLevel, csrfToken }` from its own `state`-encoded payload (`ToolsetRedirectState`,
  via new `encodeToolsetRedirectState`/`decodeToolsetRedirectState` in
  `apps/chat/src/utils/toolsets.ts`) instead of reading `sessionStorage`. `initiateOAuthLogin`
  no longer writes to `sessionStorage` at all; `TOOLSET_REDIRECT_STATE_KEY` is removed. This is
  the fix for the `noopener`/`sessionStorage` bug described in "Why" — see `design.md` D7.
- No new route, no new redirect URI, no backend changes, no new npm dependencies.
- **Out of scope for this change** (tracked separately in `ai-dial-quickapps-frontend`, which
  has no `openspec`): opening the popup with the known window name, building the `state`
  payload, and handling the resulting `postMessage` to refresh the chip's auth status. This
  proposal only covers the Chat-side half of the handshake; see `design.md` for the full
  contract both sides must agree on.

## Non-Goals

- Adding a live `postMessage` result channel for the admin flow. `initiateOAuthLogin` still
  opens with `noopener`, so the admin popup has no way to message its opener back even after
  this fix; the admin UI still relies on re-fetching toolset status when the editor/Catalog
  page is next focused or reopened. Only the *login call itself* is fixed, not that separate,
  pre-existing UX gap.
- Adding a same-origin popup-polling fallback (the old `development`-branch approach) — not
  applicable across origins, and unrelated to the `state`-vs-`sessionStorage` fix above.
- API Key toolset login — that path is a synchronous form POST with no redirect; it needs no
  popup, no `state`, and no message.
- Any change to `app-editor-flow` (the `AppEditorIframe`/`TRIGGER_SAVE`/`SAVE_SUCCESS`
  handshake) — the popup's `window.opener` points directly at the QuickApps iframe, so nothing
  in the `AppEditorIframe` wrapper needs to relay anything.

## Capabilities

### Modified Capabilities

- `toolset-authentication`: the OAuth redirect/callback handshake gains a second, popup-based
  variant for logins initiated from an embedded iframe (distinct window-name + `state`-encoded
  payload), and the existing admin-editor variant is migrated from `sessionStorage` to its own
  `state`-encoded payload to fix the `noopener` incompatibility.

## Impact

- **Moved + modified file**: `apps/chat/src/pages/ToolsetEditor/ToolsetEditorCallback.tsx` →
  `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx` (D0), with the QuickApps
  early-return branch added and the admin branch's storage mechanism fixed. `app.tsx`'s lazy
  import/variable name updated to match; `ROUTES.ToolsetEditorCallback`'s value is unchanged.
- **New utils**: `decodeToolsetPopupState` (+ `ToolsetPopupState` type) for the QuickApps
  branch, and `encodeToolsetRedirectState`/`decodeToolsetRedirectState` (+ updated
  `ToolsetRedirectState` type, now with a required `credentialsLevel` and `csrfToken`) for the
  fixed admin branch — all in `apps/chat/src/utils/toolsets.ts` and
  `apps/chat/src/types/toolsets.ts`.
- **Removed**: `TOOLSET_REDIRECT_STATE_KEY` and all `sessionStorage` reads/writes for this
  handshake.
- **No backend changes** — reuses `POST /api/v1/toolsets/:toolsetName/login` and
  `ToolsetLoginBodyDto` as-is.
- **No new dependencies, no new route, no new redirect URI.**
- **Rollback**: the QuickApps early-return branch and its decode util can be deleted
  independently of the admin-flow fix. The admin-flow fix itself should **not** be rolled back
  once shipped — reverting it restores the `sessionStorage`-based bug where the admin OAuth
  login silently never completes.
- **Cross-repo dependency**: `ai-dial-quickapps-frontend` must open the popup with
  `window.name === 'quickapps-toolset-auth-popup'` and encode `state` per the contract in
  `design.md` for the QuickApps half of this change to have any visible effect end-to-end.
  Until that side ships, that branch is inert (the marker simply never matches) — this does
  not affect the admin-flow fix, which is independently effective as soon as this change ships.
- **i18n**: one new fallback string for "you can close this window" shown only when the
  callback route is opened directly (no `window.opener`) while `window.name` matches the
  popup marker — added under the existing `toolsetEditor.*` key namespace.

## Acceptance Criteria

- Opening the relocated `ToolsetAuthCallback.tsx` via the existing admin flow with a
  well-formed `state` (as produced by the fixed `initiateOAuthLogin`) calls the login endpoint
  with the decoded `toolsetId`/`credentialsLevel` and closes the window — verified without any
  dependency on `sessionStorage`, including when `window.opener` is `null` (the real-world case
  once `noopener` is in effect).
- Opening the callback URL in a window with `window.opener` set and
  `window.name === 'quickapps-toolset-auth-popup'` decodes `state`, calls the login endpoint
  with the decoded `toolsetId`/`credentialsLevel`, posts a message to `window.opener` at the
  decoded `originatingOrigin` (never `'*'`), and closes the window.
- An invalid/unparseable `state` in the popup branch does not call the login endpoint, still
  posts a failure message back (when `originatingOrigin` was recoverable) or otherwise shows
  the safe fallback, and never leaks credentials or tokens in the posted message.
