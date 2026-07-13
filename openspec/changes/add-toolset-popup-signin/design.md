## Context

The OAuth callback component (`apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`,
originally `ToolsetEditorCallback.tsx` under `pages/ToolsetEditor/` — see D0 below for the
rename/relocation) is the one and only registered OAuth `redirect_uri` for toolset logins
(`ROUTES.ToolsetEditorCallback = '/toolset-editor/callback'`; the enum member name is
unchanged — only the file moved). It has exactly one existing caller: the admin
`ToolsetEditor`/Catalog credentials flow (`initiateOAuthLogin` in
`apps/chat/src/utils/toolsets.ts`).

**Revision note**: this document originally assumed that caller persisted redirect state to
`sessionStorage` before a full-page redirect. That was true when this design was first
written, but `09f18b646` — merged to `development` before this change — already changed
`initiateOAuthLogin` to `window.open(url, '_blank', 'noopener,noreferrer')`. `noopener` means
the callback window is not an "auxiliary" browsing context of the opener, which means it does
not inherit the opener's `sessionStorage` (this is standard, spec'd browser behavior, not an
implementation quirk of one engine). Concretely: `sessionStorage.setItem(...)` in the tab that
calls `initiateOAuthLogin`, followed by `sessionStorage.getItem(...)` in the popup that
`window.open` returns, reads back `null` — the two are separate storage areas. The admin OAuth
login flow, as merged in `09f18b646`, therefore silently fails: the callback route always finds
an empty `sessionStorage`, treats the redirect state as absent, and closes the window without
ever calling the login endpoint. This is fixed by D7 below, alongside the QuickApps addition —
both problems have the same root cause (a `window.open`'d callback context cannot rely on
`sessionStorage` set by its opener) and the same fix shape (carry the payload in `state`
instead).

We need a second caller — a popup opened by `ai-dial-quickapps-frontend`'s
`ToolsetLoginModal` (a cross-origin iframe embedded via `AppEditorIframe`, itself rendered
from `/apps-editor`, not `/toolset-editor`) — to land on this exact same URL and complete a
login, without disturbing the first caller's contract at all.

## Goals / Non-Goals

**Goals:**
- Let a toolset login started from inside the QuickApps iframe complete via a popup, and let
  the iframe learn the result, using the toolset's single existing registered `redirect_uri`.
- Fix the admin flow's login call so it actually completes given its current `noopener`
  `window.open` (see Context revision note), without changing anything about *when* or *how*
  the admin UI learns the result — that remains "re-fetch on next focus," unchanged.
- Add no new backend endpoint, no new npm dependency, no new route.

**Non-Goals:**
- Giving the admin flow a live `postMessage` result channel. It still opens with `noopener`,
  so there is still no live signal back to the opener tab after this change — only the
  `state`-vs-`sessionStorage` bug is fixed, not that separate, pre-existing UX gap.
- Making the two flows share the exact same payload shape. Both now travel in `state` as
  base64url JSON (same encoding scheme), but `ToolsetRedirectState` (admin) and
  `ToolsetPopupState` (QuickApps) remain distinct types with distinct fields — the admin
  payload has no `originatingOrigin`/`nonce` because there is no cross-origin `postMessage` to
  target. See D7.
- Building the QuickApps-repo side of this (popup opening, `state` encoding, message
  handling). That work happens in `ai-dial-quickapps-frontend`, which has no `openspec` of
  its own; this design documents the contract that repo must implement against.

## Decisions

### D0. Relocate the callback component out of `pages/ToolsetEditor/`, keep the route value

The registered `redirect_uri` (`/toolset-editor/callback`) cannot change — it's pinned by
every toolset's existing IdP client registration. But the **file** implementing that route
has no such constraint: only `ROUTES.ToolsetEditorCallback`'s string *value* is
IdP-registered, not its file location or the React component's name.

Leaving the popup branch inside `pages/ToolsetEditor/ToolsetEditorCallback.tsx` would read as
if this is admin-editor-only code, when after this change it equally serves logins started
from `/apps-editor`'s embedded QuickApps iframe — a reader touching `pages/ToolsetEditor/`
for an unrelated admin-flow change could reasonably not expect their edit to affect the
QuickApps popup flow at all.

