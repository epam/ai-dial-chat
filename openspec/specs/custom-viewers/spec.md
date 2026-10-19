# custom-viewers Specification

## Purpose

How the chat renders a DIAL application that declares a custom viewer: resolving the viewer, listing viewer-only applications, the iframe URL contract and frame component, conversation events posted by the viewer, rendering existing conversations, the new-chat start gate, and the frame embedding policy.

## Requirements

### Requirement: Custom Viewer resolution

The system SHALL resolve a deployment's Custom Viewer with a pure function `resolveCustomViewer(deployment, schemas)` in `apps/chat/src/utils/custom-viewer.ts`, returning `CustomViewer | undefined` where `CustomViewer` is `{ url: string; title: string; applicationId: string }`.

- When `deployment` is absent or `deployment.type` is not `application`, the result SHALL be `undefined`.
- When `deployment.viewerUrl` is a valid absolute `http:`/`https:` URL, the result SHALL use it, with `title` = `deployment.displayName` and `applicationId` = `deployment.id`.
- Otherwise, when `deployment.applicationTypeSchemaId` matches a schema in `schemas` (`ApplicationSchemaSummaryDto[]`, the list `DeploymentsContext` already loads) whose `viewerUrl` is a valid absolute `http:`/`https:` URL, the result SHALL use that URL, with `title` = the schema's `displayName` and `applicationId` = `deployment.id`.
- A direct `viewerUrl` SHALL take precedence over the schema value.
- A URL that fails to parse or has another scheme SHALL be ignored (treated as absent), so resolution falls through to the next source.
- `title` SHALL be used verbatim — it is the postMessage namespace (`<title>/<EVENT>`) and MUST NOT be translated or trimmed. When the chosen source has no non-empty title, the result SHALL be `undefined`, because a viewer without a namespace can never complete the handshake.

State ownership: no new context. `useCustomViewer(deploymentId)` in `apps/chat/src/hooks/custom-viewer/useCustomViewer.ts` SHALL read `items` and `schemas` from `useDeployments()`, find the deployment with `findDeploymentByIdOrReference` (`@epam/ai-dial-chat-hooks`), and return the memoised (`useMemo`) result of `resolveCustomViewer`.

**Feature flag:** not gated. The feature is dark unless DIAL Core configuration carries a viewer URL.

#### Scenario: Direct viewer URL wins

- **WHEN** an application deployment has `viewerUrl: "https://viewer.example.com/"` and its schema has `viewerUrl: "https://schema-viewer.example.com/"`
- **THEN** the resolver returns `url: "https://viewer.example.com/"` and `title` equal to the deployment's `displayName`

#### Scenario: Schema viewer URL is the fallback

- **WHEN** an application deployment has no `viewerUrl` and its `applicationTypeSchemaId` matches a schema whose `viewerUrl` is `"https://schema-viewer.example.com/"` and `displayName` is `"Data Explorer"`
- **THEN** the resolver returns that URL with `title: "Data Explorer"`

#### Scenario: No viewer configured

- **WHEN** a deployment has no `viewerUrl` and no schema with a `viewerUrl`
- **THEN** the resolver returns `undefined` and the normal chat UI is used

#### Scenario: Unsafe or malformed URL is ignored

- **WHEN** a deployment's `viewerUrl` is `"javascript:alert(1)"` or `"not a url"`
- **THEN** the direct source is ignored and resolution falls through to the schema

#### Scenario: Models never resolve a viewer

- **WHEN** a deployment of type `model` carries a `viewerUrl`
- **THEN** the resolver returns `undefined`

### Requirement: Viewer-only applications are listed

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) SHALL request deployments with interface types `chat`, `mcp` **and** `custom_ui` (`ListDeploymentsInterfaceTypeEnum.CustomUi`) in both the initial load and `refetchDeployments`, so an application that exposes only a Custom Viewer (DIAL Core reports `custom_ui` for applications with `dial:applicationTypeViewerUrl`) reaches the deployment picker and the catalog. The backend's local interface re-filter in `apps/chat-api/src/deployments/listing/deployments-listing.service.ts` already honours `custom_ui` and is unchanged.

#### Scenario: Viewer-only application is selectable

- **WHEN** DIAL Core lists an application whose `interfaces` is `["custom_ui"]`
- **THEN** it is present in `useDeployments().items`

### Requirement: Viewer iframe URL contract

`buildCustomViewerUrl({ url, applicationId, conversationId?, theme?, authProvider? })` in `apps/chat/src/utils/custom-viewer.ts` SHALL build the iframe `src` with the `URL` API, setting search parameters on top of any query string the configured URL already has:

| Parameter        | Value                                         | When                              |
| ---------------- | --------------------------------------------- | --------------------------------- |
| `authProvider`   | `useUser().user.providerId`                   | only when non-empty               |
| `conversationId` | the open conversation's DIAL id               | only when a conversation is open  |
| `id`             | the application (deployment) id               | always                            |
| `theme`          | `useTheme().currentTheme` (resolved theme id) | only when set                     |

Values SHALL be encoded by `URLSearchParams`, never by string concatenation. The 0.x `playback` parameter SHALL NOT be sent (the new chat has no playback mode).

