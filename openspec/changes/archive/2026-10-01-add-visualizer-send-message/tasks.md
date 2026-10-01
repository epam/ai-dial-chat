Slicing strategy: **vertical.**

- Slice 1 delivers the flag end to end.
- Slice 2 adds the lib protocol.
- Slice 3 makes the inline surface work through the whole stack.
- Slice 4 widens it to the canvas.
- Slice 5 closes the docs.

Each slice depends on the previous one and is independently verifiable.

## 1. Slice 1 — operator flag (chat-api → client-config → `useFeatureFlag`)

- [x] 1.1 Add `ALLOW_VISUALIZER_SEND_MESSAGES?: boolean = false` to `apps/chat-api/src/config/environment.config.ts`, using the same `@IsOptional()` + boolean `@Transform` + `@IsBoolean()` block as `DEFAULT_DEPLOYMENT_PINNED` (around line 921).
- [x] 1.2 Add `VisualizerSendMessages = 'features.visualizerSendMessages'` to `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`.
- [x] 1.3 Add the registry entry to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, next to `features.defaultDeploymentPinned`:
  - `type: 'feature'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: false`, `critical: false`
  - `owner: 'chat-team'`, `envVar: 'ALLOW_VISUALIZER_SEND_MESSAGES'`, a description, and no `allowedRolesEnvVar`
- [x] 1.4 Tests:
  - Extend `apps/chat-api/src/config/tests/validation.spec.ts`: unset → false, `true` → true, `false`/`0`/`no` → false.
  - Extend `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`: entry shape and client visibility.
  - Extend the `app-config.service` spec: `features.visualizerSendMessages` is emitted with the env value.
  - **Verification:**
    - `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`
    - plus the service spec path
    - then `npm run verify:changed`.
  - Confirm `npm run openapi:check` is clean. No contract change is expected, because `features` is `Record<string, boolean>`.

## 2. Slice 2 — lib protocol (`libs/attachment-canvas`)

- [x] 2.1 In `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx`:
  - Add the `onSendMessage?: (content: string) => void` prop, with JSDoc.
  - Store it in a ref.
  - Inside the existing connector effect, call `connector.subscribe(`${visualizerName}/SEND_MESSAGE`, handler)`.
  - The handler validates the payload: a non-null object with an own string `message` whose trim is non-empty. It calls `onSendMessageRef.current?.(message)` with the untrimmed value.
  - Call the returned unsubscribe before `connector.destroy()` in cleanup.
  - Do not change the effect dependencies.
  - Put the event suffix in a module-level constant using `VisualizerConnectorEvents.sendMessage` from `@epam/ai-dial-shared`.
- [x] 2.2 Add an optional `onVisualizerSendMessage?: (content: string) => void` prop and forward it, typed by reference to the renderer prop, through:
  - `InlineGroupedVisualizer/InlineGroupedVisualizer.tsx` (→ `onSendMessage`)
  - `AttachmentCanvasBody/AttachmentCanvasBody.tsx` (→ `onSendMessage` at both visualizer cases, line ~427)
  - `AttachmentCanvas/AttachmentCanvas.tsx` (→ body, line ~402)
  - `AttachmentCanvasContainer/AttachmentCanvasContainer.tsx` (→ canvas, line ~129)
- [x] 2.3 Tests in `libs/attachment-canvas/src/components/VisualizerCanvasRenderer/tests/VisualizerCanvasRenderer.spec.tsx`:
  - Extend the connector mock with `subscribe`, which captures the handler and returns an unsubscribe spy.
  - Cover:
    - a valid message calls the callback with the exact string;
    - each malformed payload is ignored;
    - with no prop there is no `SEND_MESSAGE` subscription;
    - a new callback identity does not remount and the latest callback is used;
    - unmount unsubscribes before destroy.
  - Add forwarding cases to `InlineGroupedVisualizer/tests/InlineGroupedVisualizer.spec.tsx` and `AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx`.
  - **Verification:** `npm run test:file -- libs/attachment-canvas/src/components/VisualizerCanvasRenderer/tests/VisualizerCanvasRenderer.spec.tsx libs/attachment-canvas/src/components/InlineGroupedVisualizer/tests/InlineGroupedVisualizer.spec.tsx libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx`
- [x] 2.4 Architecture guard: confirm that the `libs/attachment-canvas` diff imports no app context, feature flag, `chat-hooks` send logic, `/api` path, generated client, env access, or i18n. The lib only subscribes and invokes the callback.
- [x] 2.5 Update `libs/attachment-canvas/README.md`:
  - Document `onSendMessage` on `VisualizerCanvasRenderer` and `onVisualizerSendMessage` on `AttachmentCanvasContainer` / `InlineGroupedVisualizer`.
  - State the payload shape `{ message: string }`, and that the host decides whether to send.
  - **Verification:** `npm run validate:docs`, then `npm run verify:changed`.

## 3. Slice 3 — app wiring for the inline surface

