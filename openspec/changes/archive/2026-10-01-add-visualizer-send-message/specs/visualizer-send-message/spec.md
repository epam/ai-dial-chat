## ADDED Requirements

### Requirement: `ALLOW_VISUALIZER_SEND_MESSAGES` operator flag

`chat-api` SHALL accept an optional boolean environment variable `ALLOW_VISUALIZER_SEND_MESSAGES`, validated at boot on `EnvironmentVariables` with the same boolean transform as `DEFAULT_DEPLOYMENT_PINNED`: unset → `false`; `"false"`, `"0"`, `"no"` (case-insensitive) → `false`; any other value → `true`.

The config registry SHALL expose it as a feature entry with key `features.visualizerSendMessages`, `type: 'feature'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: false`, `envVar: 'ALLOW_VISUALIZER_SEND_MESSAGES'`, and no `allowedRolesEnvVar`. `FeatureKey` SHALL gain `VisualizerSendMessages = 'features.visualizerSendMessages'`.

The value SHALL reach the browser through the existing `GET /api/v1/client-config` response as `features.visualizerSendMessages: boolean`. No new endpoint, DTO, or generated-client method is introduced; `ClientConfigResponseDto.features` is already `Record<string, boolean>`. The frontend SHALL read it with `useFeatureFlag('visualizerSendMessages')` from `apps/chat/src/context/AppConfigContext.tsx`, which returns `false` until the config is loaded.

