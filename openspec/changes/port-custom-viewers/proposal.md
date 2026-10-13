## Why

Legacy DIAL Chat (`origin/development-0.x`) let an application replace the whole conversation UI with its own page — a **Custom Viewer** — configured either directly on the application (`viewer_url`) or on its application type schema (`dial:applicationTypeViewerUrl`). The new chat drops that configuration on the floor: `apps/chat-api/src/application-schemas/application-schemas.service.ts` already maps the schema value to `viewerUrl`, but no frontend code reads it, and the entity-level `viewer_url` is not read at all. Applications that ship a viewer (operators migrating from 0.x) therefore open as a plain chat and cannot work.

## What Changes

- **Backend:** `GET /api/v1/deployments` (and the lookup path that shares `mapToDeploymentItem`) exposes a new optional `viewerUrl` on `DeploymentItemDto`, mapped from DIAL Core's `viewer_url` for applications only. The generated client is regenerated. Non-breaking (optional field).
- **Frontend resolution:** a pure resolver picks the viewer for a deployment — the direct `viewerUrl` first, then the matching application schema's `viewerUrl` (already in `DeploymentsContext.schemas`) — together with the viewer **title**, which is also the postMessage namespace.
- **Frontend rendering:** for a conversation whose deployment resolves a viewer, `ConversationPage` renders a full-height iframe (`CustomViewerFrame`) in place of the message list and composer. On the new-chat route, selecting a viewer app shows a **"Start working with {{viewerTitle}}"** gate; pressing it mounts the viewer with no conversation id.
- **Protocol (parity with 0.x, via the already-installed `@epam/ai-dial-visualizer-connector`):** iframe URL carries `authProvider`, `conversationId`, `id`, `theme` query parameters; after `READY_TO_INTERACT` the chat sends `SEND_VISUALIZE_DATA` (`isPreview`, `conversationId`, `layout` with `themeId`, `currentLocale`, `dir`); the chat reacts to `CREATED_CONVERSATION_SUCCESS` (refresh the list, navigate to the conversation) and `UPDATED_CONVERSATION_SUCCESS` (reload the open conversation, refresh the list).
- **Security:** frame embedding stays governed by the existing `ALLOWED_IFRAME_ORIGINS` (legacy `ALLOWED_IFRAME_SOURCES` is not reintroduced). Only events from the viewer iframe's own window are accepted.
- **Docs:** new `docs/custom-viewers.md`, entries in `docs/architecture.md` and `docs/legacy-chat-migration-guide.md`.

## Capabilities

### New Capabilities

- `custom-viewers`: resolving a deployment's Custom Viewer, the new-chat start gate, the full-page viewer frame, its URL/query contract, the data sent to the viewer, and the conversation events the chat handles.

### Modified Capabilities

- `deployments-api`: `DeploymentItemDto` gains an optional `viewerUrl` mapped from DIAL Core `viewer_url` (added requirement; existing shape requirements unchanged).

## Non-goals

- **Playback / replay / compare gating** — the new chat has none of these modes, so the 0.x `playback=true` parameter and the context-menu gating have nothing to attach to.
- **`SEND_MESSAGE` from a viewer** — 0.x ignored it for viewers; it stays ignored. Follow-up if needed (would reuse `visualizerSendMessages`).
- **`/widgets/:slug` route** (0.x `WidgetView`) — no such route exists in the new chat. Follow-up.
- **`apps/custom-viewer-test` sample app** — not ported. Follow-up.
- **Application-editor preview of a viewer** (`isPreview: true`) — the editor preview (`app-preview-chat`) is Quick-Apps-only; viewer apps never reach it. `isPreview` is always `false`.
- **Passing auth info / access tokens** (`logInHint`, `providerId`, `accessToken` in `layout`) — 0.x did not pass them to viewers either, and the new chat's browser never holds the access token (BFF session).
- `UPDATED_APPLICATION_SUCCESS` — belongs to the embedded app editor (`AppEditorIframe`), already ported.

## Alternatives considered

1. **Port 0.x as-is into the app (picked)** — reuse the installed connector package the way `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` does; viewer-specific code lives in `apps/chat`. Lowest risk, viewer pages written for 0.x keep working unchanged.
2. **Hand-written postMessage frame like `apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`** — full control over `sandbox` and origin checks, but re-implements the request/response handshake the viewer's `ChatVisualizerConnector` expects. Rejected: protocol drift risk for no user-visible gain.
3. **Generalise `VisualizerCanvasRenderer` into a shared lib frame** — rejected as scope creep: it is attachment-shaped (`AttachmentData`, grouped data) and lives in a published lib.
4. **Resolve the viewer in the backend** (one merged `viewerUrl` on the DTO) — rejected: the schema list is already on the client and cached; a backend join would duplicate `DeploymentsContext`'s schema join and couple the deployments listing to the schemas endpoint.

## Acceptance criteria

- An application with `viewer_url` (or whose schema has `dial:applicationTypeViewerUrl`) shows the Start gate on the new-chat route; pressing Start mounts the viewer; a conversation the viewer creates appears in the sidebar and becomes the open route.
- Opening an existing conversation of such an application renders the viewer instead of messages and composer, with `conversationId` in the URL and in `SEND_VISUALIZE_DATA`.
- A direct `viewer_url` wins over the schema value; an application with neither renders the normal chat.
- Messages from any window other than the viewer iframe, or with a different `<title>/` namespace, are ignored.
- Unit tests cover the resolver, URL builder, frame event handling, gate, and backend mapping; `npm run openapi:check`, `npm run validate:docs`, `npm run validate:specs` pass.

## Impact

- **Backend:** `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`, `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`; `libs/chat-api-client` regenerated.
- **Frontend:** new `apps/chat/src/utils/custom-viewer.ts`, `apps/chat/src/hooks/custom-viewer/useCustomViewer.ts`, `apps/chat/src/components/CustomViewer/*`; edits to `apps/chat/src/pages/Conversation/Conversation.tsx` and `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`. Follows the `DeploymentsContext` schema-icon join (`apps/chat/src/context/DeploymentsContext.tsx`, `items` memo) for schema lookup.
- **Libs:** no hand-authored lib changes. `@epam/ai-dial-visualizer-connector` and `@epam/ai-dial-shared` are already root dependencies; the app adopts them directly.
- **No new context, no new env var, no feature flag** — the feature is dark unless DIAL Core configuration carries a viewer URL.
- **i18n:** new keys `customViewer.startWorking`, `customViewer.frameTitle`, `customViewer.loading`, `customViewer.invalidUrl` in `apps/chat/src/i18n/locales/en.json`.
- **Rollback:** additive. Reverting the frontend restores the plain chat for viewer apps; the extra optional DTO field is harmless if left in place.
