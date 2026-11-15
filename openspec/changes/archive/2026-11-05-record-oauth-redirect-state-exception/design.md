## Context

`libs/chat-hooks/src/oauth/popup.ts` writes `ToolsetRedirectState` (base64-wrapped JSON) into `popup.sessionStorage` under `TOOLSET_REDIRECT_STATE_KEY`. It does this before setting `popup.opener = null` and navigating the popup to the provider.

After the provider redirects back, `useOAuthCallbackCompletion` runs on the host's callback route inside that same popup. It reads and removes the key from its own `sessionStorage`. The opener and the popup do not share a `sessionStorage` partition, so the handoff only works because one module controls both the key and the format.

## Decisions

### D1 — Exception, not a port

A port only pays off if a host has a reason to choose the storage. Here it has none:

- The storage has to be the popup's `sessionStorage`. The opener's storage does not reach the callback, `localStorage` would leak across flows, and an in-memory store does not survive the navigation.
- The key's only job is to be equal on both ends.

Making it injectable gives a host only the ability to break the flow.

### D2 — Bounded scope

The exception names the one key and the one format. It states that the stored state carries only flow-correlation values: `toolsetId`, `credentialsLevel`, `redirectUri`, `state`, `resourceKind` and `offlineUsageConsent`. Access and refresh tokens, client secrets and authorization codes are never stored. `state` is the CSRF correlation value that already travels in the authorize URL.

The exception does not license any other storage key in any lib. That includes another storage key in `chat-hooks`, even another OAuth one, which would need its own justification in its change's design doc. This matches how the two existing narrow exceptions are written.

### D3 — `TOOLSET_REDIRECT_STATE_KEY` stays exported

`apps/chat` tests seed the redirect state through the exported constant rather than repeating the literal. Keeping the export means the host never spells the key itself. Removing it would be a breaking change for no gain.

## Risks / Trade-offs

- **[The exception is read as a precedent]** The libs.md text says that the exception covers this key only, and the new spec requirement makes any widening a spec change.
