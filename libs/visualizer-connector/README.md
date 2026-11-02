# @epam/ai-dial-visualizer-connector

Host-side and iframe-side postMessage connectors for DIAL Chat custom visualizers and application editors.

## Overview

A custom visualizer is a third-party web application that renders a special attachment type, such as Plotly chart data, inside DIAL Chat. `@epam/ai-dial-visualizer-connector` carries both halves of that protocol. On the **host** side, `VisualizerConnector` does the following:

- mounts a sandboxed iframe for the visualizer URL into a container you own;
- shows a loader until the visualizer reports `READY`;
- waits for the `READY_TO_INTERACT` handshake;
- posts namespaced requests (`${visualizerName}/SEND_VISUALIZE_DATA`, …) and resolves each one with the matching `/RESPONSE`;
- forwards unsolicited visualizer events (for example `SEND_MESSAGE`) to subscribers.

On the **iframe** side, `ChatVisualizerConnector` announces the visualizer's `READY` / `READY_TO_INTERACT` and acknowledges the host's data requests. It replaces the iframe-side npm package `@epam/ai-dial-chat-visualizer-connector` and preserves its existing editor helpers for compatibility.

For application editors such as QuickApps and DIAL Loop, use `AppsEditorHost` around an existing iframe and `AppsEditorClient` inside it. They share typed message envelopes, validate incoming fields and direction, and verify the sender window and origin. Editor lifecycle events (`readyToInteract`, `readyToSave`, `loggedOut`) retain their existing namespaced wire format; save and auth messages (`TRIGGER_SAVE`, `SAVE_SUCCESS`, …) remain unprefixed. Visualizer and editor readiness are separate protocols.

The package is vanilla DOM/TypeScript with no runtime dependencies. It reads no environment, routing, auth, or i18n state, and writes nothing to the console. The host supplies the visualizer URL, the protocol name, and the request timeout; the iframe supplies the allowed host origins and the protocol name. DIAL Chat resolves these from its `CUSTOM_VISUALIZERS` / `APPLICATION_VISUALIZERS` registries.

`VisualizerConnector` accepts inbound messages only when `event.source` is its own iframe and `event.data.type` starts with `${visualizerName}/`; that visualizer class does not check `event.origin`. Operators MUST NOT host a visualizer on the same origin as DIAL Chat, because its iframe is granted both `allow-same-origin` and `allow-scripts`. The dedicated editor adapters check both origin and source and leave iframe creation and sandbox policy to the host.

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

### AppsEditorHost

The host adapter receives messages from one existing editor iframe. Supply its `contentWindow`, its URL or origin, and the exact application namespace. It does not mount the iframe, track readiness, run authentication, or impose save/readiness timeouts; those belong to the host application.

```ts
import {
  AppsEditorEvents,
  AppsEditorHost,
  AppsEditorMessages,
} from '@epam/ai-dial-visualizer-connector';

const frame = document.querySelector<HTMLIFrameElement>('#application-editor');
if (!frame?.contentWindow) throw new Error('Editor iframe is unavailable');

const host = new AppsEditorHost<{ name: string }>({
  targetWindow: frame.contentWindow,
  targetOrigin: frame.src,
  applicationName: 'QuickApp',
  onMessage(message) {
    if (message.type === AppsEditorEvents.ReadyToSave) {
      // Enable the application's Save control, subject to form validity.
    }
    if (message.type === AppsEditorMessages.SaveError) {
      console.error(message.error);
    }
  },
});

// From the enabled Save control:
host.send({
  type: AppsEditorMessages.TriggerSave,
  general: { name: 'My app' },
});
// Preview requests the editor's save without General metadata:
host.send({ type: AppsEditorMessages.TriggerSave });

// When replacing or removing this iframe:
host.destroy();
```

