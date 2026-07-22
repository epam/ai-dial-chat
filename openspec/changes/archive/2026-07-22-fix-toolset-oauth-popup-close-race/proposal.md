## Why

Toolset OAuth login intermittently completes on the backend but shows nothing in the UI: no
success notification, and the toolset list/capabilities never refresh. Root cause is a race in
the callback popup handshake — the popup posts its login result over `BroadcastChannel` and then
closes itself on a fixed ~50ms timer, while the opener polls `popup.closed` and only waits a
further ~300ms grace period before giving up and treating the attempt as a user cancellation. Under
load, the opener can observe the popup closed before the browser has flushed the
`BroadcastChannel` message, and the ~300ms grace window is not always enough to recover. The
existing best-effort re-check (`getToolset` after a `Cancelled` result) reduces but does not
eliminate this, since it can itself race the backend's own eventual consistency and swallows its
own failures silently by design. This reproduces identically in both places that drive an OAuth
toolset login — the Catalog Details Panel and the Toolset Editor's Auth section — because both
share the same `initiateOAuthLogin` / `waitForToolsetOAuthResult` utilities.

## What Changes

- Change the OAuth callback handshake so the **opener** closes the popup, not the popup itself:
  the popup posts its result over `BroadcastChannel` and waits; the opener's `onmessage` handler
  resolves the result and then calls `popup.close()`. Since the message is guaranteed to be
  received before the popup ever closes, the `popup.closed`-before-message race is eliminated for
  the success/failure path.
- Keep a short safety-net auto-close timer inside the popup (fires only if the opener never closes
  it — e.g. the opener tab was closed or navigated away before processing the message), so the
  popup never lingers as an orphaned window.
- Keep the existing `popup.closed` polling + grace period in the opener as the mechanism for
  detecting a **genuine** manual cancellation (user closes the popup before any result was ever
  posted) — this path has no race today since there is no message to lose, so it is unchanged.
- Keep the existing best-effort `getToolset` re-check on a `Cancelled` result as a secondary
  safety net for edge cases the handshake redesign doesn't cover (e.g. the opener itself was
  closed) — not removed, just no longer the primary defense against the common case.
- Fix a secondary, smaller notification gap found during investigation: the Toolset Editor's
  Auth section shows no success notification on a successful **API-key** login (`AuthSection.tsx`),
  unlike its sibling OAuth branch and unlike the Catalog's login handler. Add the missing success
  toast there for consistency.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `toolset-authentication`: the "OAuth redirect and callback handshake" requirement changes who
  closes the callback window and when (opener-driven close on message receipt, with a popup-side
  safety-net timeout, instead of the popup closing itself on a fixed short delay); adds a success
  notification for the API-key login path in the Toolset Editor's Auth section.

## Impact

- `apps/chat/src/utils/toolsets.ts` — `waitForToolsetOAuthResult` closes the popup itself in its
  `onmessage` handler instead of relying on the popup to self-close.
- `apps/chat/src/pages/ToolsetAuthCallback.tsx` (or equivalent OAuth callback route component) —
  stops calling `window.close()` right after `postMessage`; adds a bounded safety-net auto-close
  timer instead.
- `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx` — add success notification on
  the API-key login success path.
- No backend/API changes. No change to the Catalog Details Panel's `CatalogView.tsx` login
  handler beyond the shared utility behavior it already consumes.
