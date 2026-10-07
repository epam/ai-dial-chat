# @epam/ai-dial-visualizer-connector

Host-side postMessage connector that mounts a custom visualizer iframe and delivers its data.

## Overview

A custom visualizer is a third-party web application that renders a special attachment type, such as Plotly chart data, inside DIAL Chat. `@epam/ai-dial-visualizer-connector` is the **host** half of that protocol. `VisualizerConnector` does the following:

- mounts a sandboxed iframe for the visualizer URL into a container you own;
- shows a loader until the visualizer reports `READY`;
- waits for the `READY_TO_INTERACT` handshake;
- posts namespaced requests (`${visualizerName}/SEND_VISUALIZE_DATA`, …) and resolves each one with the matching `/RESPONSE`;
- forwards unsolicited visualizer events (for example `SEND_MESSAGE`) to subscribers.

The **iframe** half, used by visualizer authors, is the separate npm package `@epam/ai-dial-chat-visualizer-connector`. Both halves share the wire values listed under [Enums](#enums).

The package is vanilla DOM/TypeScript with no runtime dependencies. It reads no environment, routing, auth, or i18n state, and writes nothing to the console. The host supplies the visualizer URL, the protocol name, and the request timeout. DIAL Chat resolves these from its `CUSTOM_VISUALIZERS` / `APPLICATION_VISUALIZERS` registries.

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

## Enums

| Enum                          | Member                       | Wire value                     |
| ----------------------------- | ---------------------------- | ------------------------------ |
| `VisualizerConnectorRequests` | `SendVisualizeData`          | `SEND_VISUALIZE_DATA`          |
|                               | `SendGroupedVisualizeData`   | `SEND_GROUPED_VISUALIZE_DATA`  |
|                               | `SetVisualizerOptions`       | `SET_VISUALIZER_OPTIONS`       |
| `VisualizerConnectorEvents`   | `InitReady`                  | `INIT_READY`                   |
|                               | `Ready`                      | `READY`                        |
|                               | `ReadyToInteract`            | `READY_TO_INTERACT`            |
|                               | `SendMessage`                | `SEND_MESSAGE`                 |
|                               | `CreatedConversationSuccess` | `CREATED_CONVERSATION_SUCCESS` |
|                               | `UpdatedConversationSuccess` | `UPDATED_CONVERSATION_SUCCESS` |
|                               | `UpdatedApplicationSuccess`  | `UPDATED_APPLICATION_SUCCESS`  |

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

## Migrating from npm 0.48.0

This package replaces the `0.48.0` release that was published from the legacy Chat line together with `@epam/ai-dial-shared`. The wire protocol is unchanged, so deployed visualizers keep working. In TypeScript:

- Import `VisualizerConnectorRequests` and `VisualizerConnectorEvents` from this package instead of `@epam/ai-dial-shared`. Their members are now PascalCase: `sendVisualizeData` → `SendVisualizeData`, `readyToInteract` → `ReadyToInteract`, and so on.
- `hostDomain` is optional. Drop it.
- `destroy()` can now be called twice safely, and it no longer logs to `console.error`.
