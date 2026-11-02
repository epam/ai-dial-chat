## Why

The existing HTTP dashboards rank recent latency at the range end; selecting 24 hours does not produce a daily latency ranking. Endpoint usage counts requests over the whole period, but no current metric separates Core transport time from the rest of a Chat request.

## What Changes

- Add request-local total/Core/outside-Core timing, including response body transfer and overlapping Core calls.
- Add dashboard 08 with whole-period endpoint distributions, slow-request counts, attribution, and separate rankings by average and accumulated duration.
- Add optional Tempo results for individual slow requests with timing attributes and trace navigation.
- Document measurement limits, existing dashboard coverage, and rollout.

Acceptance criteria: each ended request contributes one observation per phase; Core overlap is counted once; total equals Core plus outside-Core; independent requests and work after settlement cannot contaminate the measurement. The dashboard defaults to 24 hours and distinguishes ordinary requests from streams.

## Capabilities

### New Capabilities

- `request-latency-attribution`: Per-request timing phases, period statistics, and individual slow-request trace investigation.

### Modified Capabilities

None. Existing transport, handler, generation, and dashboard contracts remain unchanged.

## Impact

Backend telemetry middleware, shared `DialClientService.fetchCore`, bootstrap, telemetry tests, Grafana JSON, and observability/architecture docs. No business endpoint, generated client, library, environment variable, or product translation changes. Backend conventions follow `apps/chat-api/AGENTS.md`.

Alternatives: extending 06 would mix usage and latency investigations; using only traces would make daily statistics depend on sampling and retention. A dedicated metrics dashboard with optional trace detail supports both purposes. This is additive and can be rolled back by reverting the instrumentation and removing dashboard 08. Existing metric bucket layouts are preserved.