**Decision**: move the component to `apps/chat/src/pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`
(tests to `pages/ToolsetAuthCallback/tests/ToolsetAuthCallback.spec.tsx`), update the lazy
import and variable name in `app.tsx` (`ToolsetAuthCallbackPage`), and leave
`ROUTES.ToolsetEditorCallback`'s enum member name and string value both unchanged — only add
a comment on that enum member explaining it's shared by both callers and why its name can't
just be renamed to match without re-auditing every toolset's registered `redirect_uri` first.

- **Why keep the enum member name unchanged** rather than also renaming it to
  `ToolsetAuthCallback`: the member *name* is purely internal and carries no IdP
  registration risk on its own, but renaming it invites someone to later "clean up" by
  changing the *value* to match a differently-named route, which would be the actual
  break. Leaving the name as-is with an explanatory comment removes that temptation while
  costing nothing.
- **Alternative considered**: leave the file in `pages/ToolsetEditor/` and just add a comment
  explaining the dual-purpose. Rejected — a comment doesn't fix that the file's *location*
  actively tells future readers the wrong thing about ownership; moving it is free (no
  redirect_uri impact) and more honest about what the file is.

### D1. Branch on `window.opener` + a known `window.name`, not on `state` shape alone

```ts
const isQuickAppsPopup =
  !!window.opener &&
  window.opener !== window &&
  window.name === QUICKAPPS_TOOLSET_AUTH_POPUP_NAME; // 'quickapps-toolset-auth-popup'
```

checked as the very first thing in the callback's effect, before any `state` decode.

- **Why `window.name` and not just "does `state` decode as JSON"**: after D7, *both* branches
  now encode `state` as base64url JSON, so "does it decode as JSON" is no longer even a weak
  signal — it's true for both callers by construction. The two payload shapes
  (`ToolsetRedirectState` needs `csrfToken`; `ToolsetPopupState` needs `originatingOrigin` +
  `nonce`) happen to reject each other's payload under strict field validation, but relying on
  that as the *primary* discriminator would be fragile — a future field added to one shape
  that happens to satisfy the other's validation would silently misroute a login. Gating on an
  explicit, cheap, side-channel signal (`window.name`, set by the opener before navigation,
  standard and available before the IdP redirect completes) is the actual discriminator; the
  shape mismatch is only a secondary safety net.
- **Why not `window.opener` alone**: `window.opener` is `null` for the admin flow today because
  `initiateOAuthLogin` opens with `noopener` (see Context revision note) — but that's an
  implementation detail of the admin flow, not a security boundary. A user could, in principle,
  open the admin flow's redirect target via `window.open` from some other page without
  `noopener` and it would then have an opener too. The window name is the deliberate, explicit
  marker that only the QuickApps-repo code sets, and is what actually makes the two branches
  provably non-overlapping regardless of how either flow's window is opened.
- **Alternative considered**: have the QuickApps side pass a distinguishing flag inside
  `state` instead of using `window.name`. Rejected — `state` round-trips through the IdP and
  some providers append/mangle non-alphanumeric characters or truncate it; `window.name` never
  leaves the browser and is simpler to reason about.

### D2. `state` carries the payload; decode-only on this side

The **encode** side lives in `ai-dial-quickapps-frontend` (out of scope here). This repo only
implements **decode + validate**. Contract (documented here so both repos can build against
it independently):

```ts
// apps/chat/src/types/toolsets.ts — new type
export interface ToolsetPopupState {
  toolsetId: string;
  credentialsLevel: ToolsetCredentialsLevel; // GLOBAL (org) | USER (personal)
  originatingOrigin: string; // e.g. "https://quickapps.example.com" — never '*'
  nonce: string; // opaque, only used for a well-formed-ness check on this side
}
```

Encoding: base64url (`+`→`-`, `/`→`_`, strip `=` padding) of the UTF-8 JSON — the same scheme
`development`-branch's `encode/decodeToolsetRedirectState` already used, chosen for parity
with prior art in this codebase rather than inventing a new one.

