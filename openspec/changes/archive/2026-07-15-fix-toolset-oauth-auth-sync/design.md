## Context

Toolset OAuth login (`apps/chat/src/utils/toolsets.ts:initiateOAuthLogin`) writes a `ToolsetRedirectState` (`toolsetId`, `credentialsLevel`, `redirectUri`, `state`) to `sessionStorage` and opens the authorize URL with `window.open(url, '_blank', 'noopener,noreferrer')`. Because `noopener` is used, the popup gets a fresh browsing context with **no `window.opener`**, and depending on the browser, a separate `sessionStorage` partition tied to that context rather than the tab that spawned it. `ToolsetEditorCallback.tsx` runs inside that popup: it reads the query-string `code`/`state`, tries to read the redirect state back out of its own `sessionStorage`, validates `state`, calls `loginToolset(...)`, and calls `window.close()` — on both success and failure, with no notification path back to the tab that started the flow. `AuthSection.tsx` (Editor) and `CatalogView.tsx` (Catalog) each have working post-login refresh logic for the **API-key** path (`onAuthChange({isLoggedIn: true})`, `refetchToolsets()`) but the OAuth path returns early after calling `initiateOAuthLogin` and never runs that refresh. `openspec/specs/catalog-toolset-credentials/spec.md` currently encodes this gap as an explicit requirement ("OAuth logins ... are exempt from this automatic refresh ... the user reopens the panel or reloads the list").

Separately, the `LOGGED OUT` badge (`libs/catalog/src/utils/toolset-credentials.ts:getCredentialsBadgeState`, single negative-only state) is rendered by `libs/catalog/src/components/CardGrid/Card.tsx` but not by `libs/catalog/src/components/Favorites/FavoriteCard.tsx`, which has no `credentials` handling at all.

## Goals / Non-Goals

**Goals:**
- Make OAuth login/logout produce the same immediate UI feedback (Editor `Log in` ⇄ `Log out`, Catalog card badge, Details panel, notifications) as the existing API-key flow, without a page reload.
- Keep the OAuth `state` CSRF check intact and add a documented, testable cross-window result protocol.
- Make favorite cards show the same negative-only `LOGGED OUT` badge as grid/list cards, reusing existing badge logic unchanged.
- Keep all OAuth/browser-messaging knowledge inside `apps/chat`; `libs/catalog` continues to receive only resolved `credentials` data and callbacks.

**Non-Goals:**
- No new badge states (`LOGGED IN`, `MY CREDS`, `ORG CREDS`) — #7778's positive-badge request is explicitly rejected at the product level.
- No change to the API-key login/logout flow's behavior (it already works correctly) beyond reusing its refresh functions from the OAuth path.
- No backend/OpenAPI changes — `loginToolset`/toolset list endpoints are unchanged.
- No support for OAuth flows initiated from a context where popups are always blocked (e.g. some in-app webviews) beyond surfacing a clear "popup blocked" error — no fallback full-page-redirect flow is introduced.

## Decisions

**1. Open a same-origin popup, sever its opener, then navigate to an HTTP(S) provider.**
`window.open()` is called synchronously (inside the click handler, before any `await`) with a same-origin placeholder/blank target so the popup reference is obtained and blocked-popup detection is reliable (a `null` return only happens on genuine blocking, not because `noopener` always returns `null`). While the placeholder is still same-origin, the app writes the popup-local redirect state and explicitly assigns `popup.opener = null`; only then does it navigate to the resolved authorize URL. `buildToolsetAuthorizeUrl` rejects non-HTTP(S) schemes before a popup is opened. Cross-origin navigation alone does not remove the provider's limited `WindowProxy` access to its opener, and a `javascript:` URL would execute in the inherited same-origin placeholder, so both the scheme allowlist and explicit opener severing are required.
*Alternative considered:* keep `noopener` and rely solely on `BroadcastChannel` for messaging (see Decision 2) with no same-origin popup step. Rejected because `noopener` popups cannot reliably be detected as "blocked" vs "opened" across browsers, which is exactly the ambiguity the existing code's comment works around — fixing the messaging gap without fixing detection leaves popup-blocked UX unresolved.

