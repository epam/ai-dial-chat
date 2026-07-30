# @epam/ai-dial-chat-visualizer-connector

Iframe-side `postMessage` connector for third-party visualizer applications to receive attachment data from DIAL Chat.

## Overview

A custom visualizer is a small web application that DIAL Chat mounts inside a sandboxed `<iframe>` to render an attachment whose MIME type the host cannot display natively. `@epam/ai-dial-chat-visualizer-connector` is the counterpart your application constructs to receive that attachment's data over `postMessage`, without needing same-origin access to the host page.

**Important — this package covers the base rendering flow only.** It supports the handshake (`READY` → `READY_TO_INTERACT`) and receiving a single attachment's data (`SEND_VISUALIZE_DATA`). It does NOT support: sending messages from the visualizer back into the chat (`SEND_MESSAGE`), grouped/application-level visualizers (multiple attachments in one iframe), or any auth-token/locale forwarding. If your integration needs one of these, it is not available in this version.

## The `appName` / `title` contract — read this first

The string you pass as `appName` to `ChatVisualizerConnector` **must be character-for-character identical** to the `title` field of the corresponding entry in the host's `CUSTOM_VISUALIZERS` configuration. Every message in both directions is namespaced by this string (`${appName}/READY`, `${appName}/SEND_VISUALIZE_DATA`, …).

If the two disagree, there is **no error on either side**: your iframe loads, the host posts messages with a prefix your listener never matches, and nothing happens. If your visualizer never receives data, this mismatch is the first thing to check.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-chat-visualizer-connector": "*"
  }
}
```

## Peer Dependencies

- `@epam/ai-dial-chat-shared` — supplies the protocol types/enums (`AttachmentData`, `VisualizerConnectorEvents`, `VisualizerConnectorRequests`), re-exported from this package's entry point so no separate import is needed.

## Classes

### ChatVisualizerConnector

```ts
import { ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';

const connector = new ChatVisualizerConnector(
  '*', // or the specific host origin(s) this visualizer trusts
  'my-viz', // MUST equal the host's CUSTOM_VISUALIZERS entry `title`
  (visualizerData) => {
    // visualizerData: AttachmentData — { mimeType, visualizerData: { layout, ...payload } }
    render(visualizerData);
  },
);

// Signal you've mounted and can receive messages.
connector.sendReady();

// Once your app has finished its own setup and can receive data:
connector.sendReadyToInteract();

// On unmount:
connector.destroy();
```

`SEND_VISUALIZE_DATA` is acknowledged automatically — the connector posts the matching `/RESPONSE` right after invoking your callback, so the host's `send()` call resolves.
