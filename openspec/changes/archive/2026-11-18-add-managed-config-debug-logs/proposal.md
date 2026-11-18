## Why

While enabling managed configuration for `ai-dial-chat` on dev, the logs did not show whether a pod had started with the managed settings or whether the reader was reading at all: the reader logs only state transitions.

## What Changes

- One startup log line in every mode: mode, instance mapping, active keys, refresh interval, maximum staleness, and whether a reader key is set (never the key).
- One debug line per read: instance, read result, refresh outcome, active revision, and duration.

Nothing else changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `managed-config-runtime-reader`: the observability requirement adds the two log lines.

## Impact

`apps/chat-api/src/app-config/managed-runtime/managed-runtime.service.ts` and one spec. No API, metric, or behavior change.