**2. Cross-window result reporting via `BroadcastChannel`, keyed by a per-flow id, not `sessionStorage` polling or `postMessage`.**
The OAuth `state` value (already generated via `crypto.randomUUID()` for CSRF purposes) doubles as the flow/channel correlation id. The opener subscribes to `BroadcastChannel(`toolset-oauth-${state}`)` before opening the popup; the callback posts a typed message (`{ type: 'success', toolsetId, credentialsLevel } | { type: 'failure', reason }`) to the same channel before `window.close()`. The opener closes/unsubscribes the channel on receiving a message or after a timeout.
*Alternatives considered:* (a) `window.postMessage` from the popup to `window.opener` — rejected because it depends on the opener relationship surviving cross-origin navigation, which is unreliable and was the same class of bug as today's `sessionStorage` issue; (b) polling `sessionStorage` for a "done" flag written by the callback — rejected because same-origin `sessionStorage` is not guaranteed to be shared between the opener tab and a popup depending on browser partitioning behavior (the actual root cause of the current bug), and polling adds latency and complexity `BroadcastChannel` avoids natively; (c) a server-side round-trip (SSE/WebSocket) — rejected as unnecessary infrastructure for a same-origin, same-device UI signal.

**3. Concurrency and cleanup: one flow id, timeout-bounded.**
Each `initiateOAuthLogin` call generates a fresh `state`/channel id, so concurrent logins for different toolsets (or retries) don't cross-talk. The opener sets a timeout (e.g. aligned with typical OAuth UX, on the order of minutes) after which it closes the popup, treats the flow as abandoned, closes its channel, and clears any busy state. Closing the popup prevents a late callback from completing login after the initiating tab has stopped listening. The popup's `closed` property is polled at a low frequency purely to detect manual closure, not as the primary result-transport mechanism.

**4. Redirect-state handoff without relying on popup-local storage.**
Because the callback runs in the popup's own browsing context, `sessionStorage` written by the opener may not be visible there. The redirect state needed by the callback (`toolsetId`, `credentialsLevel`, `redirectUri`, `state`) is written directly into the same-origin placeholder popup's own storage before cross-origin navigation. Each OAuth flow has a separate popup browsing context, so the existing `TOOLSET_REDIRECT_STATE_KEY` can be reused safely inside each popup; the unguessable OAuth `state` value provides result-channel correlation across concurrent flows.

**5. `FavoriteCard.tsx` reuses `CredentialsBadge` + `getCredentialsBadgeState` unchanged.**
No new badge logic; `FavoriteCard` gains a `credentials` prop (already available on the underlying toolset item, mirroring `Card.tsx`) and renders `<CredentialsBadge credentials={item.credentials} loggedOutLabel={...} />` the same way `Card.tsx` does.
*Alternative considered:* introduce a shared `ToolsetCardChrome` wrapper to de-duplicate badge rendering across `Card` and `FavoriteCard`. Rejected as out of scope — the fix is additive (one missing prop/render), not a refactor of card composition, per the "don't add abstractions beyond what the task requires" guidance.

## Risks / Trade-offs

- **[Risk]** Some browsers/extensions still block the initial synchronous `window.open` even when called in a click handler → **Mitigation:** treat a `null` return from the synchronous same-origin `window.open` as a genuine "popup blocked" state and surface the existing (or a new) translated error notification instead of silently failing.
- **[Risk]** `BroadcastChannel` is unsupported in very old browsers → **Mitigation:** the repo's supported browser matrix already assumes evergreen browsers (React 19/Vite 8 target); no polyfill is planned, but note this in Open Questions for confirmation.
- **[Risk]** User manually closes the popup before completing OAuth → **Mitigation:** `popup.closed` polling triggers a "cancelled" outcome that resets busy state and shows no false success notification.
- **[Risk]** Timeout fires just as a slow success message arrives → **Mitigation:** cancel the timeout as soon as any message (success or failure) is received on the channel; treat channel messages as authoritative over the timeout path.
- **[Trade-off]** Correlating the `BroadcastChannel` name with the CSRF `state` value means the state must remain unguessable (it already is, via `crypto.randomUUID()`) since channel names are otherwise not secret — acceptable because the channel only carries a login-result signal, not credentials or tokens.

## Migration Plan

- Frontend-only, same-origin behavior change — no data migration, no backend deploy coordination needed.
- Roll out behind normal PR review/CI; no feature flag needed since the change is strictly additive UX (busy/success/failure feedback) plus a bug fix (missing refresh), with no behavior users could depend on the "old" way (silent popup close) continuing.
- Rollback is a straight revert of the frontend commit(s); no persisted-state migration to undo.

## Open Questions

- Confirm whether `BroadcastChannel` needs a `localStorage`-event fallback for any explicitly supported browser in this project's compatibility target, or whether evergreen-browser assumption is sufficient (leaning: sufficient, per current stack).
- Confirm the exact OAuth pending timeout duration (proposed: align with existing UX copy/timeouts elsewhere in the Editor, e.g. 2–5 minutes) with product/design.
