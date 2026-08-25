# DIAL Visualizer Connector

DIAL Visualizer Connector is a library for connecting DIAL CHAT with custom visualizers - applications which could visualize some special type data (for example **plot data** for the **Plotly**).

This is the **chat side** of the integration: it creates the iframe, shows a loader until the embedded page is ready, and exchanges post messages with it. The embedded page uses [DIAL Chat Visualizer Connector](../chat-visualizer-connector/README.md).

## Public classes to use

`VisualizerConnector` - class which creates iframe with provided **VisualizerConnector**, allows to interact with **Visualizer** rendered in the iframe (send data). Types for configuration options is `VisualizerConnectorOptions`.

## Prerequisites

How to configure your DIAL CHAT to use **Custom Visualizers** you could find [here](../chat-visualizer-connector/README.md).

At **Visualizer** side should be used [DIAL Chat VIsualizer Connector](../chat-visualizer-connector/README.md).

For **Custom Viewers** (a viewer replacing the whole chat UI for an application) see [Custom Viewers](../../docs/CUSTOM-VIEWERS.md).

## Usage

```typescript
import { VisualizerConnectorRequests } from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

const visualizer = new VisualizerConnector(containerElement, {
  domain: 'http://localhost:8000',
  hostDomain: window.location.origin,
  visualizerName: 'CUSTOM_VISUALIZER',
  loaderClass: 'bg-layer-1',
});

await visualizer.ready();

await visualizer.send(VisualizerConnectorRequests.sendVisualizeData, {
  mimeType: 'application/json',
  visualizerData: { layout: { width: 0, height: 0 } },
});

visualizer.destroy();
```

The in-repo consumer is `apps/chat/src/components/IframeRenderer` — use it as a reference.

## Options

```typescript
interface VisualizerConnectorOptions {
  domain: string; // origin of the embedded visualizer/viewer - also the postMessage target origin
  hostDomain: string; // origin of the DIAL Chat host
  visualizerName: string; // message namespace, must match the visualizer's appName
  loaderStyles?: Styles; // overrides for the built-in loader styles
  loaderClass?: string; // className applied to the loader element
  loaderInnerHTML?: string; // custom loader markup (defaults to a built-in spinner SVG)
  requestTimeout?: number; // per-request timeout in ms
}
```

## Message naming

Every message is namespaced with the visualizer name: `<visualizerName>/<TYPE>`. Responses are `<visualizerName>/<TYPE>/RESPONSE` and carry the originating `requestId`. Message types come from the `VisualizerConnectorRequests` and `VisualizerConnectorEvents` enums exported by `@epam/ai-dial-shared` — see the [event reference](../chat-visualizer-connector/README.md#event-and-request-types).

Messages are accepted only from the connector's own iframe, so multiple connectors can coexist on one page.

## API

| Method                                      | Description                                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constructor(root, options)`                | Creates the iframe and loader inside `root` (an element or a selector; throws if the selector matches nothing)                                                 |
| `ready(): Promise<boolean>`                 | Resolves once the embedded page has sent `READY_TO_INTERACT`                                                                                                   |
| `send(type, payload?, waitForReady = true)` | Sends a request and resolves with the response payload. Awaits `ready()` first unless `waitForReady` is `false`. Resolves `undefined` if destroyed or detached |
| `subscribe(eventType, callback)`            | Subscribes to events sent without a `requestId`. Returns an unsubscribe function                                                                               |
| `setVisualizerConnectorOptions(options)`    | Replaces the current options                                                                                                                                   |
| `destroy()`                                 | Removes the listener, rejects pending work and removes the iframe and loader                                                                                   |

## Loader

A loader element is shown over the iframe from construction until the embedded page sends `READY` or `READY_TO_INTERACT`. By default it is an absolutely positioned, centred spinner SVG on a white background (`z-index: 2`); override it with `loaderClass`, `loaderStyles` or `loaderInnerHTML`.

## Iframe sandbox

The created iframe is sandboxed with `allow-same-origin`, `allow-scripts`, `allow-modals`, `allow-forms`, `allow-downloads`, `allow-popups` and `allow-presentation`, and permits `clipboard-write`, `fullscreen`, `accelerometer`, `gyroscope`, `autoplay`, `web-share` and `encrypted-media`. It loads lazily and fills its container.
