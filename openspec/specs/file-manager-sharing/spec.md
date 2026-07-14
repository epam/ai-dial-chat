# Spec: file-manager-sharing

### Requirement: POST /api/v1/files/share endpoint

The BFF SHALL expose `POST /api/v1/files/share` that accepts a batch of file/folder paths and a permission level, creates a single `LINK`-type invitation covering all listed resources via DIAL Core `shareResource`, and returns the invitation link.

**State ownership**: `FilesService` in `apps/chat-api/src/files/` owns all share logic; `FilesController` delegates to it (thin-controller pattern, `apps/chat-api/AGENTS.md`).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core), identical to `/copy` and `/move`. No additional role is required beyond an authenticated session; Core enforces that the caller has `SHARE`-capable permission on each resource, surfaced as a `403 Forbidden` exception.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — matching `/copy`, `/move`, `/rename`, `/delete`.

**Caching**: no NestJS cache read/write. Frontend-side `sharedByMePaths`/listing caches are invalidated by the hook on completion (see `file-manager-sharing` frontend requirements below).

#### Request DTO

**`SharePermission`** (string enum, `apps/chat-api/src/files/dto/share-files.dto.ts`):
```
Read      = 'read'
ReadWrite = 'readWrite'
```

**`ShareItemDto`**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(BUCKET_NAME_PATTERN) @MaxLength(256)` | DIAL Core bucket |
| `path` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Relative path within bucket |

**`ShareFilesDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `ShareItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ShareItemDto)` |
| `permission` | `SharePermission` | `@IsEnum(SharePermission)` |

Batch size is capped lower than copy/move/delete (50 vs 100) because each item maps into a single Core invitation request body rather than a paginated per-item loop, and a share action is normally invoked on a small, deliberate selection rather than a large folder expansion.

#### Response DTO

**`ShareFilesResponseDto`**: `{ invitationLink: string }`

#### Controller signature

```typescript
@Post('share')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Create a share invitation link for files and folders' })
@ApiResponse({ status: 200, type: ShareFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 403, description: 'Caller lacks SHARE permission on one or more resources' })
@ApiResponse({ status: 404, description: 'A resource does not exist' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async shareFiles(
  @Body() body: ShareFilesDto,
  @Req() req: Request,
): Promise<ShareFilesResponseDto>
```

#### Generated-client impact

- **operationId**: derived from handler name `shareFiles` → generated SDK method `filesApi.shareFiles({ shareFilesDto })`.
- **Request DTO**: `ShareFilesDto`. **Response DTO**: `ShareFilesResponseDto`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `shareFiles(items: ShareItemDto[], permission: SharePermission): Promise<ShareFilesResponseDto>` using the normal (non-`Raw`) generated method.

**Example request**:
```json
POST /api/v1/files/share
{
  "items": [
    { "bucket": "user-bucket", "path": "reports/q1.pdf" }
  ],
  "permission": "read"
}
```

**Example response**:
```json
{ "invitationLink": "https://chat.example.com/share/abc123" }
```

#### Scenario: Single file share succeeds with read permission

- **WHEN** `POST /api/v1/files/share` is called with one item and `permission: "read"`, and DIAL Core returns 200 for `shareResource`
- **THEN** the response contains `invitationLink` as a non-empty string

#### Scenario: Multi-resource share returns one link covering all resources

- **WHEN** `POST /api/v1/files/share` is called with 3 items
- **THEN** exactly one Core `shareResource` call is made with all 3 resources in its `resources` array, and the response contains a single `invitationLink`

#### Scenario: Share returns forbidden when caller lacks SHARE permission

- **WHEN** DIAL Core returns 403 for `shareResource`
- **THEN** the endpoint responds `403 Forbidden`

#### Scenario: Share returns not found for a missing resource

- **WHEN** DIAL Core returns 404 for `shareResource`
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: Validation rejects empty items array

- **WHEN** `POST /api/v1/files/share` is called with `items: []`
- **THEN** the endpoint returns `400 Bad Request`

#### Scenario: Validation rejects more than 50 items

- **WHEN** `POST /api/v1/files/share` is called with 51 items
- **THEN** the endpoint returns `400 Bad Request`

#### Scenario: Validation rejects an invalid permission value

- **WHEN** `POST /api/v1/files/share` is called with `permission: "admin"`
- **THEN** the endpoint returns `400 Bad Request`

---

### Requirement: POST /api/v1/files/revoke-access endpoint

The BFF SHALL expose `POST /api/v1/files/revoke-access` that accepts a batch of file/folder paths owned and previously shared by the caller, and revokes access for **all** users the resources were shared with, via DIAL Core `revokeSharedResources`. This is distinct from `discard-shared` below: revoke is an owner action affecting every recipient; it does not accept or require a permission level (revoking removes all granted permissions).

**Authorization**, **rate limit** (`@Throttle({ default: { limit: 10, ttl: 60000 } })`), and **caching** posture are identical to `/share` above.

#### Request/Response DTOs

