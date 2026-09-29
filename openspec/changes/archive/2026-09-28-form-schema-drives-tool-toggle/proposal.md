## Why

Applications such as StatGPT expose a boolean deployment configuration field (e.g. `deep_research`) that triggers a costly one-shot run. Today the tools-menu toggle for that field is purely user-owned: after the app delivers its report, the toggle stays on and the very next follow-up question silently re-triggers a new expensive run (issue #8968; the "write back stored configuration" alternative was rejected in #8909). The app needs a way to set the toggle state per assistant message, reusing the `custom_content.form_schema` it already streams, while the user keeps full control to re-arm it.

## Problem

- `custom_content.form_schema` is accumulated per assistant message (`libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts:164`, persisted by `apps/chat-api/src/conversations/utils/apply-chunk.server.ts:86`) but is only read by `getStartersFromSchema` (`libs/chat-hooks/src/conversation/starter-option.ts:22`), which recognizes solely the `starter` / `button` keys. A `deep_research` property in it is ignored.
- The toggle state lives in `useToolsMenu` (`libs/chat-hooks/src/useToolsMenu/useToolsMenu.ts:83`) and is restored on conversation load only from the last **user** message's `configuration_value` (`apps/chat/src/pages/Conversation/Conversation.tsx:421`). Nothing links an assistant message's `form_schema` to it.

## Solution

When an assistant message's `custom_content.form_schema.properties` contains a key that matches a tool id (a boolean property of the selected deployment's configuration schema) and carries a boolean value, that value becomes the toggle's current state:

- Value source: the property's `default` (priority); otherwise the `const` of a single-option `oneOf`. Anything else is ignored.
- Live: while and after an assistant message streams, each new value it carries is applied to the toggle once.
- On load: the toggle is restored from the last user message's `configuration_value`, overlaid by the values from assistant messages that follow it.
- No buttons/widgets are rendered for such properties; the user re-arms the tool through the existing chips / Tools menu.
- The next outgoing request already sends the full `toolConfigurationValue` as `configuration_value`, which the backend forwards as `custom_fields.configuration` — no backend change needed.

## What Changes

- New pure utils in `libs/chat-hooks` (next to `getLastUserMessageToolConfiguration` in `libs/chat-hooks/src/conversation/message-utils.ts:62`): extract tool values from a `form_schema`, and compute the latest effective tool configuration from a message list.
- `apps/chat/src/pages/Conversation/Conversation.tsx`: the load-time restore uses the new "latest" helper; a new effect applies values from the last assistant message's `form_schema` via the existing `restoreToolConfiguration`, guarded so the same value is applied only once.
- `libs/chat-hooks/README.md`: document the new exported utils.
- Delta to `chat-input-tools-menu` spec.

## Non-goals

- No rendering of per-message toggle/button widgets for these properties (explicitly declined).
- No backend (`apps/chat-api`), OpenAPI or generated-client changes; no "app writes stored configuration" path (#8909).
- No change to the new-chat screen (`ConversationRoute`) or app-editor preview (`AppPreviewChat`) — neither streams assistant messages into an existing conversation's toolbar.
- No non-boolean configuration fields.

## Alternatives considered

- Render the property as a buttons widget whose click sets the toggle — rejected by the requester (buttons not needed) and conflicts with the existing buttons semantics (click = submit a turn with `form_value`).
- Backend writes the value into the next request's configuration — equivalent to the rejected #8909 and hides state from the user.
- Picked: frontend-only mapping into the existing `useToolsMenu` state — smallest change, state stays visible and user-overridable.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `chat-input-tools-menu`: tool toggle state can additionally be set by an assistant message's `custom_content.form_schema`, both live and on conversation load.

## Impact

- Code: `libs/chat-hooks/src/conversation/message-utils.ts` (+ tests, `src/index.ts` export, README), `apps/chat/src/pages/Conversation/Conversation.tsx` (+ tests).
- Shared lib touched: `libs/chat-hooks` — only pure functions over `Message` / `DeploymentConfigurationSchema` types from `@epam/ai-dial-chat-shared`; the app supplies the messages and calls `restoreToolConfiguration`. No host knowledge enters the lib.
- State ownership: unchanged — `useToolsMenu` instance in the conversation page; no new context.
- i18n: no new user-visible strings.
- Contract with StatGPT (epam/statgpt-backend#683): the app emits `form_schema.properties.<tool_id>` with a boolean `default` (or single-option `oneOf` with boolean `const`).
- Backward compatibility: additive. Apps that do not emit matching properties see no change. Rollback = revert the commit.

## Acceptance criteria

- An assistant message streaming `form_schema.properties.deep_research.default = true` turns the Deep research chip on; a later chunk/message with `false` turns it off; the next user message sends `configuration_value: { "deep_research": false }`.
- Reloading such a conversation shows the toggle state from the last assistant `form_schema`, not the preceding user message.
- The user can toggle the chip back on after the app turned it off, and that choice is not overwritten by re-renders or reloads of the same message.
- No buttons render for the `deep_research` property; `starter`/`button` rendering is unchanged.
- Unit tests cover the utils and the page behaviour; `npm run validate:docs` passes.
