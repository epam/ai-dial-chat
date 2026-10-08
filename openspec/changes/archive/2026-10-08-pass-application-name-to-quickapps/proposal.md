move on to implementation in both repos # Proposal

## Why

The embedded QuickApps editor needs to know the application name (the schema `displayName`, which is also the `${displayName}/` prefix of its postMessage types). Today QuickApps reads it from its own env `CUSTOM_CLIENT_VARIABLES.applicationName`, so each schema needs its own deployed instance or manual operator configuration that must match chat's schema display name. A sibling QuickApps change removes that env; chat must supply the value instead so one deployed QuickApps instance can serve different applications.

## What Changes

- `AppEditorIframe` adds an `applicationName` query parameter to the editor iframe URL, equal to `schema.displayName`, URL-encoded; omitted when `displayName` is empty/missing.
- The postMessage prefix matching and the new param derive from one shared value in `AppEditorIframe`, so they cannot drift.
- Iframe query keys (`authProvider`, `id`, `theme`, `applicationCredentials`, `applicationName`) move into a small enum in `apps/chat/src/types/apps-editor.ts`.
- Unit tests in `AppEditorIframe.spec.tsx` cover the param; the `app-editor-flow` spec is updated. Not a breaking change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-editor-flow`: requirement "App editor iframe component" gains the `applicationName` query parameter and scenarios. The iframe URL requirement lives in `app-editor-flow`, not `quick-app-authoring`; `quick-app-authoring`, `custom-visualizers` and the docs contain no wording that tells operators to configure the name on the QuickApps side, so they need no change.

## Alternatives considered

- Keep per-instance env on QuickApps (status quo): rejected, forces one deployment per application name.
- Send the name via a postMessage handshake: rejected, QuickApps needs it at boot, before any message exchange; the query string is already the channel for `authProvider` and `theme`.
- Chosen: query param derived from `schema.displayName`, the value chat already uses for message prefixes.

## Impact

- Code: `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` (closest model: its existing `URLSearchParams` block and the single-source `targetOrigin` memo), `apps/chat/src/types/apps-editor.ts`, tests in `apps/chat/src/pages/ApplicationEditor/setup/tests/AppEditorIframe.spec.tsx`.
- Docs: `docs/architecture.md` and `apps/chat-api/README.md` do not tell operators to configure the name on the QuickApps side; nothing to update there.
- i18n: none (no user-visible strings). RTL: none. Feature flags: none. No backend, generated-client, `libs/*` or provider changes.
- Backward compat / rollback: additive. Newer chat with an older QuickApps is harmless (extra param ignored). Revert by removing the param. Rollout order: deploy chat before QuickApps.

## Non-goals

- Changing the postMessage protocol, `ApplicationSchemaSummaryDto`, or `schema.editorUrl` handling.
- Any QuickApps-side change (separate sibling change).
- Schema apps without `editorUrl` (no iframe).

## Acceptance criteria

- Iframe URL contains `applicationName=<encoded displayName>`; absent when displayName is empty.
- Message matching still uses `${displayName}/...` and both derive from one value.
- `AppEditorIframe.spec.tsx` covers inclusion, encoding of `Quick app 2.0`, omission when empty, and re-keying on change; lint, typecheck and `npm run validate:specs` pass.
