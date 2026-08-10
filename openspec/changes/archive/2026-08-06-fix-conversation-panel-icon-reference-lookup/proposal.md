## Why

`deployment-reference-resolution` fixed deployment icon/lookup resolution in `ConversationView` for conversations whose `model.id` actually holds a DIAL Core `reference` rather than the deployment's `id`. The conversation history panel (`ConversationPanelView.tsx`) has the identical bug: it pre-builds `Map<id, iconUrl>` / `Map<id, displayName>` lookups keyed only by deployment `id`, so a conversation list row whose model id is actually a `reference` silently gets no icon. Confirmed against a live DIAL Core response: an application returned `id: "applications/public/[Full Example] QA 2.0  all sections tests__0.0.3"` and `reference: "4142817d-5edb-48ec-995f-839fab5beed3"`; a conversation stored under the latter value never matched the panel's id-only `Map`.

## What Changes

- Replace the two id-only `Map` lookups in `ConversationPanelView.tsx` (`deploymentIconByModelId`, `deploymentNameByModelId`) with direct calls to the existing `findDeploymentByIdOrReference` helper (`apps/chat/src/utils/deployment-id.ts`), so each conversation row resolves its icon/tooltip by `id` first, falling back to `reference`, matching the behavior already fixed in `ConversationView`.
- Remove the temporary debug logging added to `DeploymentsService.listDeployments` (`apps/chat-api/src/deployments/deployments.service.ts`) used to confirm this diagnosis against live Core data — it was never meant to ship.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deployment-reference-resolution`: extend the "Deployment lookup matches by id or reference" requirement to cover the conversation history panel's icon/tooltip resolution, not just the main chat view.

## Impact

- Frontend: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`.
- Backend: `apps/chat-api/src/deployments/deployments.service.ts` (debug logging removal only — no behavior change).
- No breaking change: this only fixes a silent lookup miss: existing correct `id`-based matches are unaffected.
