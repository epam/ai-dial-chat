## Context

`AppEditorIframe.tsx` embeds a QuickApps editor at `/apps-editor` via a cross-origin `<iframe>`,
already exchanging a small `postMessage` protocol with it (`AppsEditorEvent`: ready/save/updated).
QuickApps can host toolsets requiring OAuth or API-key credentials, but had no way to trigger
login/logout — the only existing login flow lived in `AuthSection.tsx` (Toolset Editor) and
`CatalogView.tsx`, both of which already have the toolset's auth config in hand from state before
calling `initiateOAuthLogin`. QuickApps has neither that config nor any business owning it.

An earlier attempt (`add-toolset-popup-signin`) had QuickApps build its own OAuth authorize URL,
open its own popup, and land on the shared `/toolset-editor/callback` route with a
QuickApps-specific `state` encoding and a `window.name` marker the callback branched on. That
design required QuickApps to independently know/fetch OAuth client config, added a second parallel
handshake on the one shared, IdP-registered callback route, and — in practice — never completed
end-to-end (the callback's `isQuickAppsPopup()` gate depended on cross-repo details this repo
could not verify or control). It has been fully removed; this change replaces it.

Separately, the toolsets API requires ids as already-percent-encoded strings (e.g.
`My%20Toolset`, matching the backend's `DEPLOYMENT_ID_PATTERN`/`TOOLSET_URL_PATTERN` allowlist,
which rejects raw whitespace). The `id`/`toolset` fields chat's own `listToolsets()` returns are
already in that form, so existing callers (`AuthSection`, `CatalogView`, `ToolsetEditor`) never
needed to encode anything themselves. QuickApps only knows the raw, human-readable id (e.g.
containing a literal space), so calling the toolsets API with it as-is 400s.

## Goals / Non-Goals

**Goals:**
- Let QuickApps trigger a toolset login or logout by `toolsetId` alone, with the host performing
  the OAuth/API work and reusing the existing admin login machinery (popup, `sessionStorage` +
  `BroadcastChannel` handshake, shared callback route) unchanged.
- Never let QuickApps see or need a toolset's OAuth client config (client id/secret,
  authorization/token endpoints).
- Fix the encoding mismatch between the raw id QuickApps sends and the percent-encoded form the
  toolsets API requires.
- Relax the logout request contract so a caller that only knows a `toolsetId` (no loaded auth
  config) can log out without an extra round-trip.

**Non-Goals:**
- Changing the admin ToolsetEditor/Catalog login/logout flows themselves (unchanged, still the
  reference implementation this reuses).
- Changing the OAuth callback route's contract, IdP `redirect_uri` registration, or the
  `sessionStorage`/`BroadcastChannel` handshake shape.
- Building anything on the `ai-dial-quickapps-frontend` side — out of scope for this repo; that
  side only needs to implement the `postMessage` contract documented below.
- A live result channel for the admin flow (unrelated, pre-existing gap, not touched here).

## Decisions

### D1. Host owns all OAuth config and API calls; the iframe only ever sends a `toolsetId`

`AppEditorIframe.tsx` gains two message handlers, `handleToolsetLoginRequest(toolsetId)` and
`handleToolsetLogoutRequest(toolsetId)`, triggered by `REQUEST_TOOLSET_LOGIN` /
`REQUEST_TOOLSET_LOGOUT` messages from the iframe. Both fetch/derive everything else
server-side or from the existing `getToolset` call — QuickApps never receives or constructs an
authorize URL, client id/secret, or endpoint.

- **Why not let QuickApps build the popup itself** (the previous design): duplicates OAuth
  config ownership across two codebases, and ties correctness to cross-repo details
  (`window.name`, a custom `state` encoding) this repo can't verify. Centralizing in the host
  means the exact same, already-tested admin login code path (`navigateToolsetOAuthPopup` +
  `waitForToolsetOAuthResult`) runs regardless of trigger source.

### D2. Login popup is opened synchronously, before any `await`, to preserve the user gesture

`handleToolsetLoginRequest` calls `openToolsetOAuthPopup()` (a plain `window.open('', '_blank')`)
as its first statement — before fetching the toolset's auth config — then navigates that same
popup once the config arrives. `initiateOAuthLogin` (the admin flow) instead validates config
*before* opening the popup, since it already has the config synchronously in hand; the two
call orders differ because only the async iframe-triggered flow needs to open first.

- **Why this ordering specifically**: the actual user click happened inside a cross-origin
  iframe and only reaches the host via an async `postMessage`; opening the popup as the first
  synchronous statement of the handler gives the browser's popup blocker the best chance of
  still treating it as user-triggered. Any `await` before `window.open()` risks the popup being
  blocked. This is a known browser-dependent behavior (transient activation propagating across
  `postMessage`), not a guarantee — `reason: 'popup-blocked'` is a real, expected outcome to
  handle, not just a defensive case.
