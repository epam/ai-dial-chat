## Context

0.x Custom Viewers (on `origin/development-0.x`: `apps/chat/src/components/Chat/Chat.tsx` `customViewer` memo, `CustomChatViewer.tsx`, `IframeRenderer/index.tsx`, `docs/CUSTOM-VIEWERS.md`) replaced the conversation UI with an iframe whose page drives the conversation itself and reports back over postMessage. The new chat has every building block but no wiring:

- Schema `viewerUrl` is already served by `GET /api/v1/application-schemas` (`apps/chat-api/src/application-schemas/application-schemas.service.ts`) and loaded into `DeploymentsContext.schemas`; the context already joins schemas to deployments for icons (`apps/chat/src/context/DeploymentsContext.tsx`, `items` memo).
- Entity `viewer_url` is not mapped (`RawDeploymentDto` lacks it). The SDK types it on applications.
- The chat-side connector (`@epam/ai-dial-visualizer-connector@0.48.0`) and protocol enums (`@epam/ai-dial-shared@0.48.0`) are installed and used by `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx`.
- `ALLOWED_IFRAME_ORIGINS` drives CSP `frame-src` (`apps/chat-api/src/config/csp.ts`).
- Differences from 0.x that shape the design: no client-side "empty conversation" exists before the first message (conversations are created server-side, `ConversationRoute.handleCreateConversation`); no playback/replay/compare; the browser has no access token (BFF session); the deployment picker lives inside `ConversationInput`.

## Goals / Non-Goals

**Goals:** behavioural parity for viewer pages written against 0.x `ChatVisualizerConnector` (same query params, same `SEND_VISUALIZE_DATA` shape, same two conversation events, same `<title>/` namespace); fix the 0.x URL-building bugs; keep all viewer code in `apps/chat`.

**Non-Goals:** see proposal (playback, `SEND_MESSAGE`, widgets route, sample app, editor preview, auth info in layout, `UPDATED_APPLICATION_SUCCESS`).

## Decisions

### D1 — Resolve on the client from data already loaded

`resolveCustomViewer(deployment, schemas)` (pure, `apps/chat/src/utils/custom-viewer.ts`) + `useCustomViewer(deploymentId)` (`apps/chat/src/hooks/custom-viewer/useCustomViewer.ts`). Mirrors the icon join in `DeploymentsContext` without adding fields to the context value.
*Alternatives:* merge in the backend (couples listing to schemas, duplicates the cache); add `customViewer` to `DeploymentsContext` value (widens a hot context — every consumer re-renders on change). Rejected.

### D2 — Backend carries only the raw entity field

`viewer_url` → `DeploymentItemDto.viewerUrl` for applications in `mapToDeploymentItem`. URL validation happens on the client in the resolver (the one place that also validates schema URLs), so both sources share one rule. `@ApiPropertyOptional` only; the DTO is a response, so no `@Matches` is needed. Follow `apps/chat-api/AGENTS.md` for DTO/Swagger conventions; regenerate the client.
*Open item:* confirm against a live DIAL Core that `GET /openai/deployments` (what `listDeployments` calls) includes `viewer_url` for applications. If it does not, fall back to `ApplicationDetailsDto` in `apps/chat-api/src/deployments/dto/deployment-details.dto.ts` (fetched for the selected deployment) — the resolver signature stays the same, only the input field source changes. First task in tasks.md proves this.

### D3 — Reuse the installed connector, frame lives in the app

`CustomViewerFrame` uses `VisualizerConnector` exactly as `VisualizerCanvasRenderer` does (root element, `ready()`, `send()`, `subscribe()`, `destroy()`), so a 0.x viewer's `ChatVisualizerConnector` handshake works unchanged. The connector already drops messages whose `event.source` is not its iframe, which is stricter than 0.x's `startsWith(event.origin)` check.
*Alternatives:* hand-rolled iframe like `AppEditorIframe` (re-implements request/response + `requestId` replies); generalise the canvas renderer into a lib (attachment-shaped, published lib — scope creep). Rejected.
*Lib isolation:* no `libs/*` change. Host data (provider id, theme, locale, conversation id, navigation) is resolved in the app.

