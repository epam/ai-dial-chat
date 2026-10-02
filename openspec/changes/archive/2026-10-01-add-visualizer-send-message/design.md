## Context

**Legacy behaviour** (commit `e3b7b02c4f`, #1787; last seen in `ac755e4848:apps/chat/src/components/VisualalizerRenderer/VisualizerRenderer.tsx:206-247` and `GroupedVisualizerRenderer.tsx`):

- `get-common-page-props.ts` set `allowVisualizerSendMessages: !!process.env.ALLOW_VISUALIZER_SEND_MESSAGES`.
- Each renderer attached a `window` `message` listener. The listener filtered on `rendererUrl.startsWith(event.origin)`, accepted `${title}/SEND_MESSAGE` with an own `message` property, and dispatched `sendMessages` with `{ role: User, content }` to the selected conversations.
- There was no streaming guard and no acknowledgement back to the iframe.
- The iframe side (`ChatVisualizerConnector.sendMessage`) posts `{ type: '${appName}/SEND_MESSAGE', payload: { message } }`, without a `requestId`.

**1.0 today:**

- `VisualizerCanvasRenderer` (`libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx:107`) creates the published `VisualizerConnector`.
- The connector's `process()` (in `node_modules/@epam/ai-dial-visualizer-connector/index.esm.js`) works as follows:
  - It drops a message when `event.source` is not the iframe's window.
  - It routes messages that carry no `requestId` to `processEvent(type, payload)`, which calls subscribers registered with `subscribe(eventType, cb)`.
  - So `SEND_MESSAGE` already reaches `processEvent`; it just has no subscriber.
- **Render sites:**
  - Inline: `InlineGroupedVisualizer`, used for application visualizers, rendered from `ConversationMessageItem.tsx:1019`.
  - Canvas: `AttachmentCanvasBody.tsx:424`, under `AttachmentCanvasContainer`, which is mounted in the app shell (`apps/chat/src/app/app.tsx:483`) outside the Conversation page.
- **Sending:** `handleSend` (`libs/chat-hooks/.../useConversationHandlers.ts:164`) has no streaming guard of its own. `Conversation.tsx:365` owns `isStreaming` and `:194` owns `isReadOnly`.
- **Flag precedent:** `features.defaultDeploymentPinned` goes env → registry → `features` map → `useFeatureFlag`, and needs no DTO or mapper change.

## Goals / Non-Goals

**Goals:**

- Behaviour parity with legacy for the `SEND_MESSAGE` envelope.
- Off by default, with an operator opt-in.
- The lib stays host-agnostic.

**Non-Goals:** role gating, attachments or skills in visualizer messages, acknowledgement to the iframe, overlay protocol changes, and vendoring the connector.

## Decisions

### D1. Flag delivery: a feature-type registry entry, not a config field

Add `features.visualizerSendMessages`, mirroring `features.defaultDeploymentPinned` (`config-registry.constants.ts:344`). The generic provider/service loop already emits `features.*` booleans, so there is no change to `ClientConfigResponseDto`, the mapper, or OpenAPI, and no generated-client regeneration.

- *Alternative:* a top-level `config` boolean like `overlayEnabled`. Rejected: it needs mapper and DTO changes and an OpenAPI regeneration for no gain.
- *Parsing:* fail-closed, unlike the `false`/`0`/`no` denylist the other boolean flags use: only `true`/`1`/`yes` (case-insensitive, trimmed) turn it on, so `''`, `off` or a typo leave it off. The flag lets an iframe send messages as the user, so an ambiguous value must not enable it. Legacy treated any non-empty value as on. The difference is documented in the migration guide.

### D2. The lib boundary is a callback prop

`VisualizerCanvasRenderer.onSendMessage?: (content: string) => void`, forwarded as `onVisualizerSendMessage` through the container, canvas, body and inline components.

- The lib does the protocol work: subscribe, validate the payload shape, unsubscribe.
- The app does the policy work: flag, target conversation, guards, send.
- This follows the existing `onAppInfo` callback on `McpAppCanvasRenderer` (`AttachmentCanvasBody.tsx:432`).
- The callback goes into a ref, so identity changes never touch the connector effect. This preserves the existing "no remount" invariant (renderer spec, grouped no-remount tests).

### D3. Use `connector.subscribe`, with no extra origin check

- **Why `subscribe`:** it is the published API and already sits behind the source-window filter. The legacy wire format has no `requestId`, so the message routes to subscribers.
- **Why no origin check:** the `custom-visualizers` spec makes source-window identity the trust anchor and explicitly rejects origin filtering on the host side. Adding an origin check only for `SEND_MESSAGE` would need a second `window` listener, duplicating the connector.
- **Residual risk:** an iframe that navigates itself to another origin keeps the same `contentWindow`. It is accepted, because the visualizer URL is operator-configured and the iframe already runs arbitrary code under `allow-scripts allow-same-origin`, and the flag is opt-in. The same reasoning is recorded in the risks section below.

### D4. Getting the send handler to the canvas: a new app-level `VisualizerMessageContext`

- **Problem:** the canvas lives outside the Conversation page.
- **Alternatives:**
  - Reuse the overlay bridge. Rejected: it exists only in overlay mode and is the external protocol.
  - Put the callback inside the `openCanvas` content. Rejected: it puts a function into a content model, and the callback goes stale after navigation.
  - Lift `handleSend` to the app shell. Rejected: too invasive.
- **Shape:**
  - The provider is mounted in `main.tsx`, around `<App />`, so it covers both the routes and `AttachmentCanvasContainer`.
  - It holds a ref with `{ conversationId, send }`.
  - `useVisualizerMessage()` exposes three stable controls: `registerSender`, `getRegisteredConversationId`, and `sendMessage(content, sourceConversationId?)`, which reads the ref at call time.
  - The Conversation page registers through `useVisualizerMessageSendHandler` (`apps/chat/src/hooks/conversation/`). That hook also reads the flag and returns the inline callback.
  - The context value is `useMemo`'d. The consumer hook throws outside the provider.
- **The `send` registered by the page** is a closure over the latest `isStreaming`, `isReadOnly`, overlay `disabled-send` and `handleSend`, kept in a ref that is synced in a layout effect after each commit (not during render):
  - if streaming, read-only, or the overlay host enabled `disabled-send` → drop;
  - otherwise → `void handleSend(content, [])`.
  - `isChatMessageInputDisabled` is deliberately **not** a guard (see the spec).

### D5. Canvas messages are bound to their source conversation

- `app.tsx` already reads `useAttachmentCanvas()` (`app.tsx:155`). A `useEffect` keyed on the canvas `content` identity records the registered `conversationId` at the moment content changes.
  - Every `openCanvas` call originates inside a conversation: `ConversationMessageItem.tsx:417/683/699`, `ConversationView.tsx:460`, and the attachment resolvers.
  - So this captures the source conversation for every open path without touching each call site.
- The canvas callback passes that recorded id, and the sender drops the message when it differs from the currently registered id.
- This prevents a visualizer opened from conversation A from posting into B after navigation. Legacy's "selected conversations" had this bug.
- Inline surfaces are already scoped by being rendered inside their conversation, so they need no id.

### D6. No acknowledgement and no rate limiting

- Legacy sent no response, and `sendMessage` on the iframe side is fire-and-forget.
- The streaming guard already prevents overlapping requests, which is the practical flood control: a visualizer can send at most one message per completed response.

## Risks / Trade-offs

- **[Third-party iframe makes the user send messages]** → Mitigations: off by default, operator opt-in, source-window check, text only, and the streaming and read-only guards. The message is visible in history as a user message. This is documented in the README env table.
- **[Silent drops confuse visualizer authors]** → It matches legacy (no ack). The README states the drop conditions. A future change could add a `SEND_MESSAGE/RESPONSE` if authors ask.
- **[The canvas source id is recorded wrongly]** → The capture happens once per content change rather than per call site, so a new `openCanvas` path is covered automatically. It fails closed: with no recorded id, canvas messages are dropped. A test covers open in A → navigate to B → drop.
- **[Payload shape `{ message }` versus overlay `{ content }`]** → We follow the visualizer wire format (`{ message }`), not the overlay one. The spec pins it.

## Migration Plan

- Deploy with the flag unset; there is no behaviour change. Operators migrating from legacy set `ALLOW_VISUALIZER_SEND_MESSAGES=true`.
- **Rollback:** unset the flag (runtime-inert) or revert the code. No data or contract changes.

## Open Questions

None blocking. Role gating (`ALLOW_VISUALIZER_SEND_MESSAGES_ROLES`) can be added later via `allowedRolesEnvVar` without a contract change.