#### Scenario: Parameters are appended to an existing query

- **WHEN** the viewer URL is `https://viewer.example.com/app?tenant=a`, the application id is `applications/abc/my app`, and no conversation is open
- **THEN** the result keeps `tenant=a`, sets `id=applications%2Fabc%2Fmy+app` (or `%20`), and has no `conversationId` parameter

#### Scenario: Missing provider is omitted, not empty

- **WHEN** the user has no `providerId`
- **THEN** the URL has no `authProvider` parameter and never starts its query with `?&`

### Requirement: Viewer frame component

`CustomViewerFrame` in `apps/chat/src/components/CustomViewer/CustomViewerFrame.tsx` SHALL render the viewer through `VisualizerConnector` from `@epam/ai-dial-visualizer-connector`, constructed with `domain` = the built iframe URL, `hostDomain` = `window.location.origin`, and `visualizerName` = the resolved `title`. It SHALL fill the available height and width of its container.

- **Loading:** until the connector reports ready (`READY_TO_INTERACT`), the frame SHALL show a centred spinner with an accessible status (`role="status"`, label `customViewer.loading`). The iframe SHALL carry an accessible `title` from `customViewer.frameTitle` (interpolating `{{viewerTitle}}`).
- **Data:** after ready, the frame SHALL send `SEND_VISUALIZE_DATA` (`VisualizerConnectorRequests.sendVisualizeData` from `@epam/ai-dial-shared`) with payload `{ mimeType: 'application/json', visualizerData: { isPreview: false, conversationId, layout: { width: 0, height: 0, themeId, currentLocale, dir } } }`, where `currentLocale` is `useLanguage().language` and `dir` is `document.documentElement.dir` (`'rtl' | 'ltr'`). It SHALL re-send when `conversationId`, `themeId`, `currentLocale` or `dir` changes. `layout` SHALL NOT carry `logInHint`, `providerId` or `accessToken`.
- **Lifecycle:** the connector SHALL be destroyed and recreated when the iframe URL or title changes, and destroyed on unmount. A failing `send` SHALL be logged and SHALL NOT crash the page.
- **Error:** when the configured URL cannot be built, the frame SHALL render an inline error (`role="alert"`, text `customViewer.invalidUrl`) instead of an iframe.
- **Memoisation:** the iframe URL and the `SEND_VISUALIZE_DATA` payload SHALL be `useMemo`-derived so a parent re-render does not recreate the connector or re-send identical data; event callbacks passed in SHALL be read through a ref so changing their identity does not recreate the connector.

**RTL impact:** the frame is a full-bleed container (direction-agnostic); the viewer receives `dir` and handles its own layout. The spinner and error use logical properties only.

#### Scenario: Data is sent after the handshake

- **WHEN** the viewer completes `READY_TO_INTERACT`
- **THEN** the chat sends exactly one `SEND_VISUALIZE_DATA` with the current `conversationId`, `themeId`, `currentLocale` and `dir`

#### Scenario: Theme change re-sends data without reloading

- **WHEN** the user switches the theme while the viewer is open
- **THEN** a new `SEND_VISUALIZE_DATA` with the new `themeId` is sent
- **AND** the iframe is recreated only because the URL's `theme` parameter changed

#### Scenario: Spinner until ready

- **WHEN** the frame mounts and the viewer has not yet sent `READY_TO_INTERACT`
- **THEN** a status element labelled by `customViewer.loading` is visible

### Requirement: Conversation events from the viewer

