## MODIFIED Requirements

### Requirement: Truthful, bounded terminal attributes

`dial.chat.http.response.duration` SHALL carry `http.request.method` (same bounded set as the arrival instrument), `http.route` (the Nest-resolved route template when available, else the bounded literal `unmatched` — never the raw requested path), `http.response.status_code` (present only when the response's headers were actually sent), `dial.chat.http.outcome` (one of `completed`, `aborted_before_response`, `aborted_during_response`, `error`), and `dial.chat.http.transport_kind` (one of `ordinary`, `streaming`, `unmatched`, derived from a fixed, explicit list of long-lived SSE route templates). No attribute on any of the three instruments in this capability SHALL ever be a raw URL, query string, or any user/conversation/deployment identifier. The explicit set in `apps/chat-api/src/telemetry/http-lifecycle-metrics.ts` SHALL include the finite titles stream even though it closes after enrichment.

#### Scenario: Matched business route reports its template

- **WHEN** a request to `/api/v1/themes/icon` completes
- **THEN** the terminal data point's `http.route` is the matched route template, not the literal requested path

#### Scenario: Streaming route is classified as streaming

- **WHEN** a request to `/api/v1/conversations/completions`, `/api/v1/conversations/completions/attach`, `/api/v1/conversations/watch`, `/api/v1/conversations/titles/stream`, or `/api/v1/client-channel/subscribe` completes or is aborted
- **THEN** the terminal data point's `dial.chat.http.transport_kind` is `streaming`

#### Scenario: Every other matched route is ordinary

- **WHEN** a request to any matched route not in the streaming list completes
- **THEN** the terminal data point's `dial.chat.http.transport_kind` is `ordinary`

#### Scenario: Status code omitted before headers are sent

- **WHEN** a request's terminal outcome is `aborted_before_response`
- **THEN** the terminal data point has no `http.response.status_code` attribute

#### Scenario: No raw path or identifier ever appears

- **WHEN** a client requests an unmatched or parameterized path containing an identifier (e.g. `/api/v1/conversations/abc-123-def-456`)
- **THEN** no attribute on any of the three instruments contains that raw path segment
