## ADDED Requirements

### Requirement: Resolved deployment id, not the raw possibly-reference value, feeds REST calls and downstream lib props

Once a deployment is resolved via `findDeploymentByIdOrReference`, every downstream consumer that needs a deployment id — for a REST call or for a prop passed into a host-agnostic lib that does its own plain `id` match — SHALL use the resolved deployment's real `id` field, never the raw conversation/model value that may itself be a `reference`.

Specifically:
- `apps/chat/src/context/DeploymentsContext.tsx`'s configuration-loading effect SHALL resolve `selectedItemId` via `findDeploymentByIdOrReference(items, selectedItemId)?.id` (falling back to `selectedItemId` itself only when no match is found) before calling `getDeploymentConfiguration`, which hits `GET /api/v1/deployments/{id}/configuration`.
- `apps/chat/src/components/ConversationView/ConversationView.tsx`'s `<UsageLimitsControl>` SHALL receive `selectedDeployment?.id ?? activeDeploymentId` as `deploymentId` (not the raw `fixedModel.id`/`selectedItemId`), which feeds `GET /api/v1/deployments/{id}/limits`.
- `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`'s `<UsageLimitsControl>` SHALL receive `selectedDeployment?.id ?? selectedDeploymentId` as `deploymentId`, for the same reason.
- `ConversationView.tsx` and `NewConversationComposer.tsx` SHALL pass `selectedDeployment?.id ?? activeDeploymentId` / `selectedDeployment?.id ?? selectedDeploymentId` (respectively) as the `selectedDeploymentId` prop into `<ConversationInput>` (from `@epam/ai-dial-conversation-input`), so the model-selector chip's icon — resolved inside that lib's `useModelSelector` hook via a plain `id`-only `.find()` — matches correctly. `libs/conversation-input` itself is NOT changed; it keeps its simple `id`-only match, per library isolation (the lib must not gain DIAL Core `reference` awareness).

#### Scenario: Deployment configuration fetch uses the resolved id

- **WHEN** `selectedItemId` in `DeploymentsContext` equals a fetched deployment's `reference` rather than its `id`
- **THEN** `getDeploymentConfiguration` is called with that deployment's real `id`, not the raw `reference` value

#### Scenario: Usage limits fetch in ConversationView uses the resolved id

- **WHEN** `ConversationView`'s `activeDeploymentId` equals a fetched deployment's `reference` rather than its `id`
- **THEN** `<UsageLimitsControl deploymentId={...}>` receives that deployment's real `id`, and the resulting `GET /api/v1/deployments/{id}/limits` call uses the real `id`

#### Scenario: Usage limits fetch in NewConversationComposer uses the resolved id

- **WHEN** `NewConversationComposer`'s `selectedDeploymentId` equals a fetched deployment's `reference` rather than its `id`, and `selectedDeployment` is the corresponding resolved deployment
- **THEN** `<UsageLimitsControl deploymentId={...}>` receives `selectedDeployment.id`, not the raw `selectedDeploymentId`

#### Scenario: Model-selector chip icon resolves for a reference-addressed deployment

- **WHEN** a conversation's active deployment is addressed by `reference` and `ConversationView` has already resolved `selectedDeployment` via `findDeploymentByIdOrReference`
- **THEN** `<ConversationInput selectedDeploymentId={...}>` receives `selectedDeployment.id`, and the model-selector chip inside `libs/conversation-input` shows that deployment's real icon instead of falling back to its unknown-icon placeholder