```ts
// apps/chat/src/utils/toolsets.ts — new function, additive
export const decodeToolsetPopupState = (state: string): ToolsetPopupState | null => {
  try {
    const b64 = state.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(state.length / 4) * 4, '=');
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
    );
    const parsed = JSON.parse(json) as Partial<ToolsetPopupState>;
    if (
      typeof parsed.toolsetId !== 'string' || !parsed.toolsetId ||
      typeof parsed.originatingOrigin !== 'string' || !parsed.originatingOrigin ||
      typeof parsed.nonce !== 'string' || !parsed.nonce ||
      (parsed.credentialsLevel !== ToolsetCredentialsLevel.Global &&
        parsed.credentialsLevel !== ToolsetCredentialsLevel.User)
    ) {
      return null;
    }
    return parsed as ToolsetPopupState;
  } catch {
    return null;
  }
};
```

- **Why validate every field strictly and return `null` on any miss** (rather than defaulting
  missing fields): the decoded `originatingOrigin` becomes the `postMessage` target — a
  malformed or missing value must never fall back to `'*'` or a guessed value. If decode
  fails, the callback shows the safe "you can close this window" fallback and posts nothing.

### D3. `originatingOrigin` must be validated, not just trusted verbatim

Before using `originatingOrigin` as the `postMessage` target, additionally require it parses
as a valid absolute URL origin (`new URL(originatingOrigin).origin === originatingOrigin`).
This prevents a malformed/crafted `state` from coercing `postMessage` into an unintended
target-origin string (e.g. accidentally becoming `'*'` via a bug, or an origin string with
trailing garbage that some browsers might treat permissively). `window.opener.postMessage`
is called with this validated origin as the second argument — **never `'*'`** for this
message, since it carries a login outcome for a specific toolset back to a specific known
caller.

### D4. Reuse the existing login endpoint verbatim

```ts
const body: ToolsetLoginBodyDto = {
  url: popupState.toolsetId,
  credentialsLevel: popupState.credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
  authenticationType: ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
  code,
  redirectUri: `${window.location.origin}${ROUTES.ToolsetEditorCallback}`,
};
await loginToolset(popupState.toolsetId, body);
```

Identical shape to what `ToolsetAuthCallback.tsx`'s existing admin branch already sends —
no backend or generated-client change. `redirectUri` here is the actual URL the browser is
currently on (this callback route), matching what was sent to the IdP as `redirect_uri` when
the popup's authorize URL was built (on the QuickApps side) — both must agree this stays
`/toolset-editor/callback`, per the no-new-redirect-uri constraint.

### D5. Message contract back to the iframe

```ts
interface ToolsetLoginCompleteMessage {
  type: 'quickapps/TOOLSET_LOGIN_COMPLETE';
  payload: {
    toolsetId: string;
    credentialsLevel: ToolsetCredentialsLevel;
    success: boolean;
  };
}
```

- Sent via `window.opener.postMessage(message, popupState.originatingOrigin)` — a **direct**
  window reference, since `window.opener` inside a popup opened by code running inside the
  QuickApps iframe already *is* that iframe's `window`. No relay through `AppEditorIframe` or
  any other Chat-side component is needed or added.
- Never include `code`, tokens, or any credential material in this message — only the
  identifiers needed for the receiving side to call its own `refreshToolsets()`-equivalent.
- Sent for both success and failure (`success: false` on decode failure with a recoverable
  origin, on a non-2xx login response, or on network error) so the iframe can stop showing a
  spinner either way. When `originatingOrigin` itself could not be recovered (decode failed
  entirely), nothing is posted — there is no safe target — and the popup just shows the
  fallback message for the user to close manually.
- `window.close()` is called after posting (success or failure) so the popup does not linger.

### D6. Nothing changes in `app-editor-flow` / `AppEditorIframe`

`window.opener` inside the OAuth popup is a direct reference to whichever `window` called
`window.open(...)` — here, JS executing inside the QuickApps `<iframe>`'s own document. It is
*not* routed through `AppEditorIframe`'s `postMessage`/`TRIGGER_SAVE` plumbing at all, so
`app-editor-flow` requires zero changes for this handshake to work.