| Member                                                | Behaviour                                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `new AppsEditorHost<TGeneral, TCredentials>(options)` | Attaches a listener. Both generic arguments default to `unknown` and type only outgoing application-owned data.                     |
| `options.targetWindow` / `options.targetOrigin`       | Required editor window and absolute URL/origin. The URL is reduced to its origin; invalid, wildcard, and opaque origins throw.      |
| `options.applicationName`                             | Required exact namespace for lifecycle events, such as `QuickApp`.                                                                  |
| `options.onMessage`                                   | Required callback receiving validated `AppsEditorClientMessage` values. Lifecycle `type` values have no namespace in this callback. |
| `options.onActivity`                                  | Optional callback for any message from the configured window and origin, including unknown messages. This indicates activity only.  |
| `send(message)`                                       | Posts an `AppsEditorHostMessage<TGeneral, TCredentials>` to the configured window and origin. It does not wait for a response.      |
| `destroy()`                                           | Removes the listener and disables future sends. Repeated calls do nothing.                                                          |

### AppsEditorClient

The iframe adapter uses the host-provided application namespace, rather than an application's user-visible name or version. In DIAL Chat, read it from the iframe URL's `applicationName` parameter. Supply a trusted host origin from the embedding application's configuration; the library does not discover or authorize hosts for you.

```ts
import {
  AppsEditorClient,
  AppsEditorMessages,
} from '@epam/ai-dial-visualizer-connector';

declare function loadApplication(): Promise<void>;
declare function saveApplication(general: unknown): Promise<boolean>;

const applicationName = new URLSearchParams(window.location.search).get(
  'applicationName',
);
if (!applicationName) throw new Error('Missing editor applicationName');

const client = new AppsEditorClient({
  hostOrigin: 'https://chat.example.com',
  applicationName,
  onMessage: async (message) => {
    if (message.type !== AppsEditorMessages.TriggerSave) return;
    try {
      // Validate message.general against your own application's schema.
      const hasChanges = await saveApplication(message.general);
      client.sendSaveSuccess(hasChanges);
    } catch (error) {
      client.sendSaveError(
        error instanceof Error ? error.message : 'Save failed',
      );
    }
  },
});

client.sendReadyToInteract(); // Editor UI rendered: camelCase wire event.
await loadApplication();
client.sendReadyToSave(); // Model initialization succeeded; saving is safe.
```

Call `client.destroy()` on teardown. Neither construction nor `sendReadyToInteract()` grants save readiness. If initialization fails, report the problem in the editor and withhold `sendReadyToSave()`. For a signed-out editor, call `sendLoggedOut()`; after successful login and model initialization, call `sendReadyToSave()` again.

| Member                                                                   | Behaviour                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new AppsEditorClient(options)`                                          | Attaches a listener and sends nothing automatically. `hostOrigin` and `applicationName` are required; `hostWindow` defaults to `window.parent`.                                                                     |
| `options.onMessage`                                                      | Optional callback receiving validated `AppsEditorHostMessage`. `general` and `credentials` remain `unknown` and require application validation.                                                                     |
| `send(message)`                                                          | Sends a typed `AppsEditorClientMessage`, adding the namespace only for lifecycle/update events.                                                                                                                     |
| `sendReadyToInteract()`                                                  | Posts `${applicationName}/readyToInteract` when the UI has rendered.                                                                                                                                                |
| `sendReadyToSave()`                                                      | Posts `${applicationName}/readyToSave` when the model is safe to save. May be repeated.                                                                                                                             |
| `sendLoggedOut()`                                                        | Posts `${applicationName}/loggedOut`.                                                                                                                                                                               |
| `sendUpdatedApplication(application?)`                                   | Posts `${applicationName}/updatedApplicationSuccess` with optional opaque `payload.application`.                                                                                                                    |
| `sendSaveSuccess(hasChanges = false)` / `sendSaveError(error)`           | Post unprefixed save results, with top-level `hasChanges` or `error`.                                                                                                                                               |
| `sendValidityState(isValid)` / `sendDirtyState(isDirty)`                 | Post unprefixed notifications with boolean `payload.isValid` or `payload.isDirty`.                                                                                                                                  |
| `requestToolsetLogin(toolsetId)` / `requestToolsetLogout(toolsetId)`     | Ask the host to perform the corresponding authentication action.                                                                                                                                                    |
| `requestApplicationCredentials(appId)`                                   | Asks the host to open its credentials form. The request carries an identifier, not credentials.                                                                                                                     |
| `requestExternalServiceLogin(appId, serviceId, { offlineUsageConsent })` | Asks the host to sign the person in to one external service at user level, with the offline-use choice the editor collected; the host answers with `EXTERNAL_SERVICE_LOGIN_RESULT`. No credentials cross the frame. |
| `destroy()`                                                              | Removes the listener and disables future sends. Repeated calls do nothing.                                                                                                                                          |

Both adapters deliver messages only from the configured sender window and normalized origin. The receiver validates protocol fields and direction; the application owns the meaning and validation of General metadata, updated application objects, and credential status. There is no version negotiation, session identifier, request correlation, or promise-based response handling in this editor protocol.

### ChatVisualizerConnector

Use this class for visualizers and existing integrations. For new editor integrations, use `AppsEditorClient`; the loose `sendEditorMessage` and `AppsEditorMessage` APIs are deprecated but retain their behavior.

```ts
import { ChatVisualizerConnector } from '@epam/ai-dial-visualizer-connector';

