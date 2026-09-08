## ADDED Requirements

### Requirement: Share domain service ownership map
The share domain SHALL be decomposed into two focused injectable services plus a facade, each owning a disjoint set of responsibilities.

- `ShareInvitationService` SHALL own `createShareLink`, `acceptInvitation`, and their supporting private helpers (`resolveSharedItemSummary`, `buildInvitationUrl`, `getRelatedResourceUrls`).
- `ShareManagementService` SHALL own `discardShared`, `getRecipientsCount`, `revokeShared`, and their supporting private helper (`isSharedWithCaller`).
- `ShareService` SHALL act as a facade that delegates every public method to exactly one of the two services above, and SHALL NOT contain business logic beyond delegation.
- The module-level pure helpers (`resolveResourceKind`, `toShareResourceUrl`, `getInvitationRoutePath`, `isAlreadyOwnedError`, `collectConversationResourceUrls`, `collectAttachmentResourceUrls`) SHALL live in a shared, dependency-free `utils/share-resource.util.ts` module importable by both services.

#### Scenario: Facade delegates an invitation call
- **WHEN** `ShareController` calls `ShareService.createShareLink(...)` or `ShareService.acceptInvitation(...)`
- **THEN** the facade delegates to the matching `ShareInvitationService` method and returns its result unchanged

#### Scenario: Facade delegates a management call
- **WHEN** `ShareController` calls `ShareService.discardShared(...)`, `ShareService.getRecipientsCount(...)`, or `ShareService.revokeShared(...)`
- **THEN** the facade delegates to the matching `ShareManagementService` method and returns its result unchanged

#### Scenario: Shared resource helpers have no service dependency
- **WHEN** `ShareInvitationService` or `ShareManagementService` needs `resolveResourceKind` or `toShareResourceUrl`
- **THEN** it imports the function from `utils/share-resource.util.ts` rather than depending on the other sub-service or duplicating the logic

### Requirement: Behavior equivalence across the split
The decomposition SHALL NOT change any observable REST contract: request/response shapes, status codes, error mapping (including the `discardShared`/`revokeShared` `400`→`404` not-found translation and the `acceptInvitation` already-owned no-op detection), cache invalidation, and structured log fields SHALL remain identical to the pre-split `ShareService` behavior.

#### Scenario: Identical REST response after extraction
- **WHEN** a client calls `POST /api/v1/share`, `GET /api/v1/share/invitations/{invitationId}`, `POST /api/v1/share/discard`, `GET /api/v1/share/recipients`, or `POST /api/v1/share/revoke` before and after the service split
- **THEN** the response body, status code, and headers are identical for the same underlying DIAL Core state

#### Scenario: Pre-flight shared-state check preserved
- **WHEN** `ShareManagementService.discardShared` is called for a resource not shared with the caller
- **THEN** it still performs the `isSharedWithCaller` read before calling DIAL Core's `discardSharedResources`, and still throws `ForbiddenException` in the same case the pre-split `ShareService` did

#### Scenario: Post-accept cache invalidation preserved
- **WHEN** `ShareInvitationService.acceptInvitation` completes successfully
- **THEN** it still invalidates the deployments and toolsets list caches for the accepting user, exactly as the pre-split `ShareService` did

#### Scenario: Post-management cache invalidation preserved
- **WHEN** `ShareManagementService.discardShared` or `ShareManagementService.revokeShared` completes successfully
- **THEN** it still invalidates the deployments and toolsets list caches for the affected user, exactly as the pre-split `ShareService` did
