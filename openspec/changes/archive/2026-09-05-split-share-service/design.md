## Context

`ShareService` (`apps/chat-api/src/share/share.service.ts`, 836 lines) is a single `@Injectable()` that proxies five DIAL Core operations behind `ShareController`: `createShareLink`, `acceptInvitation`, `discardShared`, `getRecipientsCount`, `revokeShared`. It also carries ~200 lines of module-level pure helpers (resource-kind resolution, invitation-route mapping, conversation-attachment collection) that support those methods. `ShareController` is the only real consumer; a reference to `ShareService.acceptInvitation` in `skills-lookup.service.ts` is a comment, not an import, so there is no hidden coupling to worry about. This mirrors the state the already-archived `split-conversation-service` and `split-deployments-toolsets-services` changes found in their respective god-services: one class, several independent operation groups, no cross-group state.

## Goals / Non-Goals

**Goals:**

- Split `ShareService` into two focused sub-services along its natural operation boundary — invitation issuance/acceptance vs. post-grant share management — following the facade + sub-services shape already used for `DeploymentsService`/`ToolsetsService` (`deployments/details`, `deployments/listing`, `deployments/lookup` + thin `DeploymentsService` facade).
- Extract the module-level pure helpers into a shared `utils/` file so both sub-services can use them without duplication and without one owning code the other needs.
- Preserve `ShareController`'s existing dependency on `ShareService` as an unchanged facade — no controller changes, no DTO changes, no OpenAPI diff.
- Split the 1544-line `share.service.spec.ts` along the same boundary so each sub-service's tests sit next to the code they exercise.

**Non-Goals:**

- No behavior change to any of the five public operations — request shapes, response DTOs, status codes, error mapping, and logging messages are preserved verbatim.
- No change to `share.module.ts`'s imports (`DeploymentsModule`, `ToolsetsModule`, `SkillsModule`) beyond registering the two new providers.
- Not attempting to also fix the `MUST stay in sync` route-literal duplication between `share.service.ts` and `apps/chat/src/types/routes.ts` (`CATALOG_SHARE_INVITATION_ROUTE_PATH`/`CONVERSATION_SHARE_INVITATION_ROUTE_PATH`) — out of scope, tracked as a separate concern in the refactoring audit.

## Decisions

**Split boundary: `ShareInvitationService` vs. `ShareManagementService`, not per-method services.**
Unlike the deployments/toolsets split (listing/lookup/details/mutation/auth — five groups), `ShareService`'s five methods cluster into exactly two independent lifecycles that share no private state beyond the module-level helpers:

- **`ShareInvitationService`**: `createShareLink`, `acceptInvitation`, and their private helpers `resolveSharedItemSummary`, `buildInvitationUrl`, `getRelatedResourceUrls`. These all deal with *creating* or *consuming* an invitation. `acceptInvitation`'s post-accept cache invalidation (`deploymentsService.invalidateListCache` / `toolsetsService.invalidateListCache`) and `resolveSharedItemSummary`'s per-kind lookups (`skillsLookupService`, `toolsetsService.resolveToolsetItem`, `deploymentsService.resolveDeploymentItem`) stay together with the method that needs them.
- **`ShareManagementService`**: `discardShared`, `getRecipientsCount`, `revokeShared`, and the private `isSharedWithCaller` helper (used only by `discardShared`, but a management-lifecycle concern — checking current share state — so it belongs beside its caller, not in invitation). All three touch already-granted access (discard the caller's own, count recipients, revoke everyone's), and `discardShared`/`revokeShared` share the same cache-invalidation and not-found-mapping shape.

A finer split (e.g. one service per method) was considered and rejected: `createShareLink`/`acceptInvitation` and `discardShared`/`getRecipientsCount`/`revokeShared` are each too small individually to justify their own class and constructor-injection surface, and the deployments/toolsets precedent split by *responsibility group*, not by public-method count.

**Shared pure helpers move to `utils/share-resource.util.ts`, not a third service.**
`resolveResourceKind`, `toShareResourceUrl`, `getInvitationRoutePath`, `isAlreadyOwnedError`, and `collectConversationResourceUrls`/`collectAttachmentResourceUrls` (plus the `AnnotationWithAttachment`/`isRecord` support and the `RESOURCE_KIND_BY_PREFIX`/`FILE_RESOURCE_PREFIX`/`CONVERSATION_RESOURCE_PREFIX` constants) are pure functions with no DI dependencies. `toShareResourceUrl` is called from both sub-services (`createShareLink` in invitation; `discardShared`/`getRecipientsCount`/`revokeShared` in management), and `resolveResourceKind` is called from both `isSharedWithCaller` (management) and would be needed again if invitation ever needed a resource-kind check — so a plain exported-function module, not an injectable service, avoids adding DI ceremony around functions that hold no state. This mirrors `utils/deployment-mapper.util.ts`/`utils/toolset-mapper.util.ts` from the deployments/toolsets split.

