## Why

Diagnosing a real conversation whose `model.id` holds a DIAL Core `reference` instead of an `id` (`support-deployment-reference-id`, `fix-conversation-panel-icon-reference-lookup`) surfaced three more places with the same class of bug — a raw, possibly-`reference` value flowing into a spot that requires the real deployment `id` — plus one unrelated but related-in-symptom bug in conversation-path parsing that was found and fixed in the same debugging session. None of this was captured in specs yet.

## What Changes

- `DeploymentsContext.tsx`'s `getDeploymentConfiguration` fetch, and the two `<UsageLimitsControl>` call sites (`ConversationView.tsx`, `NewConversationComposer.tsx`) now resolve the real deployment `id` via `findDeploymentByIdOrReference` before calling `GET /api/v1/deployments/{id}/configuration` and `GET /api/v1/deployments/{id}/limits` — previously these sent the raw, possibly-`reference` value, which DIAL Core rejects with 404.
- `ConversationView.tsx` and `NewConversationComposer.tsx` now pass the resolved deployment's real `id` (not the raw conversation/model id) as `selectedDeploymentId` into `ConversationInput`, so the model-selector chip's icon (resolved inside `libs/conversation-input`'s `useModelSelector` via a plain `id`-only match) no longer falls back to its unknown-icon placeholder for `reference`-addressed deployments.
- `getModelIdFromConversationId` now strips the reserved `.scheduler/{scheduleId}` path prefix DIAL Scheduler writes conversations under, before extracting the deployment id — previously this reserved prefix was mistaken for deployment-id path segments.
- `ConversationPanelView.tsx`'s icon-tooltip fallback (when no deployment matches the extracted id) now shows only the last path segment, decoded, instead of the full raw percent-encoded path — because real user-created conversation folders and a multi-segment deployment id are visually indistinguishable in the resource path, so showing the full guessed path as a tooltip can be misleading/ugly when the guess includes folder segments.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deployment-reference-resolution`: extend "Deployment lookup matches by id or reference" to cover the deployment configuration/limits fetch call sites and the `ConversationInput` model-selector chip icon, not just deployment-list lookups.
- `conversation-history-panel`: `getModelIdFromConversationId` gains `.scheduler/{scheduleId}` prefix stripping; the icon-tooltip fallback behavior changes from "full extracted path" to "last path segment only".

## Impact

- Frontend: `apps/chat/src/context/DeploymentsContext.tsx`, `apps/chat/src/components/ConversationView/ConversationView.tsx`, `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`, `apps/chat/src/utils/get-model-id-from-conversation-id.ts`, `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`.
- No backend or API contract changes — this change is purely about the frontend correctly resolving/displaying deployment identity it already receives.
- No breaking change: additive resolution logic and a friendlier fallback string; no consumer-visible type changes.
