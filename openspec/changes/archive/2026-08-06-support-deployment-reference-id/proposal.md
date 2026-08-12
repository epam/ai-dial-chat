## Why

DIAL Core sometimes addresses the same deployment by a `reference` value instead of (or in addition to) its `id`. Today `DeploymentItemDto` (returned by `GET /api/v1/deployments`) drops this field even though the raw Core payload already carries it (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`), and the frontend's `Conversation.model` shape (`libs/chat-shared/src/models/chat.ts:280`, `model: { id: string }`) has no place to carry it either. As a result, when a conversation's model path or a message's `model.id` actually holds a Core `reference` rather than a deployment `id`, every place that matches that value against the fetched deployments list (`CatalogView`, `CustomAppEditor`, `AppsEditor`, `ConversationView`, `useAudioTranscription`) fails to find the deployment — breaking icon/name resolution and "deployment not found" fallbacks.

## What Changes

- Propagate DIAL Core's `reference` field through the deployments pipeline: `RawDeploymentDto` (already has it) → `DeploymentItemDto` → generated `chat-api-client` model → frontend deployment list.
- Extend the frontend `Conversation`/message `model` shape to optionally carry `reference`, alongside the existing `id`.
- Update deployment-lookup call sites that match `model.id`/`deployment.id` against the fetched deployments list so they also match on `reference` when `id` doesn't resolve, instead of failing lookup.
- Regenerate the OpenAPI spec and `chat-api-client` so the new field is part of the documented contract.

## Capabilities

### New Capabilities

- `deployment-reference-resolution`: frontend behavior for resolving a deployment from a conversation/message model value that may be either a deployment `id` or a Core `reference`, across all lookup call sites.

### Modified Capabilities

- `deployments-api`: `DeploymentItemDto` gains an optional `reference` field, sourced from DIAL Core's `reference` on the raw deployment payload.

## Impact

- Backend: `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, `apps/chat-api/src/deployments/deployments.service.ts` (`mapToDeploymentItem`), OpenAPI spec + `npm run openapi` regeneration, `libs/chat-api-client` generated types.
- Frontend: `libs/chat-shared/src/models/chat.ts` (`Conversation.model` type), `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx`, `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`, `apps/chat/src/components/ConversationView/ConversationView.tsx`, `apps/chat/src/hooks/conversation/useAudioTranscription.ts`.
- No breaking change: `reference` is additive/optional; existing `id`-only clients are unaffected.
