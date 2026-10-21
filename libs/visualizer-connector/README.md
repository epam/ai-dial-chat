# @epam/ai-dial-visualizer-connector

Host-side and iframe-side postMessage connectors for DIAL Chat custom visualizers and application editors.

## Overview

A custom visualizer is a third-party web application that renders a special attachment type, such as Plotly chart data, inside DIAL Chat. `@epam/ai-dial-visualizer-connector` carries both halves of that protocol. On the **host** side, `VisualizerConnector` does the following:

- mounts a sandboxed iframe for the visualizer URL into a container you own;
- shows a loader until the visualizer reports `READY`;
- waits for the `READY_TO_INTERACT` handshake;
- posts namespaced requests (`${visualizerName}/SEND_VISUALIZE_DATA`, …) and resolves each one with the matching `/RESPONSE`;
- forwards unsolicited visualizer events (for example `SEND_MESSAGE`) to subscribers.

On the **iframe** side, `ChatVisualizerConnector` is what a visualizer or an application editor (QuickApps, DIAL Loop) runs inside the frame. It announces `READY` / `READY_TO_INTERACT`, acknowledges the host's data requests, and carries the application-editor protocol: the prefixed events (`readyToSave`, `loggedOut`) and the unprefixed save and auth messages (`TRIGGER_SAVE`, `SAVE_SUCCESS`, …). It replaces the iframe-side npm package `@epam/ai-dial-chat-visualizer-connector`. Both halves share the wire values listed under [Enums](#enums).

The package is vanilla DOM/TypeScript with no runtime dependencies. It reads no environment, routing, auth, or i18n state, and writes nothing to the console. The host supplies the visualizer URL, the protocol name, and the request timeout; the iframe supplies the allowed host origins and the protocol name. DIAL Chat resolves these from its `CUSTOM_VISUALIZERS` / `APPLICATION_VISUALIZERS` registries.

