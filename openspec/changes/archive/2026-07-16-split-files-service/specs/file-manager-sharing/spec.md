## MODIFIED Requirements

### Requirement: POST /api/v1/files/share endpoint

The BFF SHALL expose `POST /api/v1/files/share` that accepts a batch of file/folder paths and a permission level, creates a single `LINK`-type invitation covering all listed resources via DIAL Core `shareResource`, and returns the invitation link.

**State ownership**: `FilesSharingService` (`apps/chat-api/src/files/sharing/files-sharing.service.ts`) owns all share/revoke/discard logic; `FilesController` delegates through the `FilesService` facade (thin-controller pattern, `apps/chat-api/AGENTS.md`).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core), identical to `/copy` and `/move`. No additional role is required beyond an authenticated session; Core enforces that the caller has `SHARE`-capable permission on each resource, surfaced as a `403 Forbidden` exception.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — matching `/copy`, `/move`, `/rename`, `/delete`.

#### Scenario: Single file share succeeds with read permission

- **WHEN** `POST /api/v1/files/share` is called with one item and `permission: "read"`, and DIAL Core returns 200 for `shareResource`
- **THEN** the response contains `invitationLink` as a non-empty string

#### Scenario: Multi-resource share returns one link covering all resources

- **WHEN** `POST /api/v1/files/share` is called with 3 items
- **THEN** exactly one Core `shareResource` call is made with all 3 resources in its `resources` array, and the response contains a single `invitationLink`

### Requirement: Sharing observability

`FilesSharingService` SHALL emit structured log lines for `shareFiles`/`revokeAccess`/`discardShared`, including item count and outcome, matching the existing pattern in `FilesBatchOperationsService.renameFiles`/`copyFiles`. Log lines SHALL NOT include the invitation link, full resource paths, or any user-identifying data beyond counts — only `itemCount` and success/failure.

#### Scenario: Share call logged without leaking the invitation link

- **WHEN** `shareFiles` completes successfully
- **THEN** a `log` line records `itemCount` and `success`, and does not contain the `invitationLink` value

#### Scenario: Revoke/discard calls logged with item count only

- **WHEN** `revokeAccess` or `discardShared` completes
- **THEN** a `log` line records `itemCount` and the outcome, with no resource paths or user identifiers beyond the counts
