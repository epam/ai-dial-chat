# Custom Viewers

A **Custom Viewer** replaces the conversation UI of one application — the message list and the chat input — with a third-party page rendered in an iframe. The viewer draws its own UI and drives the conversation itself; DIAL Chat hands it context (application, conversation, theme, locale, direction) and keeps its sidebar in sync with the conversations the viewer creates or changes.

This is not a [custom visualizer](legacy-chat-migration-guide.md#carried-over-unchanged). A visualizer renders one attachment inside an otherwise normal message list. A Custom Viewer takes over the whole conversation view.

## Configuration

A viewer is configured in DIAL Core, not in DIAL Chat. Two sources are read:

1. **`viewer_url` on the application** — the application's own DIAL Core configuration. The viewer **title** is the application's display name.
2. **`dial:applicationTypeViewerUrl` on the application type schema** — used when the application references a schema (`application_type_schema_id`) and has no `viewer_url` of its own. The title is the schema's `dial:applicationTypeDisplayName`.

The direct `viewer_url` wins over the schema value. If neither is present, or the configured value is not an absolute `http:`/`https:` URL, the application opens as a normal chat.

Applications that expose only a viewer (DIAL Core reports them with the `custom_ui` interface) are listed in the deployment picker and the catalog like any other application.

> **The title is part of the protocol.** Every `postMessage` exchanged with the viewer is namespaced `<title>/<EVENT>`. The viewer must construct its `ChatVisualizerConnector` with an `appName` exactly equal to the title — same case, same spaces. Renaming the application or the schema breaks the handshake until the viewer is updated. The title is used verbatim, never translated.

### Allow the viewer origin

The chat's Content Security Policy only lets allowlisted origins load in a frame. Add the viewer's origin to `ALLOWED_IFRAME_ORIGINS` in `chat-api` (see the [Chat API environment variables](../apps/chat-api/README.md#environment-variables)):

```sh
ALLOWED_IFRAME_ORIGINS=https://viewer.example.com
```

## When the viewer is shown

- **An existing conversation** of a viewer application opens the viewer in place of the messages and the input. The sidebar and header stay. The chat never starts or resumes a generation for such a conversation — the viewer owns it.
- **A new chat** with a viewer application selected shows a **Start working with the {title}** button. The chat input is disabled, but the deployment picker inside it still works. Pressing the button opens the viewer with no conversation; the viewer creates the conversation itself.

## Iframe URL

DIAL Chat appends these query parameters to the configured URL. A query string the URL already has is kept. Treat every parameter as optional and parse with `URLSearchParams`.

| Parameter        | Value                                           | Present when           |
| ---------------- | ----------------------------------------------- | ---------------------- |
| `authProvider`   | Id of the auth provider the user signed in with | the user has one       |
| `conversationId` | DIAL id of the open conversation                | a conversation is open |
| `id`             | Id of the application                           | always                 |
| `theme`          | Current theme id                                | a theme is set         |

Example:

```
https://viewer.example.com/?authProvider=keycloak&conversationId=conversations%2Fbucket%2FMy+chat&id=applications%2Fbucket%2Fexplorer&theme=dark
```

## Data sent to the viewer

After the viewer sends `READY_TO_INTERACT`, DIAL Chat sends one `SEND_VISUALIZE_DATA` request, and sends it again whenever the conversation, theme, locale or direction changes:

```json
{
  "mimeType": "application/json",
  "visualizerData": {
    "isPreview": false,
    "conversationId": "conversations/bucket/My chat",
    "layout": {
      "width": 0,
      "height": 0,
      "themeId": "dark",
      "currentLocale": "en",
      "dir": "ltr"
    }
  }
}
```

`conversationId` is absent before the viewer has created a conversation. `isPreview` is always `false`. `layout` carries no authentication fields (`logInHint`, `providerId`, `accessToken`): the browser never holds the user's access token, so the viewer signs in on its own, using the `authProvider` query parameter.

A change to the conversation or theme also changes the iframe URL, so the viewer is reloaded with the new parameters as well.

## Events the viewer sends

| Event                          | Effect in DIAL Chat                                                             |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `READY`                        | Handled by the connector (hides its loader)                                     |
| `READY_TO_INTERACT`            | Hides the loading spinner and unblocks `SEND_VISUALIZE_DATA`                    |
| `CREATED_CONVERSATION_SUCCESS` | Refreshes the conversation list and opens the new conversation                  |
| `UPDATED_CONVERSATION_SUCCESS` | Refreshes the conversation list; reloads the conversation if it is the one open |

Both conversation events must carry `payload.conversation.id`. **Only that id is read** — DIAL Chat reloads the conversation from its own API rather than trusting the object the viewer sends, so the rest of the payload may be anything. An event without a string id is ignored. Repeats of the same event for the same id within 300 ms are collapsed into one.

DIAL Chat accepts messages only from the viewer iframe's own window. Messages from any other window, or with another `<title>/` prefix, are ignored.

`SEND_MESSAGE` from a viewer is not handled.

```ts
import { ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';
import { VisualizerConnectorEvents } from '@epam/ai-dial-shared';

// appName MUST equal the viewer title (application or schema display name)
const connector = new ChatVisualizerConnector(
  'https://chat.example.com',
  'Explorer',
  (data) => {
    // { mimeType: 'application/json', visualizerData: { isPreview, conversationId, layout } }
  },
);

connector.sendReady();
connector.sendReadyToInteract();

// after creating a conversation through the DIAL API:
connector.send({
  type: VisualizerConnectorEvents.createdConversationSuccess,
  payload: { conversation: { id: 'conversations/bucket/My chat' } },
});
```

## Iframe sandbox

The iframe is created by `@epam/ai-dial-visualizer-connector` with `sandbox="allow-same-origin allow-scripts allow-modals"`. This is narrower than the legacy chat, which also allowed forms, popups, downloads and presentation. A viewer that opens a popup window (for example, for its own sign-in), submits a native form or triggers a download will not work until the connector widens the sandbox.

## Not supported

Compared with the legacy chat (0.x):

- **Playback** — the new chat has no playback mode, so the `playback` query parameter is never sent.
- **`SEND_MESSAGE`** from the viewer is ignored, as it was in 0.x for viewers.
- **The `/widgets/:slug` page** that showed a schema viewer without a conversation does not exist.
- **The application-editor preview** of a viewer (`isPreview: true`) does not exist; the editor preview covers Quick Apps only.
- **Localised titles** — 0.x localised the viewer title, and with it the message namespace. The new chat uses the display name as configured.

## Troubleshooting

**The spinner never goes away.** Either `READY_TO_INTERACT` is not reaching the chat — check that `appName` exactly equals the title, and that the viewer calls both `sendReady()` and `sendReadyToInteract()` — or the browser blocked the frame: check the console for a CSP `frame-src` violation and add the viewer origin to `ALLOWED_IFRAME_ORIGINS`.

**The viewer shows "This application's viewer URL is not valid."** The configured `viewer_url` or `dial:applicationTypeViewerUrl` is not an absolute `http:`/`https:` URL.

**A conversation the viewer created does not appear in the sidebar.** Send `CREATED_CONVERSATION_SUCCESS` with `payload.conversation.id` set to the conversation's DIAL id (`conversations/<bucket>/<path>`).

## Related

- [Legacy Chat Migration Guide](legacy-chat-migration-guide.md) — moving a 0.x deployment, including its viewers
- [Architecture](architecture.md) — where the viewer sits in the frontend