### D4 — Build the URL with `URL`/`URLSearchParams`

Fixes 0.x's `?&…` and broken pre-existing query strings. `playback` is dropped (no playback mode). `authProvider` comes from `useUser().user.providerId` (`apps/chat/src/context/auth/UserContext.tsx`), theme from `useTheme().currentTheme`.

### D5 — Events carry an id; the chat reloads its own data

0.x wrote the viewer's conversation object straight into Redux. The new chat's `Conversation` model and backend persistence differ, so the frame extracts only `payload.conversation.id` and the host reloads: `refreshConversations([id])` + navigate on create; reload the open conversation + `refreshConversations()` on update. This avoids trusting a cross-origin object shape and keeps `ConversationsContext` as the owner of list state.
Debounce: per (event type, id), leading edge, 300 ms — parity with 0.x.

### D6 — Rendering placement

- **Existing conversation:** `ConversationPage` branches before `ConversationView`. Chrome outside the view stays; no stream/handlers are wired for a viewer conversation. Loading: keep the page's existing loading state until deployments and schemas resolve, so the plain chat never flashes.
- **New chat:** keep `NewConversationComposer` mounted with input disabled through the existing `isChatMessageInputDisabled` path (so the in-input deployment picker remains usable — verified in tasks, see risk below), render `CustomViewerStartGate` above it; pressing Start swaps both for `CustomViewerFrame` without `conversationId`. Started flag = local `useState` keyed by `${location.key}:${selectedItemId}`, so switching deployment or pressing New chat again on the same route returns to the gate without an effect.
- After create → navigate to `/conversations/:id`; the page remounts the frame with `conversationId` in the URL. 0.x also recreated the iframe on conversation change (URL included the id), so this is parity.

### D7 — States

Loading (spinner `role="status"`), ready (iframe only), invalid URL (inline `role="alert"`), origin blocked by CSP (browser-level; documented troubleshooting — the page cannot detect it reliably). Empty state = the start gate.

### D8 — i18n

Keys under a new `customViewer` domain in `apps/chat/src/i18n/locales/en.json`: `startWorking`, `frameTitle`, `loading`, `invalidUrl`. The viewer `title` itself is never translated (protocol namespace).

## Risks / Trade-offs

- [DIAL Core listing may omit `viewer_url`] → task 1.1 checks a real response; fallback to deployment details (D2).
- [Disabled input may also disable the deployment picker] → task verifies `isChatMessageInputDisabled` keeps the picker enabled; if not, the gate renders `DeploymentSelectorFieldTrigger` (`apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx`) itself instead of the composer.
- [Connector sandbox is narrower than 0.x] (`allow-same-origin allow-scripts allow-modals` vs 0.x's additional `allow-forms allow-popups allow-downloads allow-presentation`) → viewers that open popups (e.g. their own OAuth) or submit forms may break. Document in `docs/custom-viewers.md`; widening needs a connector package release (follow-up, not patched at runtime).
- [Viewer-created conversation in a shape the new chat cannot list/render] → the new chat only lists and reopens it through the viewer; `ConversationPage` never renders its messages itself. If `refreshConversations([id])` cannot discover it, discovery already retries and gives up silently — the user stays on the viewer.
- [Title is a protocol namespace taken from display name] → renaming an app breaks its viewer handshake; same as 0.x, documented. 0.x localised the title via marketplace localisation; the new chat uses the display name verbatim, so a viewer that relied on a localised title must use the default display name.
- [Navigation remounts the iframe after creation] → brief reload; parity with 0.x.

## Migration Plan

Additive, no data migration. Operators moving from 0.x: keep `viewer_url` / `dial:applicationTypeViewerUrl` as they are and move the viewer origin from `ALLOWED_IFRAME_SOURCES` to `ALLOWED_IFRAME_ORIGINS` (documented in `docs/legacy-chat-migration-guide.md`). Rollback: revert the frontend commit; the optional DTO field may stay.

## Open Questions

- Does `listDeployments` return `viewer_url` (D2)? Resolved by task 1.1.
- Should a follow-up widen the connector's iframe `sandbox` for viewers? Out of scope here.
