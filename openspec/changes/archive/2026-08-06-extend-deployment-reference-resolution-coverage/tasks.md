## 1. Resolve deployment id before REST calls

- [x] 1.1 `DeploymentsContext.tsx`'s configuration-loading effect resolves `selectedItemId` via `findDeploymentByIdOrReference(items, selectedItemId)?.id` before calling `getDeploymentConfiguration`.
- [x] 1.2 `ConversationView.tsx`'s `<UsageLimitsControl>` receives `selectedDeployment?.id ?? activeDeploymentId` as `deploymentId`.
- [x] 1.3 `NewConversationComposer.tsx`'s `<UsageLimitsControl>` receives `selectedDeployment?.id ?? selectedDeploymentId` as `deploymentId`.

## 2. Resolve deployment id before it reaches libs/conversation-input

- [x] 2.1 `ConversationView.tsx` passes `selectedDeployment?.id ?? activeDeploymentId` as `<ConversationInput selectedDeploymentId>`.
- [x] 2.2 `NewConversationComposer.tsx` passes `selectedDeployment?.id ?? selectedDeploymentId` as `<ConversationInput selectedDeploymentId>`.

## 3. Fix .scheduler prefix in conversation-id deployment extraction

- [x] 3.1 `getModelIdFromConversationId` detects and skips the reserved `.scheduler/{scheduleId}` two-segment prefix before extracting the deployment id.
- [x] 3.2 Added unit tests covering single- and multi-segment deployment ids under a `.scheduler` prefix.

## 4. Safer icon-tooltip fallback in the conversation history panel

- [x] 4.1 `ConversationPanelView.tsx`'s fallback tooltip (when no deployment matches) shows only the last `/`-segment of the extracted id, percent-decoded, instead of the full raw path.

## 5. Verification

- [x] 5.1 `npm exec nx typecheck @epam/chat` — clean.
- [x] 5.2 `npm exec nx lint @epam/chat` — clean (only pre-existing warnings).
- [x] 5.3 `npm exec nx test @epam/chat -- src/context/tests/DeploymentsContext.spec.tsx src/components/ConversationView src/components/NewConversationComposer src/components/ConversationPanel src/utils/tests/get-model-id-from-conversation-id.spec.ts src/pages/ConversationRoute` — all passing.
- [x] 5.4 `npm exec nx build @epam/chat` — rebuilt (dist served statically by `chat-api`, so a rebuild was required for the fixes to take effect in the running app).
