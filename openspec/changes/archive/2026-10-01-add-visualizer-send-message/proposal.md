## Why

Legacy chat let a visualizer iframe post a chat message on the user's behalf (`${title}/SEND_MESSAGE`). This was gated by the operator flag `ALLOW_VISUALIZER_SEND_MESSAGES`, added in legacy commit `e3b7b02c4f` (#1787). Interactive visualizers rely on it, for example "click a chart bar to ask about it" or quick-app UIs whose only input is the visualizer. 1.0 dropped it as a deferred item (`openspec/changes/archive/2026-07-30-add-custom-visualizers/design.md:214`). Today such a visualizer loads, but every click is silently ignored. Deployments migrating from legacy have no replacement (`docs/legacy-chat-migration-guide.md:128`).

## What Changes

- **New operator flag `ALLOW_VISUALIZER_SEND_MESSAGES`** in `chat-api`.
  - It is a client-visible boolean feature, `features.visualizerSendMessages`, and is off by default.
  - It follows the `DEFAULT_DEPLOYMENT_PINNED` precedent (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts:344`).
  - It reaches the frontend through `GET /api/v1/client-config` → `features` and `useFeatureFlag`. It needs no new endpoint and no DTO change.
- **New `onSendMessage?: (content: string) => void` callback prop on `VisualizerCanvasRenderer`** (`libs/attachment-canvas`).
  - When the prop is set, the renderer subscribes to `${visualizerName}/SEND_MESSAGE` through the connector's existing `subscribe()`.
  - It validates the legacy payload `{ message: string }` and calls the callback.
  - When the prop is absent, the behaviour is today's: messages are ignored.
  - The prop is forwarded through `InlineGroupedVisualizer`, `AttachmentCanvasBody`, `AttachmentCanvas` and `AttachmentCanvasContainer`.
- **The app wires the callback only while the flag is on.** It sends the content as a user message in the conversation the visualizer belongs to, using `handleSend(content, [])`.
  - It drops the message while the assistant is streaming, when the conversation is read-only, and when the canvas no longer shows a visualizer from the active conversation.
  - It covers both custom (MIME-keyed) and application (grouped) visualizers, in the inline surface and in the canvas panel.
- **Docs:**
  - `docs/legacy-chat-migration-guide.md`: move `ALLOW_VISUALIZER_SEND_MESSAGES` out of "Dropped with no replacement", and note the stricter value parsing.
  - Add the variable to `apps/chat-api/README.md` and `.env.template`.
  - Update the `libs/attachment-canvas` README with the new prop.
  - Add the new app context to `docs/architecture.md`.

Not breaking. Every new prop is optional, and the flag defaults to off, so it keeps today's behaviour.

## Alternatives considered

1. **Conservative baseline: leave it dropped.**
   - Rejected. It blocks legacy interactive visualizers, and the iframe side (`ChatVisualizerConnector.sendMessage`) still ships on npm and emits the envelope.
2. **Lib reads the flag itself, or calls the send API.**
   - Rejected. It violates the library-isolation rule: feature flags and conversation sending are host concerns. A callback prop keeps the lib host-agnostic.
3. **Reuse the overlay `registerActiveConversationBridge`** (`apps/chat/src/hooks/conversation/useActiveConversationBridge.ts:47`).
   - Rejected. That bridge exists only in overlay mode (`useOptionalOverlay()` returns null otherwise), and its contract is the external overlay protocol.
   - Instead, a small app-level context carries the active conversation's send handler to the canvas, because the canvas lives in the app shell (`apps/chat/src/app/app.tsx:483`) outside the Conversation page.
4. **Own `window` `message` listener with an `event.origin` check**, as legacy did with `rendererUrl.startsWith(event.origin)`.
   - Rejected for parity with the host connector contract (`custom-visualizers` spec, "message from an unexpected origin is still accepted"). Trust derives from `event.source === iframe.contentWindow`, which the connector already enforces.
   - See design D3.

## Non-goals

- No role gating (`*_ROLES`). Legacy had none.
- No attachments, skills, or system-prompt changes from the visualizer: text content only, matching legacy.
- No response or acknowledgement back to the iframe. Legacy posted none, and the iframe side expects none.
- No change to the overlay `SEND_MESSAGE` protocol (`libs/chat-overlay`).
- No vendoring of `@epam/ai-dial-visualizer-connector`. Its `subscribe()` is used as published.

## Acceptance criteria

- With `ALLOW_VISUALIZER_SEND_MESSAGES` unset or `false`, a visualizer posting `SEND_MESSAGE` produces no chat message. This matches today's behaviour.
- With the flag `true`, a `SEND_MESSAGE` with `{ message: "hi" }` from an inline or canvas visualizer appends a user message "hi" to the active conversation and triggers a model response, exactly like typing it.
- Malformed payloads, empty or whitespace-only content, and messages arriving while streaming or in a read-only conversation are dropped without error.
- `npm run validate:docs`, the lib and app unit tests, and the `chat-api` config tests pass.

## Rollback

Unset the flag, or set it to `false`, and the feature is fully inert. A code revert is a plain revert, because there is no data, storage or API contract change.

## i18n

No new user-visible strings. The feature adds no UI; the message appears as an ordinary user message.

## Capabilities

### New Capabilities

- `visualizer-send-message`: the iframe → chat `SEND_MESSAGE` channel. It covers:
  - the operator flag, and the payload validation;
  - the host callback contract on the visualizer renderer;
  - which conversation receives the message, and when it is dropped.

### Modified Capabilities

- `custom-visualizers`:
  - The "Deferred features" requirement no longer lists `SEND_MESSAGE`, and its "SEND_MESSAGE is not handled" scenario is replaced.
  - The `ChatVisualizerConnector` requirement no longer calls `SEND_MESSAGE` inert. It also corrects the stale claim that `SEND_GROUPED_VISUALIZE_DATA` is never sent.

## Impact

- **`apps/chat-api`:**
  - `config/environment.config.ts`, `app-config/config-registry/config-registry.constants.ts`, `app-config/feature-flags/feature-key.enum.ts`, plus their specs.
  - `README.md` and `.env.template`.
- **`libs/attachment-canvas` (shared lib; this is scope worth flagging):**
  - The `VisualizerCanvasRenderer`, `InlineGroupedVisualizer`, `AttachmentCanvasBody`, `AttachmentCanvas` and `AttachmentCanvasContainer` props.
  - README.
  - Host knowledge stays out: the lib only receives a callback.
- **`apps/chat`:**
  - New `context/VisualizerMessageContext.tsx`.
  - `pages/Conversation/Conversation.tsx` registers the sender.
  - `components/ConversationView/ConversationView.tsx` and `ConversationMessageItem.tsx` carry the inline callback.
  - `app/app.tsx` gives the canvas its callback.
- **Docs:** `docs/legacy-chat-migration-guide.md` and `docs/architecture.md`.
- **Security:** the change opens a channel through which third-party iframe content can make the user send messages. It is mitigated by: off by default, operator opt-in, source-window check, text-only payload, and the streaming and read-only guards.
