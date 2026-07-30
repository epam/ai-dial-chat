# @epam/ai-dial-visualizer-connector

Host-side iframe manager and `postMessage` protocol for rendering custom MIME-type visualizers inside a sandboxed iframe.

## Overview

Some attachments carry domain-specific content — a chart spec, a proprietary telemetry format — that the host application cannot render natively but a small, independently-deployed web application knows exactly how to display. `@epam/ai-dial-visualizer-connector` mounts that application inside a sandboxed `<iframe>` and exchanges the attachment payload with it over `postMessage`, without either side needing same-origin access to the other.

`VisualizerConnector` manages a single iframe: it creates and mounts the frame with a fixed capability grant appropriate for interactive visualizer apps (downloads, popups, modals, clipboard, fullscreen — see the class doc for the full rationale), performs the `READY`/`READY_TO_INTERACT` handshake, and exposes `send()` for request/response-style messages (currently `SEND_VISUALIZE_DATA`). Every message is namespaced by a `visualizerName` string that both sides must agree on — this is normally the `title` field of the corresponding `CUSTOM_VISUALIZERS` registry entry, and it doubles as the shared secret that makes wrong-visualizer message delivery impossible to mistake for a same-origin one: inbound messages are additionally checked for `event.source` and `event.origin` before being processed.

This library has no knowledge of the app that embeds it — no env vars, no Redux/context, no generated API clients. Its only dependency is `@epam/ai-dial-chat-shared`, which supplies the protocol types/enums. It is consumed by `@epam/ai-dial-attachment-canvas`; third-party visualizer authors instead consume the iframe-side counterpart, `@epam/ai-dial-chat-visualizer-connector`.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-visualizer-connector": "*"
  }
}
```

## Peer Dependencies

- `@epam/ai-dial-chat-shared` — supplies the protocol types/enums (`CustomVisualizer`, `AttachmentData`, `VisualizerConnectorEvents`, `VisualizerConnectorRequests`, …), re-exported from this package's entry point so no separate import is needed.

## Classes

### VisualizerConnector

```ts
import {
  VisualizerConnector,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-visualizer-connector';

const connector = new VisualizerConnector(
  document.getElementById('visualizer-root')!,
  {
    domain: 'https://viz.example.com',
    visualizerName: 'my-viz', // must equal the visualizer app's `appName`
    requestTimeout: 15000, // optional; bounds send(), not the handshake
  },
);

await connector.ready(); // resolves once the iframe posts READY_TO_INTERACT

await connector.send(VisualizerConnectorRequests.SendVisualizeData, {
  mimeType: 'application/x-my-viz',
  visualizerData: {
    layout: { themeId: 'dark', width: 800, height: 600 },
    series: [1, 2, 3],
  },
});

// later, on unmount:
connector.destroy();
```

`ready()` never times out — a slow-booting visualizer is not treated as failed. `send()` is bounded by `requestTimeout` (default `10000`ms) because it is a round-trip the host itself initiated. `destroy()` removes the iframe, detaches the `message` listener, and rejects every pending `send()`/`ready()` caller; calling it more than once is a no-op.