Inbound messages are trusted only when `event.source` is this connector's own iframe and `event.data.type` starts with `${visualizerName}/`. `event.origin` is not checked. Operators MUST NOT host a visualizer on the same origin as DIAL Chat, because the iframe is granted both `allow-same-origin` and `allow-scripts`.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-visualizer-connector": "*"
  }
}
```

## Peer Dependencies

None.

## Classes

### VisualizerConnector

```ts
import {
  VisualizerConnector,
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-visualizer-connector';

const container = document.getElementById('visualizer-root') as HTMLElement;

const connector = new VisualizerConnector(container, {
  domain: 'https://plotly-visualizer.example.com',
  visualizerName: 'plotly',
  requestTimeout: 15000,
});

const unsubscribe = connector.subscribe(
  `plotly/${VisualizerConnectorEvents.SendMessage}`,
  (payload) => console.log('visualizer asked to send', payload),
);

await connector.ready();
await connector.send(VisualizerConnectorRequests.SendVisualizeData, {
  mimeType: 'application/vnd.plotly.v1+json',
  visualizerData: { layout: { themeId: 'dark' } },
});

unsubscribe();
connector.destroy();
```

| Member                                      | Behaviour                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new VisualizerConnector(root, options)`    | `root` is an element or a CSS selector. A selector that matches nothing throws.                                                                                                                               |
| `ready()`                                   | Resolves with `true` after `READY_TO_INTERACT` and rejects with `'Chat Visualizer destroyed'` on `destroy()`. It never times out.                                                                             |
| `send(type, payload?, waitForReady = true)` | Posts `${visualizerName}/${type}` and resolves with the `/RESPONSE` payload. It rejects with a string after `requestTimeout` (default `10000` ms). It resolves `undefined` if destroyed before the handshake. |
| `subscribe(eventType, callback)`            | Calls `callback` for unsolicited messages whose full `type` equals `eventType`. Returns an unsubscribe function.                                                                                              |
| `setVisualizerConnectorOptions(options)`    | Replaces the stored options.                                                                                                                                                                                  |
| `destroy()`                                 | Removes the iframe and loader, rejects `ready()`, and stops listening. A second call is a no-op.                                                                                                              |

The iframe is created with these attributes:

- `sandbox`: `allow-same-origin allow-scripts allow-modals allow-forms allow-downloads allow-popups allow-presentation`. `allow-top-navigation` is never granted.
- `allow`: `clipboard-write`, `fullscreen`, `accelerometer`, `gyroscope`, `autoplay`, `web-share`, `encrypted-media`.

### ChatVisualizerConnector

```ts
import {
  AppsEditorMessages,
  ChatVisualizerConnector,
} from '@epam/ai-dial-visualizer-connector';

const connector = new ChatVisualizerConnector(
  ['https://chat.example.com'],
  'my-editor',
  {
    onData: (data) => console.log('visualize', data.visualizerData),
    onEditorMessage: (message) => {
      if (message.type === AppsEditorMessages.TriggerSave)
        void save(message.general);
    },
  },
);

connector.sendReady();
connector.sendReadyToInteract();
// An application editor, once its model is loaded:
connector.sendReadyToSave();
connector.sendEditorMessage({
  type: AppsEditorMessages.DirtyState,
  payload: { isDirty: true },
});

connector.destroy();
```

| Member                                                      | Behaviour                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new ChatVisualizerConnector(dialHost, appName, callbacks)` | Starts listening and announces nothing. `dialHost` is one origin or a list; `'*'` as the first entry accepts any origin. `callbacks` is an `onData` function or `{ onData?, onGroupedData? }`. An empty host list throws. |
| `send({ type, payload?, dialHost? })`                       | Posts `${appName}/${type}` to every host, or only to `dialHost`. `type` is a `VisualizerConnectorEvents` or `AppsEditorEvents` member.                                                                                    |
| `sendReady()` / `sendReadyToInteract()`                     | Post `${appName}/READY` / `${appName}/READY_TO_INTERACT`.                                                                                                                                                                 |
| `sendReadyToSave()` / `sendLoggedOut()`                     | Post `${appName}/readyToSave` / `${appName}/loggedOut` for DIAL Chat's application editor.                                                                                                                                |
| `sendMessage(content)`                                      | Posts `${appName}/SEND_MESSAGE` with `{ message: content }`.                                                                                                                                                              |
| `sendEditorMessage(message, dialHost?)`                     | Posts an `AppsEditorMessages` message as is, with no `${appName}/` prefix, to every host or only to `dialHost`.                                                                                                           |
| `destroy()`                                                 | Stops listening. A second call is a no-op.                                                                                                                                                                                |

Inbound `${appName}/SEND_VISUALIZE_DATA` and `${appName}/SEND_GROUPED_VISUALIZE_DATA` from an allowed origin are acknowledged with `/RESPONSE` and the same `requestId`. `onData` runs when the payload has `visualizerData` (`mimeType` is optional: Chat 0.x's application editor sends a layout alone), `onGroupedData` when it has `attachments` and `layout`. Any other `${appName}/…` request with a `requestId` is acknowledged too, so the host never waits out its timeout. Messages the connector posted itself (`event.source === window`, outside a frame) are ignored. An unprefixed `AppsEditorMessages` message from an allowed origin, such as `TRIGGER_SAVE`, goes to `onEditorMessage(message, origin)` whether or not it has a `payload`. Origins are matched exactly; a trailing `/` on a configured host is ignored.

## Enums

| Enum                          | Member                          | Wire value                        |
| ----------------------------- | ------------------------------- | --------------------------------- |
| `VisualizerConnectorRequests` | `SendVisualizeData`             | `SEND_VISUALIZE_DATA`             |
|                               | `SendGroupedVisualizeData`      | `SEND_GROUPED_VISUALIZE_DATA`     |
|                               | `SetVisualizerOptions`          | `SET_VISUALIZER_OPTIONS`          |
| `VisualizerConnectorEvents`   | `InitReady`                     | `INIT_READY`                      |
|                               | `Ready`                         | `READY`                           |
|                               | `ReadyToInteract`               | `READY_TO_INTERACT`               |
|                               | `SendMessage`                   | `SEND_MESSAGE`                    |
|                               | `CreatedConversationSuccess`    | `CREATED_CONVERSATION_SUCCESS`    |
|                               | `UpdatedConversationSuccess`    | `UPDATED_CONVERSATION_SUCCESS`    |
|                               | `UpdatedApplicationSuccess`     | `UPDATED_APPLICATION_SUCCESS`     |
| `AppsEditorEvents`            | `ReadyToInteract`               | `readyToInteract`                 |
|                               | `ReadyToSave`                   | `readyToSave`                     |
|                               | `LoggedOut`                     | `loggedOut`                       |
|                               | `UpdatedApplicationSuccess`     | `updatedApplicationSuccess`       |
| `AppsEditorMessages`          | `TriggerSave`                   | `TRIGGER_SAVE`                    |
|                               | `SaveSuccess`                   | `SAVE_SUCCESS`                    |
|                               | `SaveError`                     | `SAVE_ERROR`                      |
|                               | `ValidityState`                 | `VALIDITY_STATE`                  |
|                               | `DirtyState`                    | `DIRTY_STATE`                     |
|                               | `RequestToolsetLogin`           | `REQUEST_TOOLSET_LOGIN`           |
|                               | `ToolsetLoginResult`            | `TOOLSET_LOGIN_RESULT`            |
|                               | `RequestToolsetLogout`          | `REQUEST_TOOLSET_LOGOUT`          |
|                               | `ToolsetLogoutResult`           | `TOOLSET_LOGOUT_RESULT`           |
|                               | `RequestApplicationCredentials` | `REQUEST_APPLICATION_CREDENTIALS` |

## Types

```ts
import type {
  VisualizerConnectorLoaderStyles,
  VisualizerConnectorOptions,
  VisualizerConnectorRequest,
} from '@epam/ai-dial-visualizer-connector';

const options: VisualizerConnectorOptions = {
  domain: 'https://plotly-visualizer.example.com',
  visualizerName: 'plotly',
  loaderClass: 'my-loader',
  loaderStyles: { background: 'transparent' },
};
```

- `VisualizerConnectorOptions` has these fields:
  - `domain`
  - `visualizerName`
  - `requestTimeout?`
  - `loaderStyles?`
  - `loaderClass?`
  - `loaderInnerHTML?`
  - `hostDomain?`, which is deprecated and ignored.
- `VisualizerConnectorRequest` is the `{ type, requestId?, payload? }` shape of every posted message.
- `VisualizerConnectorLoaderStyles` is a partial map of CSS declarations, merged over the loader defaults.
- `ChatVisualizerCallbacks` is `{ onData?, onGroupedData?, onEditorMessage? }`. The callbacks receive `VisualizerAttachmentData` (`{ mimeType, visualizerData }`) and `VisualizerGroupedAttachmentsData` (`{ attachments: VisualizerGroupedAttachmentItem[], layout }`).
- `AppsEditorMessage` is `{ type: AppsEditorMessages, payload?, ...fields }`. Which fields sit at the top level and which under `payload` is per message, as the enum's JSDoc says (`SAVE_SUCCESS` → `hasChanges`, `SAVE_ERROR` → `error`, `DIRTY_STATE` → `payload.isDirty`, `VALIDITY_STATE` → `payload.isValid`, `REQUEST_TOOLSET_LOGIN` / `LOGOUT` → `toolsetId`, `REQUEST_APPLICATION_CREDENTIALS` → `appId`).
- `ChatVisualizerEventType` is the union of the event enums `ChatVisualizerConnector.send()` accepts.

## Migrating from npm 0.48.0

This package replaces the `0.48.0` release that was published from the legacy Chat line together with `@epam/ai-dial-shared`. The wire protocol is unchanged, so deployed visualizers keep working. In TypeScript:

- Import `VisualizerConnectorRequests` and `VisualizerConnectorEvents` from this package instead of `@epam/ai-dial-shared`. Their members are now PascalCase: `sendVisualizeData` → `SendVisualizeData`, `readyToInteract` → `ReadyToInteract`, and so on.
- `hostDomain` is optional. Drop it.
- `destroy()` can now be called twice safely, and it no longer logs to `console.error`.

## Migrating from `@epam/ai-dial-chat-visualizer-connector` 0.49.0

`ChatVisualizerConnector` keeps the npm `0.49.0` constructor, methods and wire messages. The differences:

- Import it from this package. Its enums are PascalCase (see [Enums](#enums)), and its data types are `VisualizerAttachmentData` / `VisualizerGroupedAttachmentsData` instead of `@epam/ai-dial-shared`'s `AttachmentData` / `GroupedAttachmentsData`.
- Inbound origins are compared exactly. `0.49.0` accepted any origin that a configured host merely started with.
- A missing `onData` is a silent no-op. `0.49.0` logged `console.warn` for it.
- `onData` also receives a payload without `mimeType`, so `VisualizerAttachmentData.mimeType` is optional. `0.49.0` acknowledged such a request but dropped its data.
- Any `${appName}/…` request with a `requestId` gets a `/RESPONSE`; `0.49.0` answered only `SEND_VISUALIZE_DATA` and `SEND_GROUPED_VISUALIZE_DATA`.
- Messages from the connector's own window are ignored, so an unframed iframe does not hear itself.
- `sendReadyToSave()`, `sendLoggedOut()`, `sendEditorMessage()` and `onEditorMessage` are new. Editors that post `${appName}/readyToSave`, `${appName}/loggedOut` or the unprefixed save messages by hand, or listen for `TRIGGER_SAVE` themselves, can switch to them.
