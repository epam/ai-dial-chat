## Why

### Problem

During the investigation following issue #9539, a separate CodeApps trace exposed incompatible readiness messages between that editor and Chat: CodeApps emits the visualizer's uppercase `READY` / `READY_TO_INTERACT`, while editor readiness requires `${applicationName}/readyToSave`. DIAL Loop and Mind map also demonstrate a valid `loggedOut` → `readyToSave` recovery. The current library mixes visualizer helpers with loosely typed editor messages, and the host maintains a separate parser.

The closest existing implementation is `libs/visualizer-connector/src/lib/ChatVisualizerConnector.ts:111`, whose `sendEditorMessage` accepts an open record; the host's separate switch lives in `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`. This change follows the existing connector's DOM listener lifecycle while giving the editor protocol its own typed API.

## What Changes

### Solution

- Add `AppsEditorHost` and `AppsEditorClient` to the existing connector package, with discriminated message types, direction-aware validation, and exact origin/window checks.
- Keep the deployed wire values and payload locations. Normalize supported legacy save-error and dirty-state forms at the receive boundary.
- Migrate Chat's application-editor iframe adapter to the shared host contract, including logout/readiness recovery.
- Preserve the existing visualizer API and deprecate its loose editor surface in favor of the dedicated client.
- Document migration for external editors, including the requirement to report real save readiness explicitly.

### Non-goals

- No version negotiation, session identifier, request correlation, save promise, or new wire envelope. Those require a coordinated external rollout.
- No synthetic save readiness from visualizer signals, DOM load, or an elapsed timeout.
- No changes to external editor deployments or their API/network failures.
- No new UI or translated strings, and no new React context or provider.

### Alternatives

| Option | Correctness and security | Delivery and compatibility |
| --- | --- | --- |
| Keep local switches and improve comments | Leaves message shapes and direction checks duplicated | Smallest patch, recurring integration errors remain |
| Dedicated typed adapters over current wire format | Shares validated envelopes and checks the expected sender window and origin | Selected: additive library API; existing editors retain their wire protocol |
| Replace the protocol with a versioned session/request envelope | Can correlate reloads and concurrent requests | Deferred: coordinated migration across independently deployed editors |

## Capabilities

### New Capabilities

None; this extends the existing connector package and editor requirements.

### Modified Capabilities

- `custom-visualizers`: add the typed editor host/client contract alongside the unchanged visualizer protocol.
- `quick-app-authoring`: require the shared validated editor boundary and reversible logout/readiness transitions.

## Impact

The shared-library change is intentional: `libs/visualizer-connector` already owns these wire constants. It receives windows, origins, the application namespace, and callbacks; `AppEditorIframe` continues to own routing, schema resolution, authentication actions, credentials acquisition, feature flags, and translated UI. General metadata and credentials remain generic/opaque values, with no app or generated-client imports in the library. No runtime dependency is added.

The new API is additive. Reverting the Chat migration restores its local adapter without changing external editors. Existing `ChatVisualizerConnector` calls remain supported; uppercase visualizer events keep their existing meaning.

### Acceptance criteria

- Host and client exchange the existing editor messages through typed APIs; malformed envelopes, wrong-direction messages, other origins, and other windows cannot invoke domain callbacks.
- Existing supported legacy field placements still work; explicit `readyToSave` remains mandatory.
- Chat handles `loggedOut` → `readyToSave` and the reverse without a reload, preserving the separate readiness-timeout and save-error states.
- Focused protocol and Chat tests pass, existing visualizer compatibility tests pass, and documentation/spec validation passes.
