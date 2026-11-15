## Why

`apps/chat/src/context/overlay/OverlayContext.tsx` was 1058 lines. It routed overlay requests through two `Set`s of request types and an `if` chain, and executed them through two `switch (type)` dispatchers, one per bridge. Each switch ended in a `default` that answered `undefined`, so a new `OverlayRequestType` compiled without a route or a handler and was silently ignored or answered empty. The run-respond-or-error block was duplicated for the two bridges, and the payload guards and pending-request queue helpers sat in the same file. This is refactoring plan item F9.

## What Changes

- Add `OVERLAY_REQUEST_ROUTES`, an exhaustive table that maps every `OverlayRequestType` to an `OverlayRequestRoute`. It replaces the two request-type sets and the listener's `if` chain.
- Replace the two `switch` dispatchers with `ACTIVE_CONVERSATION_HANDLERS` and `CONVERSATION_LIST_HANDLERS`. Each is keyed by exactly the request types routed to its bridge, so a type routed there without a handler does not compile.
- Merge the duplicated run-respond-or-error block into one `respondFromBridge` callback.
- Move the bridge interfaces to `overlay/bridges.ts`. Move the payload guards, the pending-request queue helpers, the routes and the handler tables to `overlay/handlers/*`.
- Add characterization tests for request types and error paths the spec did not cover yet.

No behavior change: the overlay protocol, the error codes and messages, the queuing rules and the trusted-origin checks are unchanged.

## Capabilities

### New Capabilities

- `overlay-request-routing`: overlay requests are routed and executed through exhaustive typed tables.

### Modified Capabilities

None. `chat-overlay-app-mode` still holds: `OverlayContext.tsx` owns the listener, the handshake, the host domain and the bridge registries.

## Impact

- `apps/chat/src/context/overlay/`: `OverlayContext.tsx` (1058 → 745 lines), new `bridges.ts` and `handlers/` (`request-routes.ts`, `bridge-request-handlers.ts`, `payload-guards.ts`, `pending-requests.ts`).
- Two bridge-hook specs import the bridge types from `bridges.ts`.
- `docs/architecture.md`: the source-tree line for `context/overlay/`.
- No lib, protocol, or public API change.
