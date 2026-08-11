## 1. Frontend: fix conversation panel icon lookup

- [x] 1.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, remove `deploymentIconByModelId`/`deploymentNameByModelId` `Map`s and resolve each row's deployment via `findDeploymentByIdOrReference(deployments, modelId)` instead.
- [x] 1.2 Update the `conversations` `useMemo` dependency array to drop the removed maps and depend on `deployments` directly.
- [x] 1.3 Import `findDeploymentByIdOrReference` from `apps/chat/src/utils/deployment-id.ts`.

## 2. Backend: remove temporary debug logging

- [x] 2.1 Remove the temporary debug logging block added to `DeploymentsService.listDeployments` (`apps/chat-api/src/deployments/deployments.service.ts`) used to diagnose this issue against live DIAL Core data.

## 3. Verification

- [x] 3.1 Run `npm exec nx typecheck @epam/chat`.
- [x] 3.2 Run `npm exec nx lint @epam/chat` and `npm exec nx lint chat-api`.
- [x] 3.3 Run `npm exec nx test @epam/chat -- src/components/ConversationPanel` and `npm exec nx test chat-api -- deployments.service.spec`.
