## Context

The existing connector package owns two protocol families: uppercase visualizer messages and camelCase editor lifecycle events plus unprefixed editor actions. `ChatVisualizerConnector` exposes both, but its `sendReadyToInteract()` is the visualizer signal and its editor message shape is an open record. `AppEditorIframe` independently switches on the wire strings.

Observed traces show CodeApps sending only visualizer readiness, while DIAL Loop and Mind map send explicit editor readiness and can recover from a logged-out state in the same frame. A dedicated typed adapter must preserve those distinctions and the deployed editor wire format.

## Goals / Non-Goals

**Goals:** share the editor envelope types and validation; isolate the two directions; verify both sender origin and window; migrate Chat without changing externally deployed message formats; retain the readiness-timeout recovery already implemented for #9539.

**Non-goals:** new wire version, negotiation, session or request identifiers, promise-based save correlation, external editor deployment changes, backend/network fixes, or new UI/strings. A missing `readyToSave` remains a missing readiness signal.

## Decisions

### Dedicated adapters in the existing package

Add `AppsEditorHost<TGeneral = unknown, TCredentials = unknown>` and `AppsEditorClient` beside the existing visualizer connectors. Each attaches a message listener and removes it on `destroy()`; destruction is idempotent and disables outgoing sends. The caller owns the iframe and creates a new host adapter for its load lifecycle.

The alternative of changing `ChatVisualizerConnector.sendReadyToInteract()` would silently break visualizers. Its existing methods and wire messages stay compatible; the loose editor API is deprecated in favor of the explicit editor client.

### Shared typed envelopes, unchanged wire format

Use discriminated `AppsEditorClientMessage` and `AppsEditorHostMessage<TGeneral, TCredentials>` unions. Client lifecycle messages use `AppsEditorEvents` values in the local API; serialization adds the exact `${applicationName}/` prefix and parsing removes it. Save, dirty/validity, and auth action messages keep their existing unprefixed values and field placement.

The parser validates envelope fields according to direction. Preserve observed compatible forms: top-level or nested save errors; nested or legacy top-level dirty state; `SAVE_SUCCESS.hasChanges` normalizes to `false` unless it is exactly `true`. `TRIGGER_SAVE` can omit `general` for Preview. General metadata, application payloads, and credentials are opaque to the library; applications validate their own data.

A strict new wire envelope was rejected for this release because existing editors are independently deployed. Parser compatibility is explicit and tested rather than accepting arbitrary objects as typed messages.

### Window and origin are supplied capabilities

The host receives `targetWindow`, `targetOrigin`, and `applicationName`; the client receives `hostWindow` (defaulting to `window.parent`), `hostOrigin`, and `applicationName`. Both verify exact `event.source` and normalized `event.origin` before delivering messages. Wrong-direction or malformed messages never reach `onMessage`.

The optional host `onActivity` callback can observe a message from the expected source and origin even when it is outside the editor contract. Chat uses this only for liveness, preserving the distinction between an iframe that responds and an editor that is safe to save. It does not grant readiness.

### Keep application behavior at the edge

`AppEditorIframe` supplies the window, origin, and schema namespace and handles normalized callbacks. It retains toolset OAuth, credentials retrieval, feature flags, domain validation, translations, and React state. The library imports no app modules, generated clients, contexts, endpoints, session state, or configuration and adds no dependencies.

Chat clears its logged-out flag when `ReadyToSave` arrives, and revokes save readiness when `LoggedOut` arrives. `QuickAppSetup` retains its separate readiness-timeout and save-error state; lifecycle changes do not erase save failures. The iframe load callback restarts the readiness deadline, while unrelated renders do not.

## Risks / Trade-offs

- **Missing external readiness:** CodeApps currently sends visualizer events only. → Its editor must adopt `AppsEditorClient` or explicitly send the current editor readiness message after initialization; Chat cannot infer safe saving from uppercase readiness.
- **No generation/request correlation:** a source window and origin can survive same-origin navigation, and old save results lack request IDs. → Preserve existing behavior; a future versioned protocol requires coordinated rollout and is outside this change.
- **Stricter sender validation:** tests or integrations that dispatch source-less synthetic messages will be ignored. → Use the real configured window in integration tests and retain actual browser wire compatibility.
- **Opaque domain payloads:** generics document outgoing data without validating application schemas. → Receiving apps keep domain validation before use.

## Migration Plan

1. Add the typed API and protocol tests to the existing package, preserving legacy connectors.
2. Migrate Chat's `AppEditorIframe` to `AppsEditorHost` and exercise current-wire editor messages.
3. Publish the package through the repository's normal release process separately from this code change. External editors can migrate independently because the wire format is unchanged.
4. Editors obtain the exact namespace from the host's `applicationName` parameter, supply a trusted host origin, and emit `sendReadyToSave()` only after model initialization succeeds.
5. Reverting the Chat migration restores its local handler without requiring an editor rollback. No data migration is needed.

## Open Questions

None blocking this bounded implementation. A future versioned protocol and the schedule for external editor adoption remain separate work.
