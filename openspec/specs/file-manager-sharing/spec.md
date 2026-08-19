# Spec: file-manager-sharing

## Purpose

The revoke-access, discard-shared, and shared-by-me endpoints, and their wiring into the file manager.

## Requirements

### Requirement: POST /api/v1/files/revoke-access endpoint

The BFF SHALL expose `POST /api/v1/files/revoke-access` that accepts a batch of file/folder paths owned and previously shared by the caller, and revokes access for **all** users the resources were shared with, via DIAL Core `revokeSharedResources`. This is distinct from `discard-shared` below: revoke is an owner action affecting every recipient; it does not accept or require a permission level (revoking removes all granted permissions).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core), identical to `/copy` and `/move`.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — matching `/copy`, `/move`, `/rename`, `/delete`.

**Caching**: no NestJS cache read/write.

#### Request/Response DTOs

**`RevokeAccessDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `RevokeAccessItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RevokeAccessItemDto)` |

**`RevokeAccessItemDto`**: `{ bucket, path }` — no `permission` field; revoking removes all access regardless of what was originally granted.

**`RevokeAccessResponseDto`**: `{ success: boolean }` — a single batch-level flag, not a per-item result array (see the `file-manager-sharing` capability's parent design doc D2: Core's `revokeSharedResources` has no per-resource response shape).

#### Controller signature

```typescript
@Post('revoke-access')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Revoke all shared access to files and folders' })
@ApiResponse({ status: 200, type: RevokeAccessResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 403, description: 'Caller does not own one or more resources' })
@ApiResponse({ status: 404, description: 'A resource does not exist' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async revokeAccess(
  @Body() body: RevokeAccessDto,
  @Req() req: Request,
): Promise<RevokeAccessResponseDto>
```

#### Generated-client impact

- **operationId**: `revokeAccess` → `filesApi.revokeAccess({ revokeAccessDto })`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `revokeAccess(items: RevokeAccessItemDto[]): Promise<RevokeAccessResponseDto>`.

**Example request/response**:
```json
POST /api/v1/files/revoke-access
{ "items": [{ "bucket": "user-bucket", "path": "reports/q1.pdf" }] }
```
```json
{ "success": true }
```

#### Scenario: Revoke access succeeds for an owned, previously-shared resource

- **WHEN** `POST /api/v1/files/revoke-access` is called with one item the caller owns and has shared, and DIAL Core returns 200 for `revokeSharedResources`
- **THEN** the response is `{ "success": true }`

#### Scenario: Revoke access on a batch calls Core once with the full item list

- **WHEN** `POST /api/v1/files/revoke-access` is called with 4 items
- **THEN** exactly one Core `revokeSharedResources` call is made with all 4 resources

#### Scenario: Revoke access fails when the caller does not own the resource

- **WHEN** DIAL Core returns 403 for `revokeSharedResources`
- **THEN** the endpoint responds `403 Forbidden`

#### Scenario: Validation rejects empty items array

- **WHEN** `POST /api/v1/files/revoke-access` is called with `items: []`
- **THEN** the endpoint returns `400 Bad Request`

---

### Requirement: POST /api/v1/files/discard-shared endpoint

The BFF SHALL expose `POST /api/v1/files/discard-shared` that accepts a batch of file/folder paths shared **with** the caller, and removes them from the caller's own shared-with-me view via DIAL Core `discardSharedResources`. This does not affect the owner's access or any other recipient's access.

**Authorization**, **rate limit** (`@Throttle({ default: { limit: 10, ttl: 60000 } })`), and **caching** posture are identical to `/revoke-access` above, except authorization requires only that the resource currently appears in the caller's shared-with-me listing (enforced by Core, surfaced as 403/404 on mismatch).

#### Request/Response DTOs

**`DiscardSharedDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `DiscardSharedItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => DiscardSharedItemDto)` |

**`DiscardSharedItemDto`**: `{ bucket, path }` — identical shape to `RevokeAccessItemDto`. The BFF maps each to a Core `ResourceLink { url }`; no `permissions` field is sent (Core's `ResourceLinkCollection` schema has no such field).

**`DiscardSharedResponseDto`**: `{ success: boolean }`.

#### Controller signature

```typescript
@Post('discard-shared')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Discard resources shared with the caller' })
@ApiResponse({ status: 200, type: DiscardSharedResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 403, description: 'Resource is not shared with the caller' })
@ApiResponse({ status: 404, description: 'A resource does not exist' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async discardShared(
  @Body() body: DiscardSharedDto,
  @Req() req: Request,
): Promise<DiscardSharedResponseDto>
```

#### Generated-client impact

- **operationId**: `discardShared` → `filesApi.discardShared({ discardSharedDto })`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `discardShared(items: DiscardSharedItemDto[]): Promise<DiscardSharedResponseDto>`.

#### Scenario: Discard shared succeeds for an item shared with the caller

- **WHEN** `POST /api/v1/files/discard-shared` is called with one item currently shared with the caller, and DIAL Core returns 200 for `discardSharedResources`
- **THEN** the response is `{ "success": true }`

#### Scenario: Discard fails when the resource is not shared with the caller

- **WHEN** DIAL Core returns 403 for `discardSharedResources`
- **THEN** the endpoint responds `403 Forbidden`

#### Scenario: Validation rejects empty items array

- **WHEN** `POST /api/v1/files/discard-shared` is called with `items: []`
- **THEN** the endpoint returns `400 Bad Request`

---

### Requirement: GET /api/v1/files/shared-by-me endpoint

The BFF SHALL expose `GET /api/v1/files/shared-by-me?bucket=` that lists resources the caller has shared with others, via DIAL Core `getSharedResources` called with `{ resourceTypes: ['FILE'], with: 'others', includeUserInfo: false }` — the owner-side counterpart of the existing `GET /api/v1/files/shared` (`with: 'me'`). Reuses `ListFilesResponseDto`/`ListFilesItemDto` unchanged; no new response DTO is introduced.

**Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`, matching `/shared` and `/list`.

**Caching**: no NestJS cache read/write (matches `/shared`).

#### Controller signature

```typescript
@Get('shared-by-me')
@Throttle({ default: { limit: 60, ttl: 60000 } })
@ApiOperation({ summary: 'List files and folders shared by the caller with others' })
@ApiResponse({ status: 200, type: ListFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid query parameters' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async listSharedByMe(
  @Query() query: ListSharedByMeQueryDto,
  @Req() req: Request,
): Promise<ListFilesResponseDto>
```

`ListSharedByMeQueryDto` has a single `bucket` field with the same validators already used by `ListSharedFilesQueryDto`.

#### Generated-client impact

- **operationId**: `listSharedByMe` → `filesApi.listSharedByMe({ bucket })`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `listSharedByMe(bucket: string): Promise<ListFilesResponseDto>`.

#### Scenario: Shared-by-me listing returns owned, shared resources

- **WHEN** `GET /api/v1/files/shared-by-me?bucket=user-bucket` is called and DIAL Core's `getSharedResources` (`with: 'others'`) returns 2 resources
- **THEN** the response contains 2 items in the same `ListFilesItemDto` shape as `/shared`

#### Scenario: Empty shared-by-me listing

- **WHEN** the caller has not shared anything
- **THEN** the response contains an empty `files`/`folders` array (matching `/shared`'s empty-listing shape), not an error

---

### Requirement: Sharing observability

`FilesSharingService` SHALL emit structured log lines for `revokeAccess`/`discardShared`, including item count and outcome, matching the existing pattern in `FilesBatchOperationsService.renameFiles`/`copyFiles`. Log lines SHALL NOT include full resource paths or any user-identifying data beyond counts — only `itemCount` and success/failure.

#### Scenario: Revoke/discard calls logged with item count only

- **WHEN** `revokeAccess` or `discardShared` completes
- **THEN** a `log` line records `itemCount` and the outcome, with no resource paths or user identifiers beyond the counts

---

### Requirement: sharedByMePaths wired on useDialFileManager

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) SHALL fetch `listSharedByMe` alongside the existing `my_files` tab load and expose the result as `sharedByMePaths: Set<string>`, passed to ui-kit's `DialFileManager.sharedByMePaths` prop. Each entry SHALL use ui-kit's virtual `DialFile.path` format (e.g. `/My files/reports/q1.pdf`), not the DIAL Core resource path (`files/{bucket}/reports/q1.pdf`) returned by the BFF — built via `buildSharedItemVirtualPath` (see design D9), since ui-kit's row/tree/bulk gating compares against the virtual path. On all other tabs, `sharedByMePaths` SHALL be an empty `Set`.

**State ownership**: `useDialFileManager` owns `sharedByMePaths`; no new context is introduced.

**Cache invalidation**: `sharedByMePaths` is refreshed whenever the `my_files` tab's `retryCounter` increments — including after a successful `onRemoveFilesAccess` call (see below).

#### Scenario: sharedByMePaths populated on my_files tab

- **WHEN** the active tab is `my_files` and `listSharedByMe` returns 2 resources
- **THEN** `sharedByMePaths` is a `Set` containing both resources' virtual UI paths

#### Scenario: sharedByMePaths empty on other tabs

- **WHEN** the active tab is `shared` or `organization`
- **THEN** `sharedByMePaths` is an empty `Set`

---

### Requirement: onUnshareFiles and onRemoveFilesAccess wired on useDialFileManager

`useDialFileManager` SHALL expose `onUnshareFiles(files: DialFile[])` and `onRemoveFilesAccess(files: DialFile[])`, wired to the corresponding ui-kit `DialFileManager` props, calling `discardShared`/`revokeAccess` respectively with the resolved `bucket`/path list. Both call the BFF immediately — no confirmation dialog is shown before the request is sent (see design.md D5).

**State ownership**: `useDialFileManager` owns `isUnsharing`/`isRemovingAccess`.

**Cache invalidation**: on success, `onUnshareFiles` increments `retryCounter` for the `shared` tab; `onRemoveFilesAccess` increments `retryCounter` for the `my_files` tab (refreshing both the listing and `sharedByMePaths`).

**Notifications**: failure surfaces via `onNotification(NotificationVariant.Error, ...)` with a dedicated i18n-keyed message per action. Success shows no toast — the item disappearing from the refreshed listing is the confirmation.

**Memoisation**: both SHALL be `useCallback`s with dependencies `[bucket, onNotification, t]`.

#### Scenario: Unshare removes a shared-with-me item

- **WHEN** the user triggers `Unshare` on an item in the `shared` tab and `discardShared` succeeds
- **THEN** the `shared` tab's listing is refreshed and the item no longer appears, with no toast shown

#### Scenario: Remove access fails and shows a toast

- **WHEN** `onRemoveFilesAccess` is called and `revokeAccess` rejects
- **THEN** `onNotification` is called once with `NotificationVariant.Error` and a dedicated Remove-access-error message

---

### Requirement: Bulk Remove access visible only when every selected item is shared by me

`DialFileManagerShell` SHALL compute `bulkActionsToolbarOptions.actionLabels[DialFileManagerActions.RemoveAccess]` as present only when every path in the current `selectedPaths` is contained in `sharedByMePaths`; otherwise the key SHALL be omitted entirely from `actionLabels` (not merely disabled) — mirroring the legacy `allSelectedItemsShared` guard (`origin/development`, `apps/chat/src/components/FileManager/FileManager.tsx:95-119`).

#### Scenario: Bulk Remove access shown when all selected items are shared by me

- **WHEN** every path in `selectedPaths` is present in `sharedByMePaths`
- **THEN** `bulkActionsToolbarOptions.actionLabels` includes `DialFileManagerActions.RemoveAccess`

#### Scenario: Bulk Remove access hidden when any selected item is not shared by me

- **WHEN** at least one path in `selectedPaths` is absent from `sharedByMePaths`
- **THEN** `bulkActionsToolbarOptions.actionLabels` does NOT include `DialFileManagerActions.RemoveAccess`

#### Scenario: Bulk Remove access hidden when nothing is selected

- **WHEN** `selectedPaths` is empty
- **THEN** `bulkActionsToolbarOptions.actionLabels` does NOT include `DialFileManagerActions.RemoveAccess`

---

### Requirement: i18n keys for sharing

The following keys SHALL be added to `apps/chat/src/i18n/locales/en.json` with matching members added to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`:

| Key | English value (example) |
|-----|--------------------------|
| `dialFileManager.unshareAction` | `Unshare` |
| `dialFileManager.removeAccessAction` | `Remove access` |
| `dialFileManager.unshareError` | `Failed to remove the shared item` |
| `dialFileManager.removeAccessError` | `Failed to remove access` |

No raw string literal keys are passed to `t()` anywhere in this change — every key above is referenced through its `DialFileManagerI18nKeys` enum member.

#### Scenario: Sharing labels resolve through the key enum

- **WHEN** the Unshare and Remove access actions are rendered and their failures surface
- **THEN** every label and error message resolves through a `DialFileManagerI18nKeys` member
- **AND** no `t()` call in the sharing code passes a raw string literal

---

### Requirement: No feature-flag gating

Unshare and Remove access SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with Copy/Move/Duplicate/Rename/Delete, which ship unconditionally to authenticated users with the relevant DIAL Core permissions. Visibility is gated only by `actionProfile` (`Full`) and, for bulk Remove access, by `sharedByMePaths`.

#### Scenario: Unshare and Remove access available without a feature flag

- **WHEN** a user has `actionProfile: Full` on `my_files`
- **THEN** `Unshare` and `Remove access` actions are available without checking any `ENABLED_FEATURES` entry
