## Why

Attachment upload, audio transcription, model selector labels, and chat settings form config are each duplicated across `ConversationRoute.tsx`, `Conversation.tsx`, and `ConversationView.tsx` (~300 lines of near-identical wiring). Separately, `ThemesModule` is the only backend domain still registered directly in `AppModule` instead of following the module-per-domain pattern used everywhere else (`DeploymentsModule`, `ModelsModule`, etc.). None of this duplication is externally visible, but it increases the risk of the three conversation-input surfaces drifting in behavior and makes the themes domain inconsistent with the rest of `apps/chat-api`. Consolidating now, while the logic is still simple, is lower risk than doing it after Phase 3 (`ConversationView` decomposition) adds more surface area.

## What Changes

- Add four new hooks under `apps/chat/src/hooks/conversation/`: `useAttachmentUpload`, `useAudioTranscription`, `useModelSelectorLabels`, `useChatSettingsFormConfig`, each encapsulating logic currently duplicated inline in `ConversationRoute.tsx`, `Conversation.tsx`, and `ConversationView.tsx`.
- Migrate `ConversationRoute.tsx`, `Conversation.tsx`, `ConversationView.tsx`, and `useConversationHandlers.ts` to consume the new hooks instead of their inline/duplicated implementations.
- Add `apps/chat-api/src/themes/themes.module.ts` and register it in `AppModule`, removing the direct `ThemeController` / `ThemeService` registration and imports from `app.module.ts`.
- No new or removed REST endpoints, no OpenAPI regeneration, no observable UI or API behavior changes — this is a pure internal consolidation.

## Capabilities

### New Capabilities

- `conversation-input-shared-hooks`: contract for the four new shared hooks (`useAttachmentUpload`, `useAudioTranscription`, `useModelSelectorLabels`, `useChatSettingsFormConfig`) under `apps/chat/src/hooks/conversation/`. These are internal implementation-unit contracts (inputs/outputs/behavior of the hooks themselves), not new user-facing product capabilities.
- `themes-module`: contract for the new `ThemesModule` wrapper around the existing `ThemeController`/`ThemeService` in `apps/chat-api`.

### Modified Capabilities

None — no spec-level requirement changes. Existing user-facing behavior for attachment upload (`attachment-send-flow`, `attachment-network-error-notification`), voice transcription (`voice-transcription`), chat settings (`chat-settings`), and the backend chat-api app (`chat-api-backend`) must remain observably identical; this change is verified by existing specs/tests for those capabilities continuing to pass unchanged.

## Impact

- **Affected code (frontend):** `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, `apps/chat/src/pages/Conversation/Conversation.tsx`, `apps/chat/src/components/ConversationView/ConversationView.tsx`, `apps/chat/src/hooks/conversation/useConversationHandlers.ts`, new files under `apps/chat/src/hooks/conversation/`.
- **Affected code (backend):** `apps/chat-api/src/app/app.module.ts`, new `apps/chat-api/src/themes/themes.module.ts`.
- **Tests:** new co-located specs for each extracted hook; existing `useConversationHandlers.spec.ts`, `theme.controller.spec.ts`, `theme.service.spec.ts` must continue to pass.
- **No impact:** public HTTP API surface, OpenAPI spec/generated client, lib packages (`conversation-input`, etc.), conversation send/edit/regenerate logic.
