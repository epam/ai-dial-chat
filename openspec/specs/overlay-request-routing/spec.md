# overlay-request-routing Specification

## Purpose

How the chat app routes overlay requests from the host and executes them against the page bridges: an exhaustive route table per request type and exhaustive handler tables per bridge.

## Requirements

### Requirement: Every overlay request type has a route

`apps/chat/src/context/overlay/handlers/request-routes.ts` SHALL map every `OverlayRequestType` to an `OverlayRequestRoute` in one table, typed so that a request type without an entry fails to compile. `OverlayProvider`'s `message` listener SHALL choose the handling path from that table:

- `SET_OVERLAY_OPTIONS` goes to the origin-allowlist handshake.
- Every other route first requires the sender origin to equal the established host origin.

#### Scenario: Requests from an untrusted origin are ignored

- **WHEN** a request of any route other than `HostOptions` arrives from an origin that is not the established host origin
- **THEN** no bridge is called and no response is posted

### Requirement: Bridge requests are executed through exhaustive handler tables

`apps/chat/src/context/overlay/handlers/bridge-request-handlers.ts` SHALL define one handler table for each bridge.

- Each table SHALL be keyed by exactly the request types routed to its bridge, so a type routed there without a handler fails to compile.
- A handler SHALL return the response promise, or `null` when the payload breaks the request's contract.

`OverlayProvider` SHALL post the handler's resolved value as `<type>/RESPONSE`. It SHALL post `INVALID_PAYLOAD` with the message `The request payload does not match the <type> contract.` for `null`. It SHALL post `REQUEST_EXECUTION_FAILED` with the error message when the handler throws or its promise rejects.

#### Scenario: A malformed payload never reaches the bridge

- **WHEN** a `SET_TEMPERATURE` request arrives with a non-finite or non-numeric `temperature`
- **THEN** `setTemperature` is not called and the response carries `INVALID_PAYLOAD`

#### Scenario: A synchronous bridge throw is reported

- **WHEN** `getConversations` throws while `GET_CONVERSATIONS` is being handled
- **THEN** the response carries `REQUEST_EXECUTION_FAILED` with the thrown error's message