The feature is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` and has no per-role variant.

Example response fragment:

```json
{ "features": { "visualizerSendMessages": true } }
```

#### Scenario: flag defaults to off

- **WHEN** `ALLOW_VISUALIZER_SEND_MESSAGES` is not set
- **THEN** `GET /api/v1/client-config` returns `features.visualizerSendMessages: false`

#### Scenario: flag enabled

- **WHEN** `ALLOW_VISUALIZER_SEND_MESSAGES=true`
- **THEN** `GET /api/v1/client-config` returns `features.visualizerSendMessages: true`

#### Scenario: legacy-style false value disables the flag

- **WHEN** `ALLOW_VISUALIZER_SEND_MESSAGES=false`
- **THEN** `features.visualizerSendMessages` is `false`

---

### Requirement: Visualizer renderer exposes a host message callback

`VisualizerCanvasRenderer` (`libs/attachment-canvas`) SHALL accept an optional prop `onSendMessage?: (content: string) => void`.

- The renderer SHALL register `connector.subscribe(`${visualizerName}/SEND_MESSAGE`, handler)` on every `VisualizerConnector` instance it creates, whether or not `onSendMessage` is set, so that the host turning the callback on or off never remounts the iframe. It SHALL unsubscribe before `connector.destroy()`.
- The handler SHALL accept only a payload that is a non-null object with an own `message` property of type `string` whose trimmed value is non-empty. It SHALL then call `onSendMessage` with the **untrimmed** `message` string. Any other payload SHALL be ignored without throwing.
- The renderer SHALL read `onSendMessage` through a ref, so a new callback identity neither remounts the iframe nor re-runs the handshake. The connector effect's dependencies remain `url`, `visualizerName`, `requestTimeout`.
- When `onSendMessage` is absent or becomes `undefined`, inbound `SEND_MESSAGE` envelopes SHALL be ignored.
- The message is accepted before and after `READY_TO_INTERACT`; the renderer applies no handshake gate of its own.
- Source filtering is the connector's (`event.source === iframe.contentWindow`). The renderer SHALL NOT add an `event.origin` check.

`InlineGroupedVisualizer`, `AttachmentCanvasBody`, `AttachmentCanvas`, and `AttachmentCanvasContainer` SHALL each accept an optional `onVisualizerSendMessage?: (content: string) => void` prop and forward it unchanged to every `VisualizerCanvasRenderer` they render (both `Visualizer` and `GroupedVisualizer` content).

The lib SHALL NOT read feature flags, conversation state, or any send API; whether and where the message goes is decided entirely by the callback the host passes. The lib renders no new UI: RTL impact none, no new strings, no new ARIA.

#### Scenario: valid message is forwarded

- **WHEN** a renderer with `visualizerName` `'my-viz'` and an `onSendMessage` spy receives `my-viz/SEND_MESSAGE` with payload `{ message: 'Show Q3 details' }` from its iframe
- **THEN** `onSendMessage` is called once with `'Show Q3 details'`

#### Scenario: malformed payload is ignored

- **WHEN** the payload is `undefined`, a string, `{}`, `{ message: 42 }`, or `{ message: '   ' }`
- **THEN** `onSendMessage` is not called
- **AND** no error is thrown and the renderer status is unchanged

#### Scenario: no callback means the message is ignored

- **WHEN** the renderer is rendered without `onSendMessage` and the iframe posts a valid `SEND_MESSAGE`
- **THEN** nothing is called and no error is thrown

#### Scenario: adding the callback later does not remount

- **WHEN** the renderer re-renders from no `onSendMessage` to a defined one
- **THEN** the connector is not destroyed or recreated
- **AND** the next valid `SEND_MESSAGE` invokes the new callback

#### Scenario: callback identity change does not remount

- **WHEN** the parent re-renders with a new `onSendMessage` function
- **THEN** the connector is not destroyed or recreated
- **AND** the next `SEND_MESSAGE` invokes the latest callback

#### Scenario: unmount unsubscribes

- **WHEN** the renderer unmounts
- **THEN** the `SEND_MESSAGE` subscription is removed before the connector is destroyed

#### Scenario: canvas and inline surfaces forward the callback

- **WHEN** `AttachmentCanvasContainer` or `InlineGroupedVisualizer` is given `onVisualizerSendMessage`
- **THEN** the `VisualizerCanvasRenderer` it renders receives it as `onSendMessage`

---

### Requirement: Host sends the visualizer message into the owning conversation

The chat app SHALL pass a visualizer message callback to the visualizer surfaces **only** when `useFeatureFlag('visualizerSendMessages')` is `true`; otherwise it SHALL pass `undefined`.

State ownership: a new app context `VisualizerMessageContext` (`apps/chat/src/context/VisualizerMessageContext.tsx`) SHALL hold a ref-backed registration `{ conversationId, send }` published by the Conversation page (`apps/chat/src/pages/Conversation/Conversation.tsx`). Its value SHALL be memoised (`useMemo`), its consumer hook SHALL throw outside the provider, and registration SHALL be cleared when the page unmounts or the conversation changes. The context renders nothing.

When the callback fires with `content`, the host SHALL call the Conversation page's `handleSend(content, [])`, the same path as typing and sending. The message is a `user` message with no attachments and no skills, which matches legacy. The callback SHALL drop the message, without error and without UI, when any of these holds:

- the assistant is currently streaming in that conversation (`isStreaming`);
- the conversation is read-only (the same `isReadOnly` that hides the input);
- an overlay host enabled the `disabled-send` UI feature (`OverlayFeature.DisabledSend`), which blocks every send path;
- no conversation is registered;
- for the canvas surface: the conversation that opened the visualizer canvas is not the currently registered conversation.

It SHALL NOT be dropped merely because the deployment sets `isChatMessageInputDisabled`: visualizer-driven applications may legitimately hide the text input.

Surfaces:

- **Inline:** `ConversationView` SHALL pass the callback to `ConversationMessageItem`, which forwards it to `InlineGroupedVisualizer` as `onVisualizerSendMessage`. This covers application visualizers rendered inline.
- **Canvas:** `apps/chat/src/app/app.tsx` SHALL pass the callback to `AttachmentCanvasContainer` as `onVisualizerSendMessage`. This covers custom and application visualizers opened in the canvas panel.

Observability: no telemetry event is emitted. The send is indistinguishable from a typed message in conversation history, which matches legacy.

Accessibility: no new UI. The resulting message and response render through the existing message list and its live region.

#### Scenario: inline application visualizer sends a message

- **WHEN** the flag is on, the conversation is idle and writable, and an inline grouped visualizer posts `SEND_MESSAGE` with `{ message: 'Next page' }`
- **THEN** a user message `Next page` is appended to that conversation
- **AND** the model response streams as for a typed message

#### Scenario: canvas visualizer sends a message

- **WHEN** the flag is on and a custom visualizer opened in the canvas from the active conversation posts `SEND_MESSAGE` with `{ message: 'Zoom in' }`
- **THEN** a user message `Zoom in` is sent in the active conversation

#### Scenario: flag off passes no callback

- **WHEN** `features.visualizerSendMessages` is `false`
- **THEN** no visualizer surface receives `onVisualizerSendMessage`
- **AND** a posted `SEND_MESSAGE` produces no chat message

#### Scenario: dropped while streaming

- **WHEN** the flag is on and the assistant is streaming a response
- **THEN** an inbound `SEND_MESSAGE` is dropped and no second request starts

#### Scenario: dropped in a read-only conversation

- **WHEN** the flag is on and the conversation is read-only
- **THEN** an inbound `SEND_MESSAGE` is dropped

#### Scenario: dropped when the overlay host disabled sending

- **WHEN** the flag is on and the overlay host enabled `disabled-send`
- **THEN** an inbound `SEND_MESSAGE` is dropped

#### Scenario: canvas from another conversation is dropped

- **WHEN** the user opens a visualizer in the canvas from conversation A, navigates to conversation B with the canvas still open, and the visualizer posts `SEND_MESSAGE`
- **THEN** no message is sent to B or A

#### Scenario: input-disabled deployment still accepts visualizer messages

- **WHEN** the flag is on and the selected deployment sets `isChatMessageInputDisabled`
- **THEN** a valid `SEND_MESSAGE` is still sent

---

### Requirement: Migration guide reflects the ported flag

`docs/legacy-chat-migration-guide.md` SHALL list `ALLOW_VISUALIZER_SEND_MESSAGES` as ported, not under "Dropped with no replacement". It SHALL state that 1.0 parses the value strictly, so only `true`/`1`/`yes` (case-insensitive, trimmed) enable it and any other value — including empty, `off` or `disabled` — leaves it off, whereas legacy enabled it for any non-empty value. `apps/chat-api/README.md` and `apps/chat-api/.env.template` SHALL document the variable with default `false`.

#### Scenario: migration guide entry

- **WHEN** an operator reads the migration guide's dropped table
- **THEN** `ALLOW_VISUALIZER_SEND_MESSAGES` is absent from it
- **AND** the visualizer section names it as supported, with the parsing difference noted
