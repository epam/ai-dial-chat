## 1. Lib — extend `ConversationHistoryItem` model

- [x] 1.1 Add `/** When `true`, a skeleton placeholder is shown instead of the deployment icon. */` JSDoc and `isIconLoading?: boolean` field to the `ConversationHistoryItem` interface in `libs/conversation-panel/src/models/panel-props.ts`

## 2. Lib — update `ConversationRow` skeleton rendering

- [x] 2.1 In `libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx`, replace the unconditional `DeploymentIcon` avatar with a branch: when `item.isIconLoading` is `true`, render `<DialSkeleton variant={DialSkeletonVariant.Circular} width={DIAL_ICON_SIZE.LG} height={DIAL_ICON_SIZE.LG} aria-hidden />` from `@epam/ai-dial-ui-kit`; otherwise render `DeploymentIcon` as before

## 3. Lib — tests for `ConversationRow` skeleton

- [x] 3.1 In `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx` (or a new `ConversationRow/tests/ConversationRow.spec.tsx`), add test cases covering: skeleton rendered when `isIconLoading: true`, skeleton has `aria-hidden="true"`, `DeploymentIcon` rendered when `isIconLoading: false` with `iconUrl`, `DeploymentIcon` rendered when `isIconLoading` is omitted

## 4. App — wire `isDeploymentsLoading` into `ConversationPanelView`

- [x] 4.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, destructure `isLoading: isDeploymentsLoading` from `useDeployments()` alongside the existing `items: deployments`
- [x] 4.2 Add `isIconLoading: isDeploymentsLoading` to each mapped `ConversationHistoryItem` inside the `useMemo`
- [x] 4.3 Add `isDeploymentsLoading` to the `useMemo` dependency array for the `conversations` memoisation

## 5. Verification

- [x] 5.1 Run `npm exec nx lint conversation-panel` and fix any issues
- [x] 5.2 Run `npm exec nx test conversation-panel` — all tests pass
- [x] 5.3 Run `npm exec nx lint chat` and fix any issues
- [x] 5.4 Run `npm exec nx typecheck chat` — no TypeScript errors
