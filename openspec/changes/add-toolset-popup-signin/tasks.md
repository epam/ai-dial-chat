Slicing strategy: **contract-first**. Task 1 nails down the shared `ToolsetPopupState`
type/decode contract (documented in `design.md` for the `ai-dial-quickapps-frontend` side to
build against independently), then task 2 wires the decode util, task 3 wires the callback
branch, task 4 covers i18n, task 5 verifies. No backend or generated-client tasks — this
change touches frontend-only code and reuses the existing login endpoint verbatim.

**Revision**: task 6 was added after discovering, on re-review, that the admin flow's
`sessionStorage`-based redirect state (assumed unchanged by this proposal) cannot actually be
read back by the callback given `initiateOAuthLogin`'s `noopener` `window.open` (added in
`09f18b646`, merged before this change). Task 6 migrates the admin branch onto the same
`state`-encoding technique as the QuickApps branch, fixing that bug — see `design.md` D7.

## 1. Types and constants (new, additive)

- [x] 1.1 Add `ToolsetPopupState` interface to `apps/chat/src/types/toolsets.ts`
  (`toolsetId: string`, `credentialsLevel: ToolsetCredentialsLevel`,
  `originatingOrigin: string`, `nonce: string`) — per `design.md` D2
- [x] 1.2 Add `QUICKAPPS_TOOLSET_AUTH_POPUP_NAME = 'quickapps-toolset-auth-popup'` to
  `apps/chat/src/constants/toolsets.ts`, alongside the existing `TOOLSET_REDIRECT_STATE_KEY`

## 2. Decode util (new, additive)

- [x] 2.1 Add `decodeToolsetPopupState(state: string): ToolsetPopupState | null` to
  `apps/chat/src/utils/toolsets.ts` — base64url JSON decode with strict field validation on
  every field, returning `null` on any parse/shape failure (per `design.md` D2)
- [x] 2.2 Add `isValidPostMessageOrigin(origin: string): boolean` helper (or inline in 2.1) —
  `new URL(origin).origin === origin` check, per `design.md` D3
- [x] 2.3 Unit tests in `apps/chat/src/utils/tests/toolsets.spec.ts` (or wherever the existing
  `toolsets.ts` tests live) for: valid payload round-trip, missing `toolsetId`, missing
  `originatingOrigin`, missing `nonce`, invalid `credentialsLevel` value, malformed base64,
  `originatingOrigin` that fails the origin-format check

## 3. Callback branch

- [x] 3.1 In `apps/chat/src/pages/ToolsetEditor/ToolsetEditorCallback.tsx`, add the
  early-return branch (checked before any `sessionStorage` read) per `design.md` D1: detect
  `window.opener` + `window.name === QUICKAPPS_TOOLSET_AUTH_POPUP_NAME`, decode `state`,
  and on a well-formed result call `loginToolset` with the existing `ToolsetLoginBodyDto`
  shape (D4), then `window.opener.postMessage({ type: 'quickapps/TOOLSET_LOGIN_COMPLETE',
  payload: { toolsetId, credentialsLevel, success } }, originatingOrigin)` and `window.close()`
  (D5). On malformed `state` with an unrecoverable origin, render the fallback instead of
  posting (see task 4).
- [x] 3.2 Ensure the admin (`sessionStorage`) branch's existing code and behavior are
  byte-for-byte unchanged — no shared helper extraction between the two branches beyond the
  new `decodeToolsetPopupState` util
- [x] 3.3 Add/extend `apps/chat/src/pages/ToolsetEditor/tests/ToolsetEditorCallback.spec.tsx`:
  popup-success path (login called, message posted with `success: true`, window closed),
  popup-login-failure path (`success: false` posted, window closed, no credential material in
  the posted payload), popup-malformed-state path (no login call; no `postMessage` when origin
  is unrecoverable), and a regression check that the existing admin-flow scenarios still pass
  unmodified
- [x] 3.4 Add a short code comment at the branch point explaining why the two `state`-handling
  paths must stay structurally separate (per `design.md` Risks)
- [x] 3.5 Relocate the component per `design.md` D0: `git mv` the component to
  `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx` and its test to
  `apps/chat/src/pages/ToolsetAuthCallback/tests/ToolsetAuthCallback.spec.tsx`, rename the
  component/import identifiers (not the `ROUTES.ToolsetEditorCallback` enum member or its
  value), update `app.tsx`'s lazy import path and `ToolsetAuthCallbackPage` variable name, and
  add a clarifying comment on `ROUTES.ToolsetEditorCallback` in `types/routes.ts` explaining
  it's shared by both callers

## 4. i18n

- [x] 4.1 Add one fallback string under the existing `toolsetEditor.*` key namespace in
  `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json` for
  "you can close this window" (shown only when the popup branch cannot recover
  `originatingOrigin` to post a message)

## 5. Verification

- [x] 5.1 `npm exec nx test chat` — full suite green
- [x] 5.2 `npm exec nx lint chat` clean for the touched files
- [x] 5.3 Confirm zero new npm dependencies and zero new routes in `types/routes.ts`
- [ ] 5.4 Manual end-to-end smoke test once `ai-dial-quickapps-frontend` implements its side:
  open a Quick App's toolset login from inside `/apps-editor`'s Settings step, complete OAuth
  in the popup, confirm the popup closes and the iframe's toolset chip reflects the signed-in
  state without a manual page refresh

## 6. Fix the admin flow's `sessionStorage`/`noopener` bug (per `design.md` D7)

- [x] 6.1 Update `ToolsetRedirectState` in `apps/chat/src/types/toolsets.ts` to `{ toolsetId,
  credentialsLevel, csrfToken }` (all required) — no longer a `sessionStorage`-shaped optional
  bag
- [x] 6.2 Add `encodeToolsetRedirectState`/`decodeToolsetRedirectState` to
  `apps/chat/src/utils/toolsets.ts`, sharing the base64url encode/decode helpers with
  `decodeToolsetPopupState`
- [x] 6.3 Change `buildToolsetAuthorizeUrl` to accept an already-encoded `state` string instead
  of generating its own CSRF UUID and returning `{ url, state }`; update `initiateOAuthLogin`
  to build `state` via `encodeToolsetRedirectState` and stop writing to `sessionStorage`
- [x] 6.4 Remove `TOOLSET_REDIRECT_STATE_KEY` from `apps/chat/src/constants/toolsets.ts`
- [x] 6.5 Rewrite the admin branch of `ToolsetAuthCallback.tsx` to decode `state` via
  `decodeToolsetRedirectState` instead of reading `sessionStorage`
- [x] 6.6 Rewrite `ToolsetAuthCallback.spec.tsx`'s admin-flow cases and
  `toolsets.spec.ts`'s `buildToolsetAuthorizeUrl` case to exercise the `state`-based contract,
  including a case that completes the login with `window.opener` explicitly `null` (the
  real-world condition given `noopener`)
- [x] 6.7 `npm exec nx test chat` and lint clean for all files touched by this task