- [x] 3.1 Create `apps/chat/src/context/VisualizerMessageContext.tsx`. Implemented with:
  - `VisualizerMessageProvider`: a ref-backed `{ conversationId, send }` registration, with a `useMemo`'d value.
  - `useVisualizerMessage()`, which exposes three stable controls and throws outside the provider:
    - `registerSender(sender | null)`;
    - `getRegisteredConversationId()`;
    - `sendMessage(content, sourceConversationId?)`, which drops the message when nothing is registered, or when the given source id differs from the registered one.
  - A comment explaining why it exists: the canvas is outside the Conversation page.
  - The canvas source id is held by the app shell (slice 4), not by the context.
- [x] 3.2 Mount `VisualizerMessageProvider` in `apps/chat/src/main.tsx`, directly around `<App />`. Every app-level provider lives there and `app.tsx` only consumes hooks, so this wraps both the routes and `AttachmentCanvasContainer`.
- [x] 3.3 New hook `apps/chat/src/hooks/conversation/useVisualizerMessageSendHandler.ts`, called from `apps/chat/src/pages/Conversation/Conversation.tsx` with `conversationId`, `isStreaming`, `isReadOnly` and `handleSend`. It:
  - reads the flag;
  - builds a stable `send` that reads the latest state through a ref, drops the message while streaming or read-only, and otherwise calls `void handleSend(content, [])`;
  - marks the conversation as streaming until the next render, so a same-tick double post sends once;
  - does **not** check `isChatMessageInputDisabled`;
  - registers `send` in the context while the flag is on;
  - returns `send` while the flag is on, otherwise `undefined`.
- [x] 3.4 Inline path: `Conversation.tsx` passes the hook's result to `ConversationView` as `onVisualizerSendMessage`. `ConversationView` forwards it to `ConversationMessageItem`, which forwards it to `<InlineGroupedVisualizer>`. The flag is read once, in the hook, rather than in `ConversationView`.
- [x] 3.5 Tests:
  - New `apps/chat/src/context/tests/VisualizerMessageContext.spec.tsx`:
    - registration and send;
    - drop when unregistered;
    - drop on mismatched source id;
    - clear on unmount;
    - throws outside the provider.
  - Extend `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`: the callback is forwarded to the inline visualizer.
  - Add a Conversation-level test, in the existing Conversation page spec or a new hook spec if the `send` builder is extracted to `apps/chat/src/hooks/conversation/useVisualizerMessageSendHandler.ts`, covering:
    - flag on + idle → `handleSend(content, [])`;
    - streaming → not called;
    - read-only → not called;
    - input-disabled deployment → still called. This holds by construction: the hook takes no input-disabled parameter.
  - **Verification:** `npm run test:file -- apps/chat/src/context/tests/VisualizerMessageContext.spec.tsx apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx` plus the hook or page spec, then `npm run verify:changed`.

## 4. Slice 4 — canvas surface

- [x] 4.1 In `apps/chat/src/app/app.tsx`:
  - Add a `useEffect` keyed on `useAttachmentCanvas().content` identity that records the currently registered `conversationId` as the canvas source id, through a setter exposed by `VisualizerMessageContext`.
  - Pass `onVisualizerSendMessage` to `AttachmentCanvasContainer` (line ~483): `undefined` when the flag is off, otherwise `(content) => sender(content, canvasSourceConversationId)`.
  - Fail closed when no source id has been recorded.
- [x] 4.2 Tests in `apps/chat/src/app/tests/app.spec.tsx`, or a focused hook spec if the effect is extracted to `apps/chat/src/hooks/attachment/useCanvasVisualizerMessageHandler.ts`:
  - flag off → the container gets no callback;
  - flag on → a canvas message reaches the registered sender with the source id;
  - opened in A, active B → dropped.
  - **Verification:** `npm run test:file -- <spec path>`, then `npm run verify:changed`.

## 5. Slice 5 — docs and spec close-out

- [x] 5.1 Update `docs/legacy-chat-migration-guide.md`:
  - Remove `ALLOW_VISUALIZER_SEND_MESSAGES` from the "Dropped with no replacement" row, and drop its sentence from the "Why" cell.
  - Replace line 114 with a ported note covering: `{ message }` payload, sent as a user message in the owning conversation, dropped while streaming or read-only, and boolean parsing (`false`/`0`/`no` = off, versus legacy's any-non-empty = on).
- [x] 5.2 Add `ALLOW_VISUALIZER_SEND_MESSAGES` (default `false`, client-visible feature flag) to `apps/chat-api/README.md` (env table near `DEFAULT_DEPLOYMENT_PINNED`, line ~282) and `apps/chat-api/.env.template` (near line 246). Include the security note: an opted-in visualizer can send messages as the user.
- [x] 5.3 Update `docs/architecture.md`: add `VisualizerMessageContext` to the React contexts list, with a one-line purpose.
- [x] 5.4 Final verification: run `npm run validate:docs`, `npm run build:quiet` (the lib props change the bundle surface), and then exactly one `npm run verify:full`. Every Nx target succeeded: build for 36 projects, typecheck for 34, lint for 37 and tests for 35. Each command still exits 1, because Nx then fails to write its local cache (`os error 32`, a Windows file lock). `verify:full` stops at that point, so lint and tests were run separately.