### D7. Fix the admin flow: migrate off `sessionStorage` onto its own `state`-encoded payload

Per the Context revision note, `initiateOAuthLogin`'s `window.open(url, '_blank',
'noopener,noreferrer')` (from `09f18b646`) means the callback window never inherits the
opener's `sessionStorage`. The admin OAuth login, as merged, never actually calls the login
endpoint — it always finds an empty `sessionStorage` and closes the popup. Since fixing D1's
discriminator required touching this same file and the same "how does the callback know what
to log in" problem anyway, this change fixes the admin flow at the same time rather than
leaving a known bug next to newly-added, correctly-working code.

**Decision**: apply the same technique already designed for the QuickApps branch (D2) to the
admin branch — carry `{ toolsetId, credentialsLevel, csrfToken }` (`ToolsetRedirectState`) as
base64url-encoded JSON in the OAuth `state` query parameter, encoded by
`encodeToolsetRedirectState` when `initiateOAuthLogin` builds the authorize URL, and decoded by
`decodeToolsetRedirectState` in the callback. `sessionStorage` and
`TOOLSET_REDIRECT_STATE_KEY` are removed entirely — there is no longer anything for either
branch to persist across the redirect outside of `state` itself.

```ts
// apps/chat/src/types/toolsets.ts
export interface ToolsetRedirectState {
  toolsetId: string;
  credentialsLevel: ToolsetCredentialsLevel;
  csrfToken: string;
}
```

- **Why not just drop `noopener` instead**: `noopener` was added deliberately in `09f18b646` to
  sever the opener reference for a cross-origin popup (see the comment on `initiateOAuthLogin`
  in `utils/toolsets.ts`), which is a real reverse-tabnabbing mitigation independent of this
  bug. Removing it to restore `sessionStorage` sharing would trade a real security property for
  a fix that's available another way (encoding into `state`) without that trade-off.
- **Why this doesn't restore the old CSRF property**: the previous `sessionStorage`-based check
  compared a value stored *before* the redirect against the value the IdP echoed back — a
  genuine cross-check an attacker couldn't forge without first observing the victim's
  `sessionStorage`. Once the entire payload round-trips through `state` with nothing held back
  independently, `csrfToken` becomes informational only (mirrors `ToolsetPopupState.nonce`,
  D2) — the same trust model already accepted for the QuickApps branch, which relies on the
  authorization `code` itself being IdP-issued, single-use, and tied to a specific
  `client_id`/`redirect_uri` for the actual security boundary. This is a *known, accepted*
  reduction from the original (working) `sessionStorage` design's CSRF property, made necessary
  by `09f18b646`'s switch away from a same-context redirect — not something this change chooses
  to introduce gratuitously.
- **Why not keep `sessionStorage` for the admin flow and only fix the discriminator**: doing so
  would leave the admin login endpoint call permanently unreachable, which is strictly worse
  than shipping with the reduced (but non-zero, code-bound) CSRF property above.
- **No live result channel added**: this only fixes whether `loginToolset` gets called; it does
  not add a `postMessage` (or any other) result channel back to the admin opener, since
  `noopener` still prevents that. The admin UI's existing "re-fetch on next focus" behavior for
  learning the outcome is unchanged.

## Risks / Trade-offs

- **Two OAuth handshakes on one route** — highest risk is accidentally coupling the branches
  later. Mitigation: the early-return keeps them structurally separate in the file; a code
  comment at the branch point states why (never let the two `state`-handling code paths call
  into each other).
- **Cross-repo contract drift** — `ai-dial-quickapps-frontend` has no `openspec`, so nothing
  enforces it stays in sync with `ToolsetPopupState`'s shape here. Mitigation: this design
  doc is the source of truth for the contract; any future change to the payload shape here
  must be flagged in the PR description as a breaking cross-repo contract change.
- **Popup blockers** — `window.open` from a click handler inside a cross-origin iframe is
  synchronous and user-triggered, which all major browsers allow; no mitigation needed beyond
  a manual smoke test once both sides are implemented.
- **`window.name` collision** — a very unlikely case where an admin-flow browser tab happens
  to already have `window.name === 'quickapps-toolset-auth-popup'` from some unrelated prior
  use of that tab. Mitigation: the check also requires `window.opener` to be set. The admin
  flow's own popup (opened with `noopener`) never has this — `window.opener` is always `null`
  there — so the two conditions together are safe, though note this now depends on the admin
  flow keeping `noopener` (see D7's "why not just drop `noopener`").
- **Regressing the admin flow while fixing it** — D7 changes the admin branch's decode source
  from `sessionStorage` to `state`, which is a real behavior change (fixing a real bug), not an
  additive-only change like the QuickApps branch. Mitigation: covered by
  `ToolsetAuthCallback.spec.tsx` cases asserting `loginToolset` is called with the decoded
  `toolsetId`/`credentialsLevel` and that this works with `window.opener` explicitly `null`
  (the real-world condition once `noopener` is in effect) — the previous test suite's
  sessionStorage-based assertions could not have caught the original bug, since jsdom's
  `sessionStorage` is a single global and doesn't model per-window isolation the way real
  browsers do.

## Migration Plan

1. Add `ToolsetPopupState` to `apps/chat/src/types/toolsets.ts` and
   `QUICKAPPS_TOOLSET_AUTH_POPUP_NAME` to `apps/chat/src/constants/toolsets.ts`.
2. Add `decodeToolsetPopupState` to `apps/chat/src/utils/toolsets.ts` with unit tests
   (valid payload, missing field, bad base64, wrong `credentialsLevel` value).
3. Move `ToolsetEditorCallback.tsx` → `pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx`
   (D0), updating `app.tsx`'s lazy import/variable name; `ROUTES.ToolsetEditorCallback`'s
   value is untouched.
4. Add the early-return branch to `ToolsetAuthCallback.tsx`, covered by new
   `ToolsetAuthCallback.spec.tsx` cases.
5. Fix the admin branch per D7: update `ToolsetRedirectState` to `{ toolsetId,
   credentialsLevel, csrfToken }` (all required), add
   `encodeToolsetRedirectState`/`decodeToolsetRedirectState`, rewire `initiateOAuthLogin` and
   `buildToolsetAuthorizeUrl` to build/pass the encoded `state`, remove
   `TOOLSET_REDIRECT_STATE_KEY` and all `sessionStorage` reads/writes, and rewrite
   `ToolsetAuthCallback.spec.tsx`'s admin-flow cases to assert against the new `state`-based
   contract instead of `sessionStorage`.
6. Add the one new i18n fallback string.
7. Coordinate with `ai-dial-quickapps-frontend` to implement the encode + popup-open +
   message-listen side against this contract; verify end-to-end manually once both land.

Rollback: the QuickApps early-return branch (step 4) and its decode util can be reverted in
isolation. Step 5 (the admin-flow fix) should not be rolled back independently — doing so
restores the `sessionStorage`/`noopener` bug where the admin OAuth login never completes.

## Open Questions

- Should `nonce` be checked against anything server-side (replay protection), or is
  "well-formed, non-empty string" sufficient given the login endpoint itself requires a
  fresh, single-use OAuth `code` from the IdP (which already prevents replay)? Current design
  treats `nonce` as informational only — flag if a stronger guarantee is wanted.
- Confirm whether every OAuth-toolset IdP registration in actual use really has only
  `/toolset-editor/callback` registered (the constraint this whole design is built around) —
  if any toolset was registered with a different `redirect_uri`, the popup flow needs to
  target that toolset's actual registered value instead of a hardcoded route.
- Should `csrfToken` (D7) be checked against anything, similarly to `nonce` above? Same
  reasoning applies: treated as informational only, relying on the IdP-issued `code` as the
  actual security boundary. Flag if a stronger guarantee is wanted for the admin flow
  specifically.
- Was the admin OAuth login's breakage (Context revision note) actually observed/reported in
  the field, or only found by re-reviewing this proposal against the current codebase? If it
  was already reported as a bug elsewhere, that ticket should be cross-linked and possibly
  closed by this change; if not, it's worth flagging to the team that a production regression
  shipped silently in `09f18b646` and had no test coverage that would have caught it.