**`CATALOG_SHARE_INVITATION_ROUTE_PATH`/`CONVERSATION_SHARE_INVITATION_ROUTE_PATH` and `SHARE_LINK_EXPIRES_IN_DAYS`/`ACCESS_PERMISSIONS` stay local to `ShareInvitationService`'s file, not the shared util.**
These constants and `getInvitationRoutePath` are only ever used by `createShareLink`/`buildInvitationUrl` (invitation-only concerns); moving them to the shared util would put invitation-only knowledge in a file `ShareManagementService` also imports, for no reuse benefit. Exception: `getInvitationRoutePath` itself is grouped with the shared util anyway since it is a pure string-prefix function with the same shape as `resolveResourceKind` — see the file layout below for the exact split.

**`ShareService` facade keeps the five original public method signatures and return types**, delegating one-to-one to whichever sub-service owns each method. This is what lets `ShareController` (and its Swagger `@ApiOperation`/`@ApiResponse` decorators, which live on the controller, not the service) stay completely unchanged.

### File layout

```
apps/chat-api/src/share/
  share.service.ts              # thin facade, delegates to the two sub-services below
  share.module.ts               # registers ShareService, ShareInvitationService, ShareManagementService
  share.controller.ts           # unchanged
  invitation/
    share-invitation.service.ts # createShareLink, acceptInvitation, resolveSharedItemSummary,
                                 # buildInvitationUrl, getRelatedResourceUrls
    tests/
      share-invitation.service.spec.ts
  management/
    share-management.service.ts # discardShared, getRecipientsCount, revokeShared, isSharedWithCaller
    tests/
      share-management.service.spec.ts
  utils/
    share-resource.util.ts      # resolveResourceKind, toShareResourceUrl, getInvitationRoutePath,
                                 # isAlreadyOwnedError, collectConversationResourceUrls,
                                 # collectAttachmentResourceUrls, isRecord, AnnotationWithAttachment,
                                 # RESOURCE_KIND_BY_PREFIX, FILE_RESOURCE_PREFIX, CONVERSATION_RESOURCE_PREFIX
    tests/
      share-resource.util.spec.ts
  dto/                           # unchanged
  tests/
    share.service.spec.ts        # slim facade spec: delegation assertions only
```

## Risks / Trade-offs

- **Security-sensitive flows** → `acceptInvitation` grants access and `revokeShared`/`discardShared` remove it; splitting must preserve the exact authorization checks (`isSharedWithCaller`'s pre-flight read-before-discard, the `already belong` no-op detection, the `403`/`404` mappings) verbatim. Mitigation: the migration plan below moves code without rewriting logic, and the split spec files are derived from the existing 1544-line spec's assertions rather than rewritten from scratch, so behavioral coverage carries over 1:1.
- **`isSharedWithCaller` sits in `ShareManagementService` but is only used by `discardShared`** → if a future change needs it from invitation-side code, it would need to either become a shared util (losing its DI dependency on `dialClient`) or get duplicated. Mitigation: not a problem today — flagging as an open question below rather than pre-emptively over-engineering.
- **Both sub-services depend on `DialClientService`, `DeploymentsService`, `ToolsetsService`** → slightly more constructor boilerplate than one shared service, but matches the precedent (`DeploymentsListingService`/`DeploymentsDetailsService` both inject `UserConfigService`) and keeps each sub-service's dependency list honest about what it actually calls.

## Migration Plan

1. Create `utils/share-resource.util.ts` with the extracted pure helpers and their existing JSDoc/inline comments preserved; add `utils/tests/share-resource.util.spec.ts` covering them (extracted from the relevant sections of the current `share.service.spec.ts`).
2. Create `invitation/share-invitation.service.ts` with `ShareInvitationService`, moving `createShareLink`, `acceptInvitation`, `resolveSharedItemSummary`, `buildInvitationUrl`, `getRelatedResourceUrls`, and the `appOrigin` constructor logic verbatim; import shared helpers from step 1.
3. Create `management/share-management.service.ts` with `ShareManagementService`, moving `discardShared`, `getRecipientsCount`, `revokeShared`, `isSharedWithCaller` verbatim; import shared helpers from step 1.
4. Rewrite `share.service.ts` as a facade: inject both new services, delegate each of the five public methods one line each.
5. Update `share.module.ts` to register the two new providers alongside the facade.
6. Split `tests/share.service.spec.ts` into `invitation/tests/share-invitation.service.spec.ts` and `management/tests/share-management.service.spec.ts` by test-suite (`describe` block) boundary, leaving a slim facade spec behind that only asserts delegation.
7. Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` and confirm `npm run openapi:check` reports no diff (no endpoint contract touched).
8. No rollback beyond `git revert` — purely internal, no data migration, no deployed-contract change.

## Open Questions

- Should `isSharedWithCaller` become a shared util if a future feature needs a "is this shared with me" check outside `discardShared`? Deferred — no second caller exists today.
