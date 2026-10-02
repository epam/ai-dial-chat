## Why

### Problem

The supplied RED overview is useful as an additional example, but its export contains
installation-specific metadata and queries that can hide absent data or histogram overflow.

### Solution

Publish a sanitized, importable copy while retaining its Rate / Errors / Duration layout.

## What Changes

- Add `docs/examples/dashboards/07-bff-red-overview.json` with a selectable Prometheus source,
  cleared deployment selections, fresh dashboard identity, and a relative time range.
- Check all string fields for private information; do not include the original attachment.
- Preserve missing-data semantics, guard quantiles beyond the last finite histogram bucket,
  and explain completed-stream inclusion and the in-flight route-filter exception.
- Add a short entry and interpretation note to `docs/observability.md`.

### Non-goals

Backend changes, plugins, production Grafana writes, redesigning the supplied layout,
and modifying examples 00–06. No shared libraries or app UI changes.

### Acceptance criteria

The JSON uses a chosen Prometheus source, contains no exported identity or private deployment
data, and retains all 17 panels. Query checks cover active, idle, absent, filtered, and
overflowing-latency data. Documentation and formatting checks pass.

## Capabilities

### New Capabilities

- `bff-red-dashboard`: Portable, sanitized RED overview using existing HTTP transport metrics.

### Modified Capabilities

None.

## Impact

Follow `docs/examples/dashboards/06-bff-endpoint-traffic.json:1` for import inputs and datasource
variables, and dashboard 00 for missing-data and histogram-boundary guards. Native Grafana owns
state, keyboard controls, and layout; English panel labels add no app i18n keys.

A verbatim export retains deployment bindings and misleading queries; a full redesign is
unnecessary. Sanitize and repair those boundaries only. Removing the new JSON and guide entry
rolls back the addition without changing existing imports or backend behavior.