**`RevokeAccessDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `RevokeAccessItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RevokeAccessItemDto)` |

**`RevokeAccessItemDto`**: same shape as `ShareItemDto` (`bucket`, `path`), no `permission` field — revoking removes all access regardless of what was originally granted.

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

**Authorization**, **rate limit** (`@Throttle({ default: { limit: 10, ttl: 60000 } })`), and **caching** posture are identical to `/share` above, except authorization requires only that the resource currently appears in the caller's shared-with-me listing (enforced by Core, surfaced as 403/404 on mismatch).

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

`FilesService` SHALL emit structured log lines for `shareFiles`/`revokeAccess`/`discardShared`, including item count and outcome, matching the existing pattern in `renameFiles`/`copyFiles`. Log lines SHALL NOT include the invitation link, full resource paths, or any user-identifying data beyond counts — only `itemCount` and success/failure.

#### Scenario: Share call logged without leaking the invitation link

- **WHEN** `shareFiles` completes successfully
- **THEN** a `log` line records `itemCount` and `success`, and does not contain the `invitationLink` value

#### Scenario: Revoke/discard calls logged with item count only

- **WHEN** `revokeAccess` or `discardShared` completes
- **THEN** a `log` line records `itemCount` and the outcome, with no resource paths or user identifiers beyond the counts

---

### Requirement: sharedByMePaths wired on useDialFileManager

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) SHALL fetch `listSharedByMe` alongside the existing `my_files` tab load and expose the result as `sharedByMePaths: Set<string>`, passed to ui-kit's `DialFileManager.sharedByMePaths` prop. Each entry SHALL use ui-kit's virtual `DialFile.path` format (e.g. `/My files/reports/q1.pdf`), not the DIAL Core resource path (`files/{bucket}/reports/q1.pdf`) returned by the BFF — built via `buildSharedItemVirtualPath` (see design D9), since ui-kit's row/tree/bulk gating compares against the virtual path. On all other tabs, `sharedByMePaths` SHALL be an empty `Set`.

**State ownership**: `useDialFileManager` owns `sharedByMePaths`; no new context is introduced.

**Cache invalidation**: `sharedByMePaths` is refreshed whenever the `my_files` tab's `retryCounter` increments — including after a successful `onManagePermissions`/`onRemoveFilesAccess` call (see below).

#### Scenario: sharedByMePaths populated on my_files tab

- **WHEN** the active tab is `my_files` and `listSharedByMe` returns 2 resources
- **THEN** `sharedByMePaths` is a `Set` containing both resources' virtual UI paths

#### Scenario: sharedByMePaths empty on other tabs

- **WHEN** the active tab is `shared` or `organization`
- **THEN** `sharedByMePaths` is an empty `Set`

---

### Requirement: onManagePermissions opens ShareFileModal

`useDialFileManager` SHALL expose `onManagePermissions(path?: string)`, wired to ui-kit's `DialFileManager.onManagePermissions` prop, that resolves `path` to the item's `bucket`/relative path and opens a new `ShareFileModal` component (`apps/chat/src/components/DialFileManagerModal/ShareFileModal.tsx`).

**`ShareFileModal`** SHALL display the resolved item's name, a permission choice (`Read` / `Read & Write`), and a "Create link" action. Submitting calls the `shareFiles` server-api wrapper with `invitationType: 'LINK'` (hardcoded) and the chosen permission. On success, the modal displays the returned `invitationLink` in a read-only field with a copy-to-clipboard control. On failure, the modal surfaces the error inline (not via `onNotification`, since the modal is already open and can show the error in context).

**State ownership**: `useDialFileManager` owns `isSharing` and the currently-open share target path; `ShareFileModal` owns its own local permission-choice and invitation-link display state.

**Memoisation**: `onManagePermissions` SHALL be a `useCallback` with dependencies `[bucket, items]` (to resolve the clicked path against the currently-loaded listing for display purposes).

#### Scenario: ManagePermissions action opens the share modal

- **WHEN** the user triggers the `ManagePermissions` (Share) action on a single item
- **THEN** `ShareFileModal` opens showing that item's name and a permission choice, with no invitation link yet displayed

#### Scenario: Creating a link calls shareFiles and displays the result

- **WHEN** the user selects `Read` and submits in `ShareFileModal`
- **THEN** `shareFiles` is called with `permission: "read"` and the modal displays the returned `invitationLink` with a copy-to-clipboard control

#### Scenario: Share failure is shown inline in the modal

- **WHEN** `shareFiles` rejects
- **THEN** `ShareFileModal` displays an inline error message and remains open; `onNotification` is not called for this failure

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
| `dialFileManager.shareAction` | `Share` |
| `dialFileManager.unshareAction` | `Unshare` |
| `dialFileManager.removeAccessAction` | `Remove access` |
| `dialFileManager.shareModalTitle` | `Share "{{name}}"` |
| `dialFileManager.shareModalReadPermission` | `Can view` |
| `dialFileManager.shareModalReadWritePermission` | `Can edit` |
| `dialFileManager.shareModalCreateLinkButton` | `Create link` |
| `dialFileManager.shareModalCopyLinkButton` | `Copy link` |
| `dialFileManager.shareModalLinkCopiedConfirmation` | `Link copied` |
| `dialFileManager.shareError` | `Failed to create the share link` |
| `dialFileManager.unshareError` | `Failed to remove the shared item` |
| `dialFileManager.removeAccessError` | `Failed to remove access` |

No raw string literal keys are passed to `t()` anywhere in this change — every key above is referenced through its `DialFileManagerI18nKeys` enum member.

#### Scenario: Share error message uses i18n key

- **WHEN** `shareFiles` fails
- **THEN** the inline modal error is produced via `t(DialFileManagerI18nKeys.ShareError)`, not a hardcoded string

---

### Requirement: No feature-flag gating

Sharing SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with Copy/Move/Duplicate/Rename/Delete, which ship unconditionally to authenticated users with the relevant DIAL Core permissions. Visibility is gated only by `actionProfile` (`Full`) and, for bulk Remove access, by `sharedByMePaths`.

#### Scenario: Sharing is available without a feature flag

- **WHEN** a user has `actionProfile: Full` on `my_files`
- **THEN** `Share`, `Unshare`, and `Remove access` actions are available without checking any `ENABLED_FEATURES` entry
