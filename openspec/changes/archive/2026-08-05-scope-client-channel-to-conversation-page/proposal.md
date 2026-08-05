## Why

`ClientChannelProvider` currently opens (and keeps reconnecting) the client-channel SSE
subscription for the whole app session as soon as `liveChatInteraction` is enabled — it is
mounted at the app root in `apps/chat/src/main.tsx` and self-connects on mount, regardless of
which page the user is on. `toolset/signin` and `external_service/signin` events, however, can
only ever be pushed by DIAL Core while a completion is actively streaming, which only happens on
the conversation page. Keeping the channel open on every other page (marketplace, toolset editor,
settings, etc.) holds an unnecessary long-lived SSE connection and reconnect/backoff loop open for
no benefit. The legacy Redux-epics implementation (`development` branch) only opened the
subscription as a side effect of sending a message and tore it down again shortly after the stream
settled — this change restores that scoping under the current React-context architecture.

## What Changes

- `ClientChannelProvider`'s connect/reconnect lifecycle is additionally gated on "the user is
  currently on the conversation page," on top of the existing `liveChatInteraction` feature flag
  check. Leaving the conversation page disconnects the channel (mirroring the existing
  flag-disabled teardown path); returning to it (with the flag enabled) reconnects.
- No change to the SSE transport, RPC parsing, reconnect/backoff mechanics, or the
  `report`/`unsubscribe` BFF endpoints — only *when* the provider is allowed to hold an open
  connection changes.
- `ensureConnected()` (called by `useConversationStream` right before `streamCompletion`) continues
  to work as the same best-effort nudge; it remains a no-op if the page-level gate is not active.

## Capabilities

### Modified Capabilities

- `client-channel-protocol`: the `liveChatInteraction` feature-flag gating requirement is extended
  with an additional page-scope precondition — the frontend SHALL only hold an open client-channel
  subscription while the user is on the conversation page, in addition to the flag being enabled.

## Impact

- `apps/chat/src/context/ClientChannelContext.tsx` — connect/disconnect effect gains a
  route-derived condition alongside `isEnabled`.
- `apps/chat/src/main.tsx` and/or route-level wiring — needs a way for the provider to know the
  active page/route without every consumer re-deriving it (e.g. reading the current route via
  `react-router`'s `useLocation`/`matchPath`, consistent with existing routing conventions).
- No backend changes; no changes to `apps/chat-api`.
