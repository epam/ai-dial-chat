## Why

`apps/chat-api/src/share/share.service.ts` (836 lines) is the largest remaining backend service without a split precedent — every other domain of comparable size (`FilesService`, `ConversationService`, `DeploymentsService`/`ToolsetsService`, `PromptService`) has already been decomposed into a thin facade plus focused sub-services. `ShareService` internally groups into two independent operation clusters — invitation issuance/acceptance (`createShareLink`, `acceptInvitation`) and post-grant share management (`discardShared`, `getRecipientsCount`, `revokeShared`) — the same shape the prior splits addressed. Its spec file (1544 lines) is the largest test monolith tied to any single backend service, reinforcing that the class mixes concerns.

## What Changes

- Split `ShareService` into `ShareInvitationService` (`createShareLink`, `acceptInvitation`, the private `resolveSharedItemSummary`/`buildInvitationUrl`/`getRelatedResourceUrls` helpers) and `ShareManagementService` (`discardShared`, `getRecipientsCount`, `revokeShared`, the private `isSharedWithCaller` helper), plus a thin `ShareService` facade that `ShareController` keeps injecting unchanged.
- Extract the module-level pure helpers (`resolveResourceKind`, `toShareResourceUrl`, `getInvitationRoutePath`, `isAlreadyOwnedError`, `collectConversationResourceUrls`/`collectAttachmentResourceUrls` and their supporting types/constants) into `apps/chat-api/src/share/utils/share-resource.util.ts`, shared by both new sub-services.
- Split `share.service.spec.ts` (1544 lines) into `share-invitation.service.spec.ts`, `share-management.service.spec.ts`, a `utils/share-resource.util.spec.ts` for the extracted pure helpers, and a slim `share.service.spec.ts` facade spec for delegation assertions.
- Update `share.module.ts` to register `ShareInvitationService` and `ShareManagementService` as providers alongside the facade.
- **Not BREAKING**: REST contracts, request/response shapes, status codes, and structured logging are unchanged — this is an internal refactor only. No frontend changes, no OpenAPI regeneration.

## Capabilities

### New Capabilities

- `share-service-decomposition`: ownership map of which service owns which share responsibility (invitation issuance/acceptance vs. discard/recipients-count/revoke) and the equivalence contract guaranteeing behavior is preserved across the split.

### Modified Capabilities

- None. This is an implementation-detail refactor; existing capability specs referencing `ShareService` by method name (`conversation-share`, `conversation-unshare-api`, `conversation-unshare-flow`, `conversation-revoke-share-flow`, `catalog-unshare`, `catalog-shared-with-me`, `prompt-share-link`, `prompts-share-api`, `share-invitation-permissions`, `share-revoke-access`) keep their current scenario-level requirements unchanged. Any implementation-detail bullets in those specs naming the monolithic service will be updated for accuracy as part of `tasks.md`, without changing behavior.

## Impact

- **Code**: `apps/chat-api/src/share/` — new `invitation/`, `management/`, and `utils/` sub-folders; `share.service.ts` shrinks to a facade; `share.module.ts` registers the new providers.
- **Tests**: `tests/share.service.spec.ts` (1544 lines) is split into per-sub-service spec files under matching `tests/` sub-folders, a `utils/share-resource.util.spec.ts`, plus a slim facade spec for delegation checks.
- **Dependents**: `ShareController` keeps calling the `ShareService` facade unchanged; no signature changes.
- **No impact**: frontend (`apps/chat`), OpenAPI spec/generated client, REST contracts, external callers.
