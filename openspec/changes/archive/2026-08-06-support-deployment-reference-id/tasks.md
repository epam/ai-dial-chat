## 1. Backend: propagate reference on DeploymentItemDto

- [x] 1.1 Add `reference?: string` (with `@ApiPropertyOptional`) to `DeploymentItemDto` in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`.
- [x] 1.2 In `mapToDeploymentItem` (`apps/chat-api/src/deployments/deployments.service.ts`), set `reference: raw.reference` on the returned object.
- [x] 1.3 Add/extend unit tests in `apps/chat-api/src/deployments/deployments.service.spec.ts` (or equivalent) covering: reference mapped when present, reference omitted when absent, existing `isFeatured` fallback behavior (`raw.id || raw.reference`) unaffected.
- [x] 1.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 2. OpenAPI contract regeneration

- [x] 2.1 Run `npm run openapi` to regenerate the Swagger spec and `libs/chat-api-client` from the updated `DeploymentItemDto`.
- [x] 2.2 Run `npm run openapi:check` to confirm the generated client matches the spec.
- [x] 2.3 Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) to confirm the generated `DeploymentItemDto` model now includes `reference?: string`.

## 3. Frontend: confirm Conversation.model needs no schema change

- [x] 3.1 Confirmed `Conversation.model` in `libs/chat-shared/src/models/chat.ts` stays `{ id: string }` — the ambiguity lives inside the existing `id` value itself (it may already hold a Core `reference`), not a second field. No widening needed; see corrected `design.md` decision 3.
- [x] 3.2 Ran `npm exec nx typecheck @epam/ai-dial-chat-shared` to confirm no type errors (no-op change).

## 4. Frontend: shared id/reference lookup helper

- [x] 4.1 Add `findDeploymentByIdOrReference(deployments, idOrReference)` to `apps/chat/src/utils/deployment-id.ts`, matching by `id` first, then `reference`, returning `undefined` for no match or a null/undefined/empty input.
- [x] 4.2 Add unit tests in `apps/chat/src/utils/tests/deployment-id.spec.ts` covering: id match, reference fallback match, no match, id-match precedence over a reference match on a different item, null/undefined/empty input.

## 5. Frontend: migrate lookup call sites

- [x] 5.1 Update `apps/chat/src/components/CatalogView/CatalogView.tsx` to resolve the deployment via `findDeploymentByIdOrReference` instead of `deployments.find((d) => d.id === item.id)`.
- [x] 5.2 Update `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx` to resolve the deployment via `findDeploymentByIdOrReference` instead of `deployments.find((d) => d.id === customAppId)`.
- [x] 5.3 Update `apps/chat/src/pages/AppsEditor/AppsEditor.tsx` to resolve `existingDeployment` via `findDeploymentByIdOrReference` instead of `deployments.find((d) => d.id === existingAppId)`.
- [x] 5.4 Update `apps/chat/src/components/ConversationView/ConversationView.tsx` to resolve `selectedDeployment` via `findDeploymentByIdOrReference` instead of `items.find((item) => item.id === activeDeploymentId)`.
- [x] 5.5 Update `apps/chat/src/hooks/conversation/useAudioTranscription.ts` to resolve `selectedItem` via `findDeploymentByIdOrReference` instead of `items.find((item) => item.id === selectedDeploymentId)`.
- [x] 5.6 Grepped `apps/chat/src` for other `.find((.*) => .*\.id ===` patterns against a deployments/items list. Found and migrated 3 more missed by the original task list: `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx` (`selectedDeployment`), `apps/chat/src/pages/AppsEditor/AppPreviewChat.tsx` (`appDeployment`), `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` (`selectedDeployment`). Confirmed the remaining `items.find` hits in `ConversationPanelView.tsx` and `dial-file-manager-mapping.util.ts` operate on conversation/file lists, not deployments — left unchanged.

## 6. Verification

- [x] 6.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` and `npm exec nx affected --target=test --base=origin/development-1.0`.
- [x] 6.2 Run `npm exec nx affected --target=build --base=origin/development-1.0` to confirm the full chain (chat-api, chat-api-client, chat-shared, chat) builds.
- [ ] 6.3 NOT DONE in this session: manually verify in the running app (`npm run start:all`) that a conversation whose stored `model.id` matches a deployment's `reference` rather than its `id` resolves correctly. Requires a live DIAL Core backend/session not available in this environment — covered instead by unit tests (backend mapping tests in `deployments.service.spec.ts`, frontend `findDeploymentByIdOrReference` tests) and the full `nx affected` test/build run, which passed.
