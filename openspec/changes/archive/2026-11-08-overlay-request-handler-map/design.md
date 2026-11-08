## Context

`OverlayProvider` receives host requests over `postMessage`.

- `SET_OVERLAY_OPTIONS` is checked against the origin allowlist.
- Every other request must come from the established host origin.
- Five request types go to the active-conversation bridge.
- Seven request types go to the conversation-list side:
  - five of them call the list bridge;
  - `GET_SELECTED_CONVERSATIONS` is answered from the tracked conversation id;
  - `SELECT_CONVERSATION` navigates through the bridge and answers once the target registers as active.

Before this change the routing used two `ReadonlySet`s and an `if` chain. Execution used two `switch` statements, each with a `default` that answered `undefined`.

## Goals / Non-Goals

**Goals**
- A new `OverlayRequestType` does not compile until it is routed. Routing it to a bridge does not compile until that bridge has a handler.
- One place posts the response or the structured error.
- Behavior stays identical. The existing spec of 1466 lines, plus new characterization tests, passes unedited.

**Non-Goals**
- The protocol (`libs/chat-overlay`) does not change.
- The handshake, `SET_OVERLAY_OPTIONS` handling and event emission are not restructured.
- `OverlayContext` is not split into several providers.

## Decisions

### D1. Routes are an `as const satisfies Record<OverlayRequestType, OverlayRequestRoute>` table

`OverlayRequestRoute` is a string enum with five routes: `HostOptions`, `ActiveConversation`, `ConversationList`, `SelectedConversations` and `ConversationSelection`.

- **`satisfies`** makes a missing request type a compile error.
- **`as const`** keeps each entry's literal route, so `OverlayRequestTypeRoutedTo<R>` can derive the set of request types for a route.
- **Why `GET_SELECTED_CONVERSATIONS` and `SELECT_CONVERSATION` have routes of their own:** they are not plain bridge calls. Giving them their own routes keeps the list handler table to the five types that are plain bridge calls.

### D2. Handler tables are keyed by the derived route types

`ACTIVE_CONVERSATION_HANDLERS: Record<OverlayRequestTypeRoutedTo<ActiveConversation>, BridgeRequestHandler<ActiveConversationBridge>>`, and likewise for the list.

- A handler returns the response promise, or `null` for a payload that breaks the contract.
- A handler may throw.
- This is the old switch-branch contract, so `respondFromBridge` keeps the same three outcomes: `InvalidPayload`, `RequestExecutionFailed` on a throw or a rejection, and the response otherwise.

The unreachable `default: Promise.resolve(undefined)` branches are gone, because routing guarantees a handler.

### D3. Module-level, not hook-level

The handlers, guards and queue helpers do not close over provider state, so they live in plain modules under `overlay/handlers/`. Only `respondFromBridge` needs `postToHost` and `postRequestError`, so it stays a `useCallback` in the provider. The listener's dependencies stay stable, as `chat-overlay-app-mode` requires.

### D4. Bridge interfaces move to `overlay/bridges.ts`

The handler modules need the bridge types. Importing them from `OverlayContext.tsx` would create a module cycle. Two bridge-hook specs imported the types from `OverlayContext`, and they now import from `bridges.ts`. No production code imported them.

## Risks / Trade-offs

- **The derived route types cost readability.** `OverlayRequestTypeRoutedTo` is a mapped-type trick, and the two tables are its only users. The gain is that adding a request type is checked end to end at compile time. This was verified by deleting a route and a handler and watching `tsc` fail.