const connector = new ChatVisualizerConnector(
  ['https://chat.example.com'],
  'my-viz',
  {
    onData: (data) => console.log('visualize', data.visualizerData),
  },
);

connector.sendReady();
connector.sendReadyToInteract();
connector.destroy();
```

| Member                                                      | Behaviour                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new ChatVisualizerConnector(dialHost, appName, callbacks)` | Starts listening and announces nothing. `dialHost` is one origin or a list; `'*'` as the first entry accepts any origin. `callbacks` is an `onData` function or `{ onData?, onGroupedData?, onEditorMessage? }`. An empty host list throws. |
| `send({ type, payload?, dialHost? })`                       | Posts `${appName}/${type}` to every host, or only to `dialHost`. `type` is a `VisualizerConnectorEvents` or `AppsEditorEvents` member.                                                                                                      |
| `sendReady()` / `sendReadyToInteract()`                     | Post `${appName}/READY` / `${appName}/READY_TO_INTERACT`.                                                                                                                                                                                   |
| `sendReadyToSave()` / `sendLoggedOut()`                     | Post `${appName}/readyToSave` / `${appName}/loggedOut` for DIAL Chat's application editor.                                                                                                                                                  |
| `sendMessage(content)`                                      | Posts `${appName}/SEND_MESSAGE` with `{ message: content }`.                                                                                                                                                                                |
| `sendEditorMessage(message, dialHost?)`                     | Posts an `AppsEditorMessages` message as is, with no `${appName}/` prefix, to every host or only to `dialHost`.                                                                                                                             |
| `destroy()`                                                 | Stops listening. A second call is a no-op.                                                                                                                                                                                                  |