- **Extraction**: `openToolsetOAuthPopup` and `navigateToolsetOAuthPopup` are extracted from the
  existing `initiateOAuthLogin` (`utils/toolsets.ts`) as the "open" and "build URL + navigate"
  halves, so `initiateOAuthLogin` itself is unchanged (same validate-before-open order, same
  tests) while the iframe flow reuses the navigate half after its own async lookup.

### D3. Logout needs no popup — a direct call, with the backend resolving `authenticationType`

Unlike login, logout has no OAuth round-trip, so `handleToolsetLogoutRequest` just calls the
existing `logoutToolset` endpoint directly. The existing endpoint required the caller to already
know and send `authenticationType`, which QuickApps has no way to know without an extra
`getToolset` call first.

- **Decision**: make `ToolsetLogoutBodyDto.authenticationType` optional; when omitted,
  `ToolsetsService.logoutToolset` resolves it itself via the same `getToolset` lookup the
  `GET /api/v1/toolsets/{toolsetName}` endpoint already uses, before calling DIAL Core's
  signout. This required adding a `bucket` parameter to `logoutToolset` (needed by that
  internal lookup).
- **Why fix it server-side instead of having the host call `getToolset` first**: the host could
  have fetched the toolset itself (mirroring login), but the backend already has this data on
  every `logoutToolset` call path — requiring every future caller (not just QuickApps) to
  re-fetch and pass back a field the server can derive itself is a redundant contract. This also
  simplifies existing callers going forward, though `AuthSection`/`CatalogView` are left passing
  it explicitly (harmless — an explicit value always takes precedence) since they already have
  it loaded and changing them isn't required by this change.
- **Alternative considered**: keep `authenticationType` required and have the host do
  `getToolset` → `logoutToolset` for the QuickApps path only. Rejected — adds an avoidable round
  trip and duplicates a lookup the backend can do once, in the same request, without a second
  network hop from the browser.

### D4. `encodeToolsetId` — percent-encode each `/`-segment before any backend call

Added to `utils/toolsets.ts`, mirroring the existing `encodeDeploymentId`
(`utils/deployment-id.ts`), which solves the identical problem for applications' raw
postMessage-protocol ids. `handleToolsetLoginRequest`/`handleToolsetLogoutRequest` encode the
raw `toolsetId` once at the entry point and use the encoded form for every backend call
(`getToolset`, `navigateToolsetOAuthPopup`, `logoutToolset`), while echoing the **original raw**
id back to the iframe in every result message, since that's what QuickApps sent and will match
against.

- **Why per-segment encoding, not a single `encodeURIComponent` over the whole string**: the
  generated `toolsetsApi` client already applies one `encodeURIComponent` pass over the whole
  `toolsetName` when building the URL (treating it as one opaque path segment per the backend's
  `@Get(':toolsetName')` route). Pre-encoding each segment (turning a literal space into `%20`
  but leaving `/` as a literal separator) means that single pass then correctly turns `/` into
  `%2F` and the already-encoded `%20` into `%2520` — the exact double-encoded wire form the
  backend's `DEPLOYMENT_ID_PATTERN`/`TOOLSET_URL_PATTERN` allowlist expects after Express's one
  decode pass. Encoding the whole string directly (single pass, no segments) would instead
  collapse `/` into `%2F` at the *raw* level and never reach the required double-encoded form
  for reserved characters within a segment.

### D5. Result payload includes refreshed `credentials`, matching Catalog's own refresh path

After a successful login or logout, both handlers call `getDeploymentDetails` →
`mapDeploymentDetailsDtoToEntityDetails` → `mapToolsetCredentials` — the same three calls
`CatalogView.handleFetchDetails` already makes to refresh its Details panel — and include the
result as `credentials` in the outgoing message. Best-effort: `undefined` on any failure, since
the `success` flag is already authoritative on its own.

- **Why reuse this specific path over a lighter one**: it's already the established,
  tested way this codebase turns a `DeploymentDetailsDto` into the `CatalogItemCredentials`
  shape a UI would want to render (auth type, per-level sign-in status, `isPublic`, API key
  header hint) — reusing it means QuickApps gets the identical shape/semantics Catalog's own
  UI relies on, with no new mapping code to maintain.

## Risks / Trade-offs

- **Popup blocked despite D2's ordering** → surfaced as `reason: 'popup-blocked'`; QuickApps is
  expected to show a generic retry prompt, not a silent failure. No further mitigation possible
  from this side — browser-dependent.
- **Cross-repo contract drift** — `ai-dial-quickapps-frontend` has no `openspec` of its own, so
  nothing enforces it stays in sync with the message contract here. Mitigation: this design doc
  and the accompanying `specs/toolset-authentication/spec.md` delta are the source of truth;
  any future payload shape change must be flagged as a breaking cross-repo change in the PR
  description.
- **`logoutToolset` internal signature change** (`bucket` param added) is a breaking change to
  that one internal service method's call sites, not to any external HTTP contract — all
  existing in-repo callers (the controller) were updated in the same change; no external
  callers of the TypeScript method exist outside this backend.