`CustomViewerFrame` SHALL subscribe, through the connector (which accepts only messages whose `event.source` is the viewer iframe's own window), to `<title>/CREATED_CONVERSATION_SUCCESS` and `<title>/UPDATED_CONVERSATION_SUCCESS` (`VisualizerConnectorEvents` from `@epam/ai-dial-shared`) and report them through `onConversationCreated(id)` / `onConversationUpdated(id)` props.

- The frame SHALL read only `payload.conversation.id`; an event whose payload has no non-empty string `conversation.id` SHALL be ignored. The rest of the payload (a 0.x-shaped conversation object) SHALL NOT be written into chat state — the chat reloads the conversation from its own API instead.
- Bursts SHALL be collapsed: repeated events of the same type and id within 300 ms SHALL produce one callback (leading edge, as in 0.x).
- Events with any other namespace or from any other window SHALL be ignored.

Host handling (in the pages, not the frame):

- `onConversationCreated(id)` SHALL call `refreshConversations([id])` from `useConversations()` and navigate to `getConversationRoute(id)` (`apps/chat/src/constants/routes.ts`). When `getConversationRoute` rejects the id (returns the root route), the chat SHALL NOT navigate.
- `onConversationUpdated(id)` SHALL, when `id` is the open conversation, reload it with the existing conversation fetch in `ConversationPage` and call `refreshConversations()` so a renamed title reaches the sidebar; an update for another conversation SHALL only refresh the list.

#### Scenario: Viewer creates a conversation

- **WHEN** the viewer started from the gate sends `CREATED_CONVERSATION_SUCCESS` with `payload.conversation.id = "conversations/bucket/My chat"`
- **THEN** the conversation list is refreshed expecting that id
- **AND** the browser navigates to that conversation's route, which renders the viewer with that `conversationId`

#### Scenario: Malformed payload is ignored

- **WHEN** the viewer sends `CREATED_CONVERSATION_SUCCESS` with no `payload.conversation`
- **THEN** nothing is refreshed and no navigation happens

#### Scenario: Foreign window is ignored

- **WHEN** another window posts `<title>/CREATED_CONVERSATION_SUCCESS` to the chat
- **THEN** no callback fires

#### Scenario: Debounced updates

- **WHEN** the viewer sends three `UPDATED_CONVERSATION_SUCCESS` for the open conversation within 300 ms
- **THEN** the open conversation is reloaded once

### Requirement: Existing conversation renders the viewer

`ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) SHALL call `useCustomViewer` with the conversation's model id (`assistantModelId || model.id`, the same id the page already restores). When it resolves a viewer, the page SHALL render `CustomViewerFrame` with that conversation's id in place of `ConversationView` (message list, composer, usage banner, footer message). Page chrome outside `ConversationView` (sidebar, header) SHALL stay. Streaming, send and regenerate handlers SHALL NOT be wired for that conversation.

While deployments or schemas are still loading, the page SHALL keep its existing loading state rather than flash the plain chat and then swap to the viewer.

#### Scenario: Viewer replaces the conversation view

- **WHEN** the user opens a conversation whose model resolves a Custom Viewer
- **THEN** the viewer frame is rendered and no message list or chat input is in the DOM

#### Scenario: Regular conversation unchanged

- **WHEN** the user opens a conversation whose model resolves no viewer
- **THEN** `ConversationView` renders exactly as before

### Requirement: New-chat start gate

On the new-chat route (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`), when the selected deployment resolves a Custom Viewer, the composer SHALL stay rendered (so the user can still switch deployment with the in-input selector) with message input disabled through the existing `isChatMessageInputDisabled` path, and the route SHALL render a `CustomViewerStartGate` (`apps/chat/src/components/CustomViewer/CustomViewerStartGate.tsx`) containing a 2.0 `PrimaryButton` (`@epam/ai-dial-ui-kit`) labelled `customViewer.startWorking` (`Start working with the {{viewerTitle}}`) with a leading `IconPlayerPlay` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`). Starter buttons SHALL NOT render for a viewer deployment.

- Pressing the button SHALL replace the composer and gate with `CustomViewerFrame` without a `conversationId`. The started state SHALL be local `useState` in `ConversationRoute`, reset to not-started whenever the selected deployment id changes, a new navigation lands on the route (`useLocation().key` changes — e.g. pressing New chat again while already on it), or the route is left.
- Conversation creation SHALL then be owned by the viewer (see "Conversation events from the viewer"); the chat SHALL NOT call `createConversation` for a viewer deployment.

**Accessibility:** the button is a native button reachable by keyboard; after it is pressed, focus SHALL move to the viewer iframe once mounted.

**RTL impact:** the gate uses logical spacing (`ms-*`/`me-*`, `text-start`); `IconPlayerPlay` is directional and SHALL be mirrored with `rtl:scale-x-[-1]`.

**i18n:** `customViewer.startWorking`, `customViewer.frameTitle` (`{{viewerTitle}} viewer`), `customViewer.loading` (`Loading viewer…`), `customViewer.invalidUrl` (`This application's viewer URL is not valid.`) in `apps/chat/src/i18n/locales/en.json`.

#### Scenario: Gate shown for a viewer app

- **WHEN** the user selects a viewer application on the new-chat route
- **THEN** a button named "Start working with the {{viewerTitle}}" is shown and the message input is disabled

#### Scenario: Start mounts the viewer

- **WHEN** the user presses the start button
- **THEN** the viewer frame mounts with no `conversationId` in its URL

#### Scenario: Switching deployment resets the gate

- **WHEN** the viewer was started and the user selects a different deployment
- **THEN** the viewer unmounts and the normal composer (or a fresh gate for another viewer app) is shown

### Requirement: Frame embedding policy

Embedding a viewer SHALL rely on the existing `ALLOWED_IFRAME_ORIGINS` CSP `frame-src` allowlist (`apps/chat-api/src/config/csp.ts`); no new environment variable SHALL be added, and the legacy `ALLOWED_IFRAME_SOURCES` SHALL NOT be reintroduced. `docs/custom-viewers.md` SHALL state that the viewer's origin must be in `ALLOWED_IFRAME_ORIGINS`, and `docs/legacy-chat-migration-guide.md` SHALL map 0.x Custom Viewer configuration to it.

**Observability:** no new metrics. Dropped events and send failures SHALL be logged with `console.warn` naming the event type, never the payload.

#### Scenario: Origin not allowlisted

- **WHEN** the viewer origin is missing from `ALLOWED_IFRAME_ORIGINS`
- **THEN** the browser blocks the frame, the spinner stays, and the documentation's troubleshooting section names `ALLOWED_IFRAME_ORIGINS` as the fix
