# Custom Viewers

## Overview

Custom Viewers provide the capability to implement and configure specialized viewing interfaces tailored to specific application requirements.

A Custom Viewer replaces the whole DIAL Chat conversation UI (message list, chat input, controls) with a third-party page rendered in an iframe. The viewer is responsible for its own UI and for driving the conversation; DIAL Chat provides context (theme, locale, conversation id) and reacts to a small set of events the viewer sends back.

This differs from [Custom Visualizers](../libs/chat-visualizer-connector/README.md), which render a single attachment (or a group of attachments) _inside_ an otherwise normal chat message list.

## Prerequisites

For security reasons DIAL Chat must be configured with the origins allowed to be embedded as an iframe:

- `ALLOWED_IFRAME_SOURCES` - list of allowed iframe sources in `<source> <source>` format.

```
ALLOWED_IFRAME_SOURCES=http://localhost:5500
```

_Note: For development purposes you can set `*`_

## Custom Viewer Configuration

There are two methods you can use to configure Custom Viewers for applications:

- **Application Type Schema Configuration**: Applications utilizing an application type schema reference the schema through the `application_type_schema_id` field, which contains a `dial:applicationTypeViewerUrl` field. Refer to [DIAL Docs](https://github.com/epam/ai-dial/blob/main/docs/platform/3.core/7.apps.md#schema-rich-applications) to learn more about schema-rich applications.
- **Direct URL Configuration**: Applications that do not utilize an application type schema specify a viewer URL directly through the `viewer_url` field. Refer to [DIAL Core documentation](https://github.com/epam/ai-dial-core/blob/development/docs/dynamic-settings/applications.md) and [DIAL Core API reference](https://dialx.ai/dial_api#tag/Applications/operation/saveCustomApplication) to learn more and see examples.

### Resolution order and viewer title

DIAL Chat resolves the viewer for the currently selected conversation's model (see `customViewer` in `apps/chat/src/components/Chat/Chat.tsx`):

1. If the application defines `viewer_url`, that URL is used and the **title** is the application display name.
2. Otherwise, if the application references an application type schema that defines `dial:applicationTypeViewerUrl`, that URL is used and the **title** is the schema's localized `dial:applicationTypeDisplayName`.
3. If neither is present, no Custom Viewer is rendered and the standard chat UI is shown.

Direct `viewer_url` therefore takes precedence over the schema value.

> **The title is part of the protocol.** Every postMessage exchanged between DIAL Chat and the viewer is namespaced as `<title>/<EVENT>`. The `appName` passed to `ChatVisualizerConnector` **must be exactly equal to this title**, otherwise no messages are delivered in either direction and the viewer stays behind the loader.

### When the viewer is rendered

For a conversation whose application resolves to a Custom Viewer, DIAL Chat renders the viewer when at least one of the following is true:

- the user pressed the **"Start working with viewer"** button (empty conversations start with this gate instead of the viewer);
- the conversation already has messages;
- the chat is opened inside the applications editor preview route.

## Iframe URL query parameters

DIAL Chat appends context to the configured viewer URL when it builds the iframe `src` (see `generateTargetUrl` in `apps/chat/src/components/Chat/CustomChatViewer.tsx`):

| Parameter        | Value                                              | Notes                                                         |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `authProvider`   | Id of the configured auth provider                 | Omitted entirely when no provider id is available             |
| `conversationId` | Id of the selected conversation (URL-encoded)      | Omitted when there is no conversation                         |
| `id`             | Id of the application the viewer is configured for | URL-encoded                                                   |
| `theme`          | Current DIAL Chat theme id                         | Omitted when no theme is set                                  |
| `playback`       | `true`                                             | Present **only** for playback conversations; absent otherwise |

Example:

```
http://localhost:5500/?authProvider=auth0&conversationId=conversations%2Fid&id=applications%2Fmy-app&theme=dark
```

> Query params are concatenated conditionally, so when `authProvider` is absent the URL currently starts with `?&conversationId=...`. Parse the query string with `URLSearchParams` rather than by position, and treat every parameter as optional.

The applications editor preview passes a smaller set — `authProvider`, `id` and `theme` only (see `apps/chat/src/components/AppsEditor/EditorForm/CustomViewerForm.tsx`).

## Data sent to the viewer

After the handshake completes, DIAL Chat sends a `SEND_VISUALIZE_DATA` request (see `apps/chat/src/components/IframeRenderer/index.tsx`). It is delivered to the callback passed to the `ChatVisualizerConnector` constructor:

```typescript
{
  mimeType: 'application/json',
  visualizerData: {
    isPreview: boolean,        // true when rendered in the applications editor preview
    conversationId?: string,   // id of the selected conversation
    layout: {
      width: 0,                // always 0 for Custom Viewers - the iframe fills its container
      height: 0,               // always 0 for Custom Viewers
      themeId?: string,
      currentLocale?: string,
      dir?: 'ltr' | 'rtl',
    }
  }
}
```

The message is re-sent whenever `conversationId` or the preview flag changes, so the viewer should treat it as a state update, not a one-time initialization payload.

> `isPreview` and `conversationId` are not yet part of the `CustomVisualizerData` type exported from `@epam/ai-dial-shared` (they are cast in at the call site). They are present at runtime; type them yourself on the viewer side for now.

### Authentication fields

`layout.logInHint`, `layout.providerId` and `layout.accessToken` are gated behind the `passAuthInfo` / `passExplicitToken` flags of the underlying renderer. The Custom Viewer flow **does not** enable either flag, so these three fields are **absent** for Custom Viewers. The auth provider id is instead delivered via the `authProvider` query parameter. (The applications editor preview does enable both flags.)

## Events the viewer can send to DIAL Chat

All events are namespaced `<title>/<EVENT>` and are emitted with the `ChatVisualizerConnector`.

| Event                          | Helper method           | Effect in DIAL Chat                                                                                        |
| ------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `READY`                        | `sendReady()`           | Hides the connector's own loader                                                                           |
| `READY_TO_INTERACT`            | `sendReadyToInteract()` | Hides the loading spinner and unblocks `SEND_VISUALIZE_DATA` delivery                                      |
| `SEND_MESSAGE`                 | `sendMessage(content)`  | Sends a message into the conversation                                                                      |
| `CREATED_CONVERSATION_SUCCESS` | _none — use `send()`_   | Adds the conversation to the sidebar, selects it, updates recent models (and the preview id in the editor) |
| `UPDATED_CONVERSATION_SUCCESS` | _none — use `send()`_   | Applies the conversation into the store and updates recent models                                          |
| `UPDATED_APPLICATION_SUCCESS`  | _none — use `send()`_   | Applications editor only: applies the updated application into the store                                   |

Both `READY` and `READY_TO_INTERACT` must be sent — DIAL Chat keeps showing the spinner until `READY_TO_INTERACT` arrives, and never sends data before it.

### Conversation events

A Custom Viewer owns the conversation lifecycle: it creates and updates conversations against the DIAL API itself, then tells DIAL Chat what happened so the sidebar and store stay in sync. There is no dedicated helper method for these — emit them with `send()`:

```typescript
import { ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';
import { VisualizerConnectorEvents } from '@epam/ai-dial-shared';

connector.send({
  type: VisualizerConnectorEvents.createdConversationSuccess,
  payload: { conversation },
});

connector.send({
  type: VisualizerConnectorEvents.updatedConversationSuccess,
  payload: { conversation },
});
```

The `conversation` payload must be a full DIAL Chat conversation object (`id`, `model.id`, `messages`, …). Both handlers are debounced by 300 ms on the chat side, so bursts of updates are safe.

## Custom Viewer Implementation

The Custom Viewer functionality is built upon the DIAL Chat Visualizer Connector framework (package: `@epam/ai-dial-chat-visualizer-connector`), originally developed for Custom Visualizers. Comprehensive documentation is available [here](../libs/chat-visualizer-connector/README.md).

### Minimal integration

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

import { ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';
import { VisualizerConnectorEvents } from '@epam/ai-dial-shared';

// The DIAL Chat host that embeds this viewer
const dialHost = 'https://hosted-dial-chat-domain.com';
// MUST equal the resolved viewer title (application or schema display name)
const appName = 'My Application';

export default function Viewer() {
  const connector = useRef<ChatVisualizerConnector | null>(null);
  const [conversationId, setConversationId] = useState<string>();

  useEffect(() => {
    // Context from the iframe URL
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');
    const authProvider = params.get('authProvider');
    setConversationId(params.get('conversationId') ?? undefined);

    connector.current = new ChatVisualizerConnector(dialHost, appName, (data) => {
      // { mimeType: 'application/json', visualizerData: { isPreview, conversationId, layout } }
      setConversationId(
        (data.visualizerData as { conversationId?: string }).conversationId,
      );
    });

    connector.current.sendReady();
    // Perform any initialization here (login, data fetch, ...)
    connector.current.sendReadyToInteract();

    return () => {
      connector.current?.destroy();
      connector.current = null;
    };
  }, []);

  // After creating a conversation through the DIAL API, notify the chat:
  const onConversationCreated = (conversation: unknown) =>
    connector.current?.send({
      type: VisualizerConnectorEvents.createdConversationSuccess,
      payload: { conversation },
    });

  return <div>{/* your viewer UI */}</div>;
}
```

A reference implementation demonstrating the handshake is available [here](../apps/custom-viewer-test/README.md).

## Troubleshooting

**The loader never disappears.** `READY_TO_INTERACT` is not reaching DIAL Chat. Check that `appName` exactly matches the viewer title (application display name, or the localized schema display name), and that both `sendReady()` and `sendReadyToInteract()` are called.

**The viewer receives no data.** Messages are rejected when the origin does not match. Verify the `dialHost` passed to the connector is the DIAL Chat origin (not the viewer's own origin), and that DIAL Chat's `ALLOWED_IFRAME_SOURCES` contains the viewer origin.

**Conversations created in the viewer do not appear in the sidebar.** Emit `CREATED_CONVERSATION_SUCCESS` with a full conversation object in `payload.conversation` — the connector has no helper for this, and a missing or partial `conversation` is silently ignored.

## See also

- [DIAL Chat Visualizer Connector](../libs/chat-visualizer-connector/README.md) — the viewer-side library
- [DIAL Visualizer Connector](../libs/visualizer-connector/README.md) — the chat-side library that creates the iframe
- [Custom Viewer test app](../apps/custom-viewer-test/README.md) — runnable sample
