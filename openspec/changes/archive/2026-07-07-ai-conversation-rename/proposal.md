## Why

Today an LLM-generated conversation title is produced exactly once, as a fire-and-forget side effect of the first save after the first assistant reply, and is then permanently locked by the `llmNamingDone` flag. Users have no way to ask for a fresh AI-generated title later. As a conversation grows, the topic drifts away from the first exchange the original name was based on, leaving a stale or misleading title with no way to regenerate it. Users need an explicit, on-demand "rename with AI" action that reflects the current conversation.

## What Changes

- Add a new synchronous backend endpoint `POST /api/v1/conversations/generate-title` that generates an LLM-based title for an existing conversation on demand. It accepts the conversation path as a query parameter, takes no request body, uses the operator-configured `UTILITY_MODEL`, and returns `{ name: string }` after the LLM responds.
- Unlike the existing auto-naming flow, on-demand generation is **not** gated by `llmNamingDone` and does **not** persist the name or set any flag. It only computes and returns a suggested name; persistence still happens through the existing rename flow when the user confirms.
- Generation uses the full current conversation context (not just the first user/assistant exchange) so the suggested title reflects the conversation as it stands now.
- Reuse the existing conversation-naming system prompt, name sanitisation (`prepareEntityName`), `UTILITY_NAMING_TIMEOUT_MS`, and DIAL Core client path from `ConversationNamingService`.
- Update the rename modal (`RenameConversationPopup`) to add an "AI rename" icon button (pencil-style) at the end of the title input row. Clicking it calls the new endpoint, shows a spinner while in-flight, and on success populates the input with the returned name. The user can still edit the suggested name before confirming, and confirming saves through the existing rename endpoint.
- Add a frontend server-api wrapper method and expose the endpoint through the generated `@epam/chat-api-client`.
- The AI rename control is always available in the rename modal (no feature-flag gating for now — this can be revisited later if the operator needs to disable it).
- Add i18n strings (both `en.json` entries and `translation-keys.ts` enum members) for the button label/tooltip, in-flight state, and error state.

## Capabilities

### New Capabilities
- `ai-conversation-rename`: On-demand, user-triggered regeneration of a conversation title via an LLM, exposed as a synchronous endpoint and an "AI rename" control in the rename modal. Covers the endpoint contract (request/response, validation, rate limiting, error handling), the frontend rename-modal interaction, and the reuse of the existing naming prompt and sanitisation.

### Modified Capabilities
<!-- No existing OpenSpec spec captures the current auto-naming behavior as requirements; this change adds a new, separate capability rather than modifying an existing spec. -->

## Impact

- **Backend (`apps/chat-api`)**: New endpoint on `conversation.controller.ts`; new method on `conversation-naming.service.ts` (or `conversation.service.ts`) that builds the prompt from the full conversation and returns a name without persisting; new request/response DTOs under `conversations/dto/`; `@Throttle` config for the endpoint; OpenAPI annotations. Regenerate `@epam/chat-api-client`.
- **Frontend (`apps/chat`)**: `RenameConversationPopup.tsx` gains the AI rename button, in-flight/error state, and a callback prop; `ConversationPanelView.tsx` wires the new action; `server-api/conversations.api.ts` gains `generateConversationTitle(path)`; new i18n keys in `en.json` + `translation-keys.ts`.
- **Tests**: New/updated specs for the endpoint (happy path, validation, rate limit, LLM failure/timeout) and for the modal (spinner, populate-on-success, error display).
- **Dependencies**: No new packages; reuses `@epam/ai-dial-typescript-sdk`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react`.
