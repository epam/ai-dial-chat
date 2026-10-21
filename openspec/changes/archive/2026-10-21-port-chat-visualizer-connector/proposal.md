## Why

The iframe half of the visualizer protocol, `ChatVisualizerConnector`, exists only as the npm package `@epam/ai-dial-chat-visualizer-connector`, and only on the legacy `0.x` line (`0.49.0`; `development` is `0.50.0-dev.*`). The 1.x package `@epam/ai-dial-visualizer-connector`, built from `libs/visualizer-connector`, carries the host half alone. An iframe that wants to stay on the 1.x line has no connector to use.

Application editors are such iframes. QuickApps (`ai-dial-quickapps-frontend`) and the DIAL Loop editor run inside DIAL Chat's application editor. QuickApps uses `ChatVisualizerConnector@0.47` for `READY` / `READY_TO_INTERACT`, then posts `${applicationName}/readyToSave` and `${applicationName}/loggedOut` by hand, because no package declares them. Their wire values live only in `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`, so an editor has to copy the strings. The DIAL Loop editor has no 1.x class to use and reimplements the handshake itself.

The port of the host half (`2026-10-07-port-visualizer-connector`) listed the iframe half as a non-goal and noted that the iframe side "will also need these constants later". This change does that port.

## What Changes

- `libs/visualizer-connector` adds `ChatVisualizerConnector`, ported from npm `0.49.0` with the same constructor, methods and wire messages:
  - `sendReady()`, `sendReadyToInteract()`, `sendMessage()`, `send()`, `sendPMResponse()`, `destroy()`;
  - `SEND_VISUALIZE_DATA` / `SEND_GROUPED_VISUALIZE_DATA` handling with `/RESPONSE` acknowledgements;
  - one or several allowed hosts, `'*'` as the first entry to accept any origin.
- New `AppsEditorEvents` enum (`ReadyToInteract`, `ReadyToSave`, `LoggedOut`, `UpdatedApplicationSuccess`) with the camelCase wire values the application editor matches on, and `sendReadyToSave()` / `sendLoggedOut()` on the connector.
- New `AppsEditorMessages` enum for the unprefixed save and auth messages the application editor exchanges (`TRIGGER_SAVE`, `SAVE_SUCCESS`, `SAVE_ERROR`, `VALIDITY_STATE`, `DIRTY_STATE`, `REQUEST_TOOLSET_LOGIN`, `TOOLSET_LOGIN_RESULT`, `REQUEST_TOOLSET_LOGOUT`, `TOOLSET_LOGOUT_RESULT`, `REQUEST_APPLICATION_CREDENTIALS`), with `sendEditorMessage()` to post them and an `onEditorMessage` callback to receive them.
- New data types, local to the package: `VisualizerAttachmentData`, `VisualizerGroupedAttachmentItem`, `VisualizerGroupedAttachmentsData`, `ChatVisualizerCallbacks`, plus `ChatVisualizerEventType`.
- Fixes over npm `0.49.0`:
  - inbound origins are compared exactly; `0.49.0` used `allowedHost.startsWith(event.origin)`, which let `https://chat.example.co` through for `https://chat.example.com`;
  - a missing `onData` is a silent no-op; `0.49.0` logged `console.warn`;
  - `onData` receives a layout-only payload without `mimeType`, as Chat 0.x's application editor sends it;
  - every `${appName}/…` request with a `requestId` is acknowledged, not only the two data requests;
  - messages from the connector's own window are ignored, so an unframed iframe does not hear itself.
- The package `description` and `README.md` describe both halves; the README gains a migration note from `@epam/ai-dial-chat-visualizer-connector`.

**Non-goals**

- Switching `apps/chat` to import `AppsEditorEvents` / `AppsEditorMessages` for its own `AppsEditorEvent`. The wire values are tested equal; replacing the app enum is a follow-up.
- Messages only QuickApps uses that DIAL Chat neither sends nor handles (`TRIGGER_AUTO_SAVE`, `RESET`, `AUTO_SAVE_COMPLETE`, `HEIGHT_CHANGE`, the unprefixed `READY`). Constants with no host behind them would describe a protocol that does not exist.
- Typed payload shapes per message; `AppsEditorMessage` carries `type` plus open fields.
- Publishing or deprecating `@epam/ai-dial-chat-visualizer-connector`, and the release version of this package.
- Any change to the host-side `VisualizerConnector` or to the wire protocol.

## Capabilities

### Modified Capabilities

- `custom-visualizers`:
  - "postMessage protocol constants" adds `AppsEditorEvents` and `AppsEditorMessages`;
  - "`VisualizerConnector` host-side manager class" no longer calls the iframe side out of scope;
  - "`ChatVisualizerConnector` iframe-side receiver" now specifies the workspace class, the editor events and the exact origin match.

## Impact

- **Code:** `libs/visualizer-connector/src/lib/ChatVisualizerConnector.ts` (new), its spec, `src/types/visualizer-connector.ts`, `src/models/visualizer-connector.ts`, `src/index.ts`.
- **Manifests:** `libs/visualizer-connector/package.json` (`description` only). No new dependencies.
- **Docs:** `libs/visualizer-connector/README.md`; `openspec/specs/custom-visualizers/spec.md` via the delta.
- **Library isolation:** the connector's inputs are the constructor arguments. It reads no env, auth, routing or i18n and does no logging.
- **Consumers:** none in this repo; the host application must not import the iframe half. QuickApps and the DIAL Loop editor can adopt it once a release is published.
- **Rollback:** revert the change. Nothing in the repo depends on the new exports.

**Acceptance criteria**

- `npx nx run-many -t lint typecheck build test -p @epam/ai-dial-visualizer-connector` passes, with a test per scenario in the delta.
- `npm run validate:docs` and `npm run validate:specs` pass.