Inbound `${appName}/SEND_VISUALIZE_DATA` and `${appName}/SEND_GROUPED_VISUALIZE_DATA` from an allowed origin are acknowledged with `/RESPONSE` and the same `requestId`. `onData` runs when the payload has `visualizerData` (`mimeType` is optional: Chat 0.x's application editor sends a layout alone), `onGroupedData` when it has `attachments` and `layout`. Any other `${appName}/…` request with a `requestId` is acknowledged too, so the host never waits out its timeout. Messages the connector posted itself (`event.source === window`, outside a frame) are ignored. An unprefixed `AppsEditorMessages` message from an allowed origin, such as `TRIGGER_SAVE`, goes to `onEditorMessage(message, origin)` whether or not it has a `payload`. Origins are matched exactly; a trailing `/` on a configured host is ignored. Unlike the dedicated editor adapters, this legacy receiver does not restrict incoming messages to one configured source window.

## Utilities

`parseAppsEditorClientMessage(data, applicationName)` validates an editor-to-host wire envelope and returns an `AppsEditorClientMessage` or `null`. `parseAppsEditorHostMessage(data)` validates the opposite direction and returns an `AppsEditorHostMessage` or `null`. These pure parsers check message data only; use the connector classes for origin/window checks.

```ts
import {
  AppsEditorEvents,
  parseAppsEditorClientMessage,
  serializeAppsEditorClientMessage,
} from '@epam/ai-dial-visualizer-connector';

const wire = serializeAppsEditorClientMessage(
  { type: AppsEditorEvents.ReadyToSave },
  'QuickApp',
);
const message = parseAppsEditorClientMessage(wire, 'QuickApp');
// wire.type === 'QuickApp/readyToSave'
// message?.type === AppsEditorEvents.ReadyToSave
```

`serializeAppsEditorClientMessage(message, applicationName)` adds the namespace to lifecycle/update events and leaves unprefixed messages unchanged. It serializes an already-typed message; it is not an inbound validator.

For compatibility, the client-message parser accepts nested `payload.error` when top-level `error` is absent, and legacy top-level `isDirty` when nested `payload.isDirty` is absent. Missing save-error text becomes `''`. `SAVE_SUCCESS.hasChanges` becomes `false` unless exactly `true`. Dirty/validity fields must be booleans, request identifiers must be nonempty strings, and host toolset results require a boolean `success`. Missing `TRIGGER_SAVE.general` is valid for Preview. Unknown messages and messages in the other direction return `null`.

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
|                               | `RequestExternalServiceLogin`   | `REQUEST_EXTERNAL_SERVICE_LOGIN`  |
|                               | `ExternalServiceLoginResult`    | `EXTERNAL_SERVICE_LOGIN_RESULT`   |

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
- `AppsEditorMessage` is `{ type: AppsEditorMessages, payload?, ...fields }`. Which fields sit at the top level and which under `payload` is per message, as the enum's JSDoc says (`SAVE_SUCCESS` → `hasChanges`, `SAVE_ERROR` → `error`, `DIRTY_STATE` → `payload.isDirty`, `VALIDITY_STATE` → `payload.isValid`, `REQUEST_TOOLSET_LOGIN` / `LOGOUT` → `toolsetId`, `REQUEST_APPLICATION_CREDENTIALS` → `appId`, `REQUEST_EXTERNAL_SERVICE_LOGIN` → `appId`, `serviceId`, `offlineUsageConsent`, `EXTERNAL_SERVICE_LOGIN_RESULT` → `appId`, `serviceId`, `success`, `reason`).
- `ChatVisualizerEventType` is the union of the event enums `ChatVisualizerConnector.send()` accepts.
- `AppsEditorHostOptions` and `AppsEditorClientOptions` configure the dedicated editor adapters described above.
- `AppsEditorHostMessage<TGeneral, TCredentials>` is the host-to-editor union of `AppsEditorTriggerSaveMessage<TGeneral>`, `AppsEditorToolsetResultMessage<TCredentials>`, and `AppsEditorExternalServiceLoginResultMessage`; both generic arguments default to `unknown`.
- `AppsEditorClientMessage` is the editor-to-host union of `AppsEditorLifecycleMessage`, `AppsEditorUpdatedMessage`, `AppsEditorSaveSuccessMessage`, `AppsEditorSaveErrorMessage`, `AppsEditorValidityMessage`, `AppsEditorDirtyMessage`, `AppsEditorToolsetRequestMessage`, `AppsEditorCredentialsRequestMessage`, and `AppsEditorExternalServiceLoginRequestMessage`. Lifecycle discriminants use `AppsEditorEvents`; other discriminants use `AppsEditorMessages`.

## Migrating an application editor to the typed API

1. Replace the editor's `ChatVisualizerConnector` or manual message listener with `AppsEditorClient`. An application that also acts as a visualizer can keep a separate `ChatVisualizerConnector` for that role.
2. Use the host-provided `applicationName` exactly. A user-entered app name, version suffix, or iframe title is not an interchangeable namespace.
3. Replace manual lifecycle/save/validity/auth posts with the client helpers. The new client's `sendReadyToInteract()` sends the editor's camelCase event; the legacy visualizer method of the same name continues to send uppercase `READY_TO_INTERACT`.
4. Handle `AppsEditorMessages.TriggerSave` in `onMessage`, validate `message.general`, and call `sendSaveSuccess` or `sendSaveError` when saving finishes. Validate any opaque credential-status body before using it.
5. Report `sendReadyToSave()` only after the editor's own model is loaded. `READY`, `READY_TO_INTERACT`, and UI loading alone do not make saving safe. Editors that never report save readiness, including the observed CodeApps integration, still need this external integration change; migrating the Chat host cannot synthesize the signal.

The wire format remains compatible with existing editor deployments. The old loose editor helpers remain available, and the visualizer protocol is unchanged. No session/version handshake is required by this migration.

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
- `sendReadyToSave()`, `sendLoggedOut()`, `sendEditorMessage()` and `onEditorMessage` were added for editor compatibility. They remain available; use the dedicated `AppsEditorClient` for new typed editor integrations, as described above.
