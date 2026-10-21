## Context

`libs/visualizer-connector` (`@epam/ai-dial-visualizer-connector`) is the host half of the visualizer protocol, ported from npm `0.48.0` by `2026-10-07-port-visualizer-connector`. The iframe half is still the npm `@epam/ai-dial-chat-visualizer-connector` `0.49.0`, which depends on `@epam/ai-dial-shared@0.49.0` for its enums and data types.

DIAL Chat's application editor (`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`) frames editors and matches `${applicationName}/readyToInteract`, `/readyToSave`, `/loggedOut` and `/updatedApplicationSuccess`. Those values are declared only in `AppsEditorEvent` (`apps/chat/src/types/apps-editor.ts`).

## Goals / Non-Goals

**Goals:** an iframe-side connector on the 1.x line, wire-identical to npm `0.49.0`; the editor's prefixed events available to editors as constants and methods.

**Non-Goals:** see the proposal.

## Decisions

### D1. Same package, not a new lib

The iframe half lives in `libs/visualizer-connector` next to the host half. Both share the enums, and the earlier port's alternative (b) already rejected putting the constants in `libs/chat-shared`. A second package would split one protocol across two release trains. The cost is that a host bundle that imports `VisualizerConnector` also ships `ChatVisualizerConnector`; both are small, have no dependencies, and tree-shake.

### D2. Editor events as their own enum

`AppsEditorEvents` is separate from `VisualizerConnectorEvents`. The two sets have different consumers (the canvas vs the application editor) and different wire casing (`READY_TO_INTERACT` vs `readyToInteract`). Merging them would make `ReadyToInteract` ambiguous. `send()` accepts either (`ChatVisualizerEventType`).

The unprefixed save and auth messages (`TRIGGER_SAVE`, `SAVE_SUCCESS`, …) get a third enum, `AppsEditorMessages`. `send()` always prefixes, so they go through `sendEditorMessage()`, which posts the object unchanged: the host reads their fields at different depths (`hasChanges` and `error` at the top level, `isDirty` and `isValid` under `payload`), and reshaping them in the connector would break that. Inbound ones go to `onEditorMessage`, checked before the visualizer payload test because `TRIGGER_SAVE` may have no `payload`.

The set is exactly what `AppEditorIframe.tsx` sends or handles. QuickApps-only messages (`TRIGGER_AUTO_SAVE`, `RESET`, `AUTO_SAVE_COMPLETE`, `HEIGHT_CHANGE`) are left out: no host sends or reads them.

### D3. Local data types

`VisualizerAttachmentData` and `VisualizerGroupedAttachmentsData` are declared in the package, with `visualizerData` and `layout` typed as `Record<string, unknown>`. Importing `@epam/ai-dial-chat-shared` would break the "no runtime dependencies, no React" requirement. The names differ from `chat-shared`'s `GroupedAttachmentsData` so the two cannot be confused in one import list.

### D4. Deltas from npm 0.49.0

- Exact origin match, with a trailing `/` stripped from configured hosts. The prefix check accepted any origin a configured host started with.
- No `console.warn` for a missing `onData`; libs do not log.
- `onData` needs only `visualizerData`. Chat 0.x's application editor sends the layout as `{ visualizerData: { layout } }` with no `mimeType`; `0.49.0` acknowledged it and dropped the layout, which is what an editor needs from it. `mimeType` becomes optional on `VisualizerAttachmentData` (still required on a grouped item).
- Any other `${appName}/…` request with a `requestId` is acknowledged, so a host `send()` the connector does not handle (`SET_VISUALIZER_OPTIONS`) resolves instead of timing out after `requestTimeout`.
- Messages from the connector's own window are dropped. Outside a frame `window.parent === window`, and the editor messages the iframe posts (`SAVE_SUCCESS`) would otherwise reach `onEditorMessage`.
- `postMessageListener` is an arrow property, so it is bound without the constructor rebinding it.
- `dialHost` (the first host) is kept as a protected field for subclasses written against `0.49.0`.

## Risks / Trade-offs

- **Exact origin match can reject a host that `0.49.0` accepted**, for example one configured with a path (`https://chat.example.com/app`). Such a host was never a valid `postMessage` target origin either, so outgoing messages to it already failed. Documented in the README migration note.
- **Two `ReadyToInteract` members** (one per enum) can be picked wrongly. The JSDoc on `AppsEditorEvents` names the consumer, and the wire values are pinned by tests.
