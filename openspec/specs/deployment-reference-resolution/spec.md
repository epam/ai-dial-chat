### Requirement: Conversation and message model.id may hold a Core reference value

`Conversation.model` in `libs/chat-shared/src/models/chat.ts` SHALL remain `{ id: string }` — unchanged by this capability. The ambiguity this capability resolves lives inside that existing `id` value: DIAL Core may address a deployment by `reference` in places that store a deployment id (a conversation's `model.id`, a message's `model.id`), so the string held in `id` is not guaranteed to equal any deployment's `id` — it may instead equal that deployment's `reference`. No new field is introduced to track this; `findDeploymentByIdOrReference` (below) is the mechanism that resolves it from the single existing `id` value.

#### Scenario: Conversation model.id equal to a deployment id resolves normally

- **WHEN** a conversation has `model: { id: 'gpt-4o' }` and a fetched deployment has `id: 'gpt-4o'`
- **THEN** the conversation's model resolves to that deployment

#### Scenario: Conversation model.id equal to a deployment reference still resolves

- **WHEN** a conversation has `model: { id: 'gemini-3.1-flash-lite' }`, no fetched deployment has `id: 'gemini-3.1-flash-lite'`, and one fetched deployment has `reference: 'gemini-3.1-flash-lite'`
- **THEN** the conversation's model resolves to that deployment

### Requirement: Deployment lookup matches by id or reference

`apps/chat/src/utils/deployment-id.ts` SHALL export `findDeploymentByIdOrReference(deployments: DeploymentItemDto[], idOrReference: string | null | undefined): DeploymentItemDto | undefined`. It SHALL return the first deployment whose `id` equals `idOrReference`; if none matches, it SHALL return the first deployment whose `reference` equals `idOrReference`; if neither matches (or `idOrReference` is null/undefined/empty), it SHALL return `undefined`.

Every existing frontend call site that previously resolved a deployment via `deployments.find((d) => d.id === someId)`, or via a `Map<id, T>` lookup keyed only by `id`, against a value that may originate from a conversation's `model.id`, a message's `model.id`, or a URL/query-param deployment id SHALL be updated to call `findDeploymentByIdOrReference` instead:
- `apps/chat/src/components/CatalogView/CatalogView.tsx`
- `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx`
- `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`
- `apps/chat/src/components/ConversationView/ConversationView.tsx`
- `apps/chat/src/hooks/conversation/useAudioTranscription.ts`
- `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx`
- `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx`
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`
- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`

Memoized lookups (`useMemo`) that call `findDeploymentByIdOrReference` SHALL keep `deployments`/`items` and the id/reference value in their dependency array, unchanged from the prior `.find()`-based or `Map`-based memoization.

#### Scenario: Lookup resolves by id

- **WHEN** `findDeploymentByIdOrReference(deployments, 'gpt-4o')` is called and a deployment with `id: 'gpt-4o'` exists in `deployments`
- **THEN** that deployment is returned

#### Scenario: Lookup falls back to reference when id does not match

- **WHEN** `findDeploymentByIdOrReference(deployments, 'ref-gemini-3-1-flash-lite')` is called, no deployment has `id: 'ref-gemini-3-1-flash-lite'`, and one deployment has `reference: 'ref-gemini-3-1-flash-lite'`
- **THEN** that deployment is returned

#### Scenario: Lookup returns undefined when neither id nor reference matches

- **WHEN** `findDeploymentByIdOrReference(deployments, 'unknown-value')` is called and no deployment has a matching `id` or `reference`
- **THEN** `undefined` is returned

#### Scenario: id match takes precedence over a reference match on a different item

- **WHEN** `deployments` contains one item with `id: 'x'` and a different item with `reference: 'x'`
- **THEN** `findDeploymentByIdOrReference(deployments, 'x')` returns the item whose `id` is `'x'`

#### Scenario: Null or empty input resolves to undefined

- **WHEN** `findDeploymentByIdOrReference(deployments, null)`, `findDeploymentByIdOrReference(deployments, undefined)`, or `findDeploymentByIdOrReference(deployments, '')` is called
- **THEN** `undefined` is returned without matching any deployment

#### Scenario: ConversationView resolves the active deployment by reference

- **WHEN** `ConversationView` computes `activeDeploymentId` from `fixedModel?.id ?? selectedItemId` and that value equals a fetched deployment's `reference` rather than its `id`
- **THEN** `selectedDeployment` resolves to that deployment via `findDeploymentByIdOrReference`, and its icon/name/features render as if resolved by `id`

#### Scenario: Conversation history panel resolves a row's icon by reference

- **WHEN** the conversation history panel renders a row whose underlying conversation's `model.id` (read via `getModelIdFromConversationId`) equals a fetched deployment's `reference` rather than its `id`
- **THEN** that row's `iconUrl` and `iconTooltip` resolve to that deployment's `iconUrl`/`displayName` via `findDeploymentByIdOrReference`, instead of rendering with no icon

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
