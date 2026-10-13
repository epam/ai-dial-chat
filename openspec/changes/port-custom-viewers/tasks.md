Slicing strategy: **risk-first, then vertical.** Slice 1 proves the riskiest unknown (does DIAL Core's listing carry `viewer_url`?) and lands the backend field. Slice 2 opens an existing viewer conversation end to end. Slice 3 adds the new-chat start gate and conversation creation on top. Slice 4 handles docs.

Read `apps/chat-api/AGENTS.md` before slice 1. Relative imports are extensionless, and the Vite apps keep `moduleResolution: "bundler"`. No `libs/*` hand-authored code changes. Architecture guard: if any task drifts into a lib, stop and move it back to `apps/chat`.

## 1. Backend: `viewerUrl` on deployments (risk-first)

- [x] 1.1 Confirm that DIAL Core's deployments listing (the call behind `listDeployments` in `apps/chat-api/src/deployments/listing/deployments-listing.service.ts`) returns `viewer_url` for an application that configures one. Check the SDK response type in `@epam/ai-dial-typescript-sdk` and a recorded or real response. If it does not, switch D2 to the `ApplicationDetailsDto` fallback (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`) and update the `deployments-api` delta spec before continuing.
- [x] 1.2 Add `viewer_url?: string` to `RawDeploymentDto` (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`). Add `@ApiPropertyOptional() viewerUrl?: string` to `DeploymentItemDto` (`apps/chat-api/src/deployments/dto/deployment-item.dto.ts`). Map it in `mapToDeploymentItem` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) for `application` items with a non-empty string only.
  - Verification: `npm run test:file -- apps/chat-api/src/deployments/utils/tests/deployment-mapper.util.spec.ts`
- [x] 1.3 Unit tests in `apps/chat-api/src/deployments/utils/tests/deployment-mapper.util.spec.ts`: an application with `viewer_url` maps it; a model with `viewer_url` does not; a missing or empty value is omitted.
  - Verification: same file as 1.2.
- [x] 1.4 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Confirm that `viewerUrl?: string` appears on the generated `DeploymentItemDto` in `libs/chat-api-client/src/generated/src/models/index.ts`. Do not hand-edit generated files.
  - Verification: `npm run openapi:check`; then `npm run verify:changed` for the slice.

## 2. Existing conversation renders the viewer (vertical slice)

- [x] 2.0 Request `ListDeploymentsInterfaceTypeEnum.CustomUi` alongside `Chat` and `Mcp` in both `getDeployments` calls in `apps/chat/src/context/DeploymentsContext.tsx`, so viewer-only applications are listed (found during apply: the backend's local interface filter otherwise drops them). Update the existing assertion on the requested interface types in the `DeploymentsContext` tests.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/DeploymentsContext.spec.tsx`

- [x] 2.1 Create `apps/chat/src/utils/custom-viewer.ts` with:
  - the `CustomViewer` type
  - `resolveCustomViewer(deployment, schemas)`: direct URL first, then the schema; `http:`/`https:` only; title used verbatim; `undefined` without a title or for non-applications
  - `buildCustomViewerUrl(...)`: uses `URL`/`URLSearchParams`; params `authProvider`, `conversationId`, `id`, `theme`; preserves an existing query; no `playback`
  - Use const arrow helpers.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/custom-viewer.spec.ts`
- [x] 2.2 Unit tests in `apps/chat/src/utils/tests/custom-viewer.spec.ts`:
  - `resolveCustomViewer`: direct URL wins; schema fallback; no viewer; `javascript:` and malformed URLs fall through; a model never resolves; an empty title resolves to `undefined`.
  - `buildCustomViewerUrl`: an existing query is preserved; an empty provider is omitted; ids are encoded.
  - Verification: same file.
- [x] 2.3 Create `apps/chat/src/hooks/custom-viewer/useCustomViewer.ts`. It reads `items` and `schemas` from `useDeployments()`, finds the deployment with `findDeploymentByIdOrReference`, and returns `useMemo(resolveCustomViewer)` plus a `isResolving` flag that is true while deployments or schemas are loading. Add JSDoc explaining why it exists (one rule shared by the page and the route).
  - Verification: `npm run test:file -- apps/chat/src/hooks/custom-viewer/tests/useCustomViewer.spec.ts`
- [x] 2.4 Unit tests for `useCustomViewer` in `apps/chat/src/hooks/custom-viewer/tests/useCustomViewer.spec.ts`: it resolves by id and by reference, returns `undefined` for an unknown id, and reports resolving while loading.
  - Verification: same file.
- [x] 2.5 Create `apps/chat/src/components/CustomViewer/CustomViewerFrame.tsx`. Props: `viewer`, `conversationId?`, `onConversationCreated?`, `onConversationUpdated?`.
  - **Connector:** create a `VisualizerConnector` (`@epam/ai-dial-visualizer-connector`) on a root div, following `VisualizerCanvasRenderer`. Recreate it on URL or title change and destroy it on unmount.
  - **Data:** after `ready()`, send `SEND_VISUALIZE_DATA` with the spec payload (`themeId` from `useTheme().currentTheme`, `currentLocale` from `useLanguage().language`, `dir` from `document.documentElement.dir`). Re-send on change.
  - **Events:** subscribe to `<title>/CREATED_CONVERSATION_SUCCESS` and `<title>/UPDATED_CONVERSATION_SUCCESS`. Extract `payload.conversation.id`. Debounce by type and id for 300 ms on the leading edge. Hold callbacks in a ref.
  - **States:** a spinner (`role="status"`) until ready; an iframe accessible title; an inline `role="alert"` on an invalid URL; `console.warn` on dropped events and failed sends.
  - **Styling:** fill the container; logical classes only.
  - Verification: `npm run test:file -- apps/chat/src/components/CustomViewer/tests/CustomViewerFrame.spec.tsx`
- [x] 2.6 Component tests in `apps/chat/src/components/CustomViewer/tests/CustomViewerFrame.spec.tsx`. Mock the connector module:
  - the spinner shows until ready
  - data is sent once after ready and re-sent on a theme change
  - created and updated callbacks fire with the id
  - malformed payloads are ignored
  - a burst within 300 ms yields one callback
  - an invalid URL renders the alert
  - unmount destroys the connector
  - Query by role and label only.
  - Verification: same file.
- [x] 2.7 In `apps/chat/src/pages/Conversation/Conversation.tsx`:
  - call `useCustomViewer(conversation.assistantModelId || conversation.model.id)`
  - while `isResolving`, keep the existing loading state
  - when a viewer resolves, render `CustomViewerFrame` with the conversation id instead of `ConversationView`, and skip wiring the stream and send handlers for it
  - `onConversationUpdated(id)`: when `id` is the open conversation, reload it with the page's existing fetch; in all cases call `refreshConversations()`
  - `onConversationCreated(id)`: call `refreshConversations([id])`, then navigate with `getConversationRoute(id)`, unless that returns the root route
  - Verification: `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`
- [x] 2.8 Extend `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`: a viewer conversation renders the frame and no chat input; a regular conversation still renders `ConversationView`; an update event reloads the open conversation.
  - Verification: same file; then `npm run verify:changed` for the slice.

## 3. New-chat start gate and viewer-created conversations (vertical slice)

- [x] 3.1 Add i18n keys to `apps/chat/src/i18n/locales/en.json` under a new `customViewer` domain:
  - `startWorking`: "Start working with the {{viewerTitle}}"
  - `frameTitle`: "{{viewerTitle}} viewer"
  - `loading`: "Loading viewer…"
  - `invalidUrl`: "This application's viewer URL is not valid."
  - Add the same keys to every other locale file the i18n check requires (English fallback text).
  - Verification: the repo's i18n key check (run as part of `npm run verify:changed`).
- [x] 3.2 Create `apps/chat/src/components/CustomViewer/CustomViewerStartGate.tsx`:
  - a 2.0 `PrimaryButton` (look up its props with the ui-kit MCP `getEntityDetails`) labelled `customViewer.startWorking`
  - a leading `IconPlayerPlay` with `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}` and `rtl:scale-x-[-1]`
  - an `onStart` prop
  - Verification: `npm run test:file -- apps/chat/src/components/CustomViewer/tests/CustomViewerStartGate.spec.tsx`
- [x] 3.3 Component test in `apps/chat/src/components/CustomViewer/tests/CustomViewerStartGate.spec.tsx`: the button is found by its accessible name with the interpolated title, and clicking it and pressing Enter both call `onStart`.
  - Verification: same file.
- [x] 3.4 Before wiring the gate, check that `isChatMessageInputDisabled` keeps the in-input deployment picker enabled. Read `libs/conversation-input` and the `chat-input-disabled-state` spec. If it does not, render `DeploymentSelectorFieldTrigger` (`apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx`) in the gate instead of keeping the composer, and record the switch in design.md D6.
- [x] 3.5 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, call `useCustomViewer(selectedItemId)`.
  - **Viewer resolved, not started:** keep the composer with input disabled, hide the starter buttons, and render `CustomViewerStartGate`.
  - **Started:** render `CustomViewerFrame` without `conversationId`, then move focus to the iframe.
  - **Started state:** local `useState`, reset when the selected deployment id changes.
  - **Created event:** `refreshConversations([id])`, then navigate to `getConversationRoute(id)`.
  - Never call `createConversation` for a viewer deployment.
  - Verification: `npm run test:file -- apps/chat/src/pages/ConversationRoute/tests/ConversationRoute.custom-viewer.spec.tsx`
- [x] 3.6 Tests in `apps/chat/src/pages/ConversationRoute/tests/ConversationRoute.custom-viewer.spec.tsx`:
  - the gate shows for a viewer app with input disabled
  - Start mounts the frame without `conversationId`
  - switching deployment resets the gate
  - a created event refreshes and navigates
  - a non-viewer deployment shows the composer unchanged
  - Verification: same file.
- [x] 3.7 RTL check: gate and frame use only logical classes (`ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`) and the play icon is mirrored. Add one assertion in the `CustomViewerStartGate` test that the icon carries the `rtl:scale-x-[-1]` class.
  - Verification: `npm run test:file -- apps/chat/src/components/CustomViewer/tests/CustomViewerStartGate.spec.tsx`; then `npm run verify:changed` for the slice.

## 4. Documentation

- [x] 4.1 Write `docs/custom-viewers.md`:
  - configuration (`viewer_url`, `dial:applicationTypeViewerUrl`, precedence, title = namespace)
  - `ALLOWED_IFRAME_ORIGINS`
  - the iframe query parameters
  - the `SEND_VISUALIZE_DATA` payload
  - the handled events and the fact that only `conversation.id` is read
  - the sandbox limits
  - non-supported 0.x parts (playback, `SEND_MESSAGE`, auth fields, widgets)
  - troubleshooting
- [x] 4.2 Update `docs/architecture.md`: Custom Viewer flow summary with a link to `docs/custom-viewers.md`, and the new `apps/chat/src/components/CustomViewer` component area.
- [x] 4.3 Update `docs/legacy-chat-migration-guide.md`: map 0.x Custom Viewers to the new chat (`ALLOWED_IFRAME_SOURCES` → `ALLOWED_IFRAME_ORIGINS`, dropped `playback` parameter, title no longer localised, payload reading).
- [x] 4.4 Add the `dial-docs` index entry for `docs/custom-viewers.md` if that skill's index lists docs explicitly.
  - Verification: `npm run validate:docs` and `npm run validate:specs`.

## 5. Close-out

- [x] 5.1 Run `npm run verify:full` once, plus `npm run build:quiet`, because the new connector import enters the chat bundle.

## 6. Follow-ups (out of scope, record only)

- [x] 6.1 File follow-ups for: `SEND_MESSAGE` from viewers (behind `visualizerSendMessages`); the `/widgets/:slug` route; the `apps/custom-viewer-test` sample app; widening the connector iframe `sandbox` for viewers.
