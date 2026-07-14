## 1. BFF — Share endpoint

- [x] 1.1 Create `SharePermission` string enum and `ShareItemDto` / `ShareFilesDto` / `ShareFilesResponseDto` DTO classes in `apps/chat-api/src/files/dto/share-files.dto.ts`, following the class-validator/`@ApiProperty` conventions in `apps/chat-api/src/files/dto/copy-files.dto.ts` (bucket/path with `@Matches(BUCKET_NAME_PATTERN)`/`@IsValidFilePath()`, `@ArrayMinSize(1) @ArrayMaxSize(50)` on `items`)
- [x] 1.2 Add `shareFiles(items: ShareItemDto[], permission: SharePermission, at: string): Promise<ShareFilesResponseDto>` to `FilesService`: map `permission` to `ResourceAccessType[]` (`read` → `['READ']`, `readWrite` → `['READ','WRITE']`), build one `dialClient.client.shareResource({ headers, body: { invitationType: 'LINK', resources: items.map(i => ({ url: buildFileUrl(i.bucket, i.path), permissions })) } })` call, map 400/403/404 to typed exceptions, other errors to `BadGatewayException`/`ServiceUnavailableException`; add structured `logger.log` at start/end with `itemCount` only (no paths, no invitation link)
- [x] 1.3 Add `@Post('share') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60000 } })` route to `FilesController` with full `@ApiOperation`/`@ApiResponse` Swagger decorators (200/400/401/403/404/429/502/503); delegate to `FilesService.shareFiles`
- [x] 1.4 Write unit tests in `apps/chat-api/src/files/tests/files.service.spec.ts`: single-item share success, multi-item share issues exactly one Core call, permission mapping (`read`/`readWrite`), 403, 404, unexpected error
- [x] 1.5 Write controller tests in `apps/chat-api/src/files/tests/files.controller.spec.ts`: valid request, empty `items` (400), 51 items (400), invalid `permission` value (400), unauthenticated (401)
- [x] 1.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 2. BFF — Revoke access and discard shared endpoints

- [x] 2.1 Create `RevokeAccessItemDto` / `RevokeAccessDto` / `RevokeAccessResponseDto` DTO classes in `apps/chat-api/src/files/dto/revoke-access.dto.ts` (bucket/path only, `@ArrayMinSize(1) @ArrayMaxSize(100)`)
- [x] 2.2 Create `DiscardSharedItemDto` / `DiscardSharedDto` / `DiscardSharedResponseDto` DTO classes in `apps/chat-api/src/files/dto/discard-shared.dto.ts`, structurally identical to task 2.1's DTOs
- [x] 2.3 Add `revokeAccess(items: RevokeAccessItemDto[], at: string): Promise<RevokeAccessResponseDto>` to `FilesService`: one `dialClient.client.revokeSharedResources({ headers, body: { resources: items.map(i => ({ url: buildFileUrl(i.bucket, i.path) })) } })` call, map errors to typed exceptions, log `itemCount` + outcome only
- [x] 2.4 Add `discardShared(items: DiscardSharedItemDto[], at: string): Promise<DiscardSharedResponseDto>` to `FilesService`: one `dialClient.client.discardSharedResources({ headers, body: { resources: items.map(i => ({ url: buildFileUrl(i.bucket, i.path) })) } })` call, same error-mapping/logging shape as task 2.3
- [x] 2.5 Add `@Post('revoke-access')` and `@Post('discard-shared')` routes to `FilesController`, both `@HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60000 } })` with full Swagger decorators (200/400/401/403/404/429/502/503); delegate to the corresponding `FilesService` methods
- [x] 2.6 Write unit tests for `revokeAccess`/`discardShared`: success, batch issues exactly one Core call, 403 (not owner / not shared with caller), 404, unexpected error
- [x] 2.7 Write controller tests for both new routes: valid request, empty `items` (400), unauthenticated (401)
- [x] 2.8 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 3. BFF — shared-by-me listing

- [x] 3.1 Add `ListSharedByMeQueryDto` in `apps/chat-api/src/files/dto/list-shared-by-me.dto.ts`, structurally identical to the existing `ListSharedFilesQueryDto` (`bucket` field only)
- [x] 3.2 Add `listSharedByMe(bucket: string, at: string): Promise<ListFilesResponseDto>` to `FilesService`, mirroring `listSharedFiles` exactly but calling `dialClient.client.getSharedResources({ headers, body: { resourceTypes: ['FILE'], with: 'others', includeUserInfo: false } })` and reusing the same response normalization path (`normalize-file-item.ts`)
- [x] 3.3 Add `@Get('shared-by-me') @Throttle({ default: { limit: 60, ttl: 60000 } })` route to `FilesController` with full Swagger decorators (200/400/401/429/502/503), reusing `ListFilesResponseDto` as the response type; delegate to `FilesService.listSharedByMe`
- [x] 3.4 Write unit tests for `listSharedByMe`: returns normalized items, empty listing returns empty arrays (not an error), Core error mapping
- [x] 3.5 Write controller tests for `GET /api/v1/files/shared-by-me`: valid request, missing/invalid `bucket` (400), unauthenticated (401)
- [x] 3.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 4. OpenAPI client regeneration and server-api wrappers

- [x] 4.1 Run `npm run openapi` to regenerate `libs/chat-api-client/`; verify `filesApi.shareFiles`, `filesApi.revokeAccess`, `filesApi.discardShared`, `filesApi.listSharedByMe` appear with clean generated names
- [x] 4.2 Run `npm run openapi:check`
- [x] 4.3 Add `shareFiles(items, permission)`, `revokeAccess(items)`, `discardShared(items)`, `listSharedByMe(bucket)` thin wrappers in `apps/chat/src/server-api/files.api.ts`, following the exact shape of the existing `copyFiles`/`listSharedFiles` wrappers
- [x] 4.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` — both must pass

## 5. Hook — sharedByMePaths and onManagePermissions

- [x] 5.1 Add `sharedByMePaths: Set<string>` state to `useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`), fetched via `listSharedByMe` alongside the existing `my_files` tab load pattern; empty `Set` on all other tabs
- [x] 5.2 Add `isSharing` state and `onManagePermissions(path?: string)` `useCallback` to `useDialFileManager`: resolve `path` against currently-loaded `items` to get the item's display name/bucket/relative path, and open the (task 6) `ShareFileModal` with that target
- [x] 5.3 Write unit tests for `sharedByMePaths` fetch behavior (populated on `my_files`, empty elsewhere, refreshed on `retryCounter` bump) and for `onManagePermissions` (resolves the correct item, opens modal target state)
- [x] 5.4 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 6. ShareFileModal component

- [x] 6.1 Create `apps/chat/src/components/DialFileManagerModal/ShareFileModal.tsx`: a memoized `FC<Props>` showing the target item's name, a permission choice (`Read`/`Read & Write`), a "Create link" button that calls `shareFiles` via a prop callback, an invitation-link display with copy-to-clipboard once created, and an inline error state on failure — no `onNotification` call for this modal's own errors (design.md D4 + the sharing spec's "Share failure is shown inline" requirement)
- [x] 6.2 Add `tests/ShareFileModal.spec.tsx` covering: renders target name and permission options, submit calls the create-link callback with the selected permission, displays the returned link with a working copy-to-clipboard control, shows an inline error on failure without calling any notification callback
- [x] 6.3 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 7. Hook — onUnshareFiles and onRemoveFilesAccess

- [x] 7.1 Add `isUnsharing`/`isRemovingAccess` state and `onUnshareFiles(files: DialFile[])` / `onRemoveFilesAccess(files: DialFile[])` `useCallback`s to `useDialFileManager`: resolve each `DialFile` to `{ bucket, path }` (same resolution pattern as `onDeleteFiles`), call `discardShared`/`revokeAccess` respectively
- [x] 7.2 On success, increment `retryCounter` for the `shared` tab (`onUnshareFiles`) or `my_files` tab (`onRemoveFilesAccess`) so both the listing and `sharedByMePaths`/`sharedWithMeIds` refresh
- [x] 7.3 Show a single error toast via `onNotification(NotificationVariant.Error, ...)` on failure (`DialFileManagerI18nKeys.UnshareError` / `.RemoveAccessError`); no toast on success
- [x] 7.4 Write unit tests for `onUnshareFiles`/`onRemoveFilesAccess`: success (cache invalidated, no toast), failure (toast shown), correct bucket/path resolution for a batch of items
- [x] 7.5 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 8. Shell wiring

- [x] 8.1 Pass `sharedByMePaths`, `onManagePermissions`, `onUnshareFiles`, `onRemoveFilesAccess` from `useDialFileManager`'s result through `DialFileManagerShell` (`apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`) to the corresponding `DialFileManager` props
- [x] 8.2 Add `shareAction`/`unshareAction`/`removeAccessAction` labels and `ShareFileModal`-specific labels to `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`)
- [x] 8.3 Add an `isShareActionsAllowed(actionProfile)` gate (returns `true` only for `DialFileManagerActionProfile.Full`) and use it, alongside the existing per-tab/permission checks, to include `DialFileManagerActions.ManagePermissions`/`.Unshare`/`.RemoveAccess` in `gridOptions`/`treeOptions`/`bulkActionsToolbarOptions` `actionLabels` per the updated `file-manager-tabs` spec table
- [x] 8.4 Extend the bulk `actionLabels` computation so `DialFileManagerActions.RemoveAccess` is included only when every path in `selectedPaths` is present in `sharedByMePaths` (mirror legacy `allSelectedItemsShared`, `origin/development` `apps/chat/src/components/FileManager/FileManager.tsx:95-119`)
- [x] 8.5 Render `ShareFileModal` in `DialFileManagerShell` when `useDialFileManager`'s share-target state is non-null, wiring its create-link callback to `shareFiles` and close/cancel back to clearing the target state
- [x] 8.6 Run `npm exec nx lint chat` and `npm exec nx build chat` — both must pass

## 9. i18n and RTL

- [x] 9.1 Add the twelve i18n keys listed in `specs/file-manager-sharing/spec.md` (`shareAction`, `unshareAction`, `removeAccessAction`, `shareModalTitle`, `shareModalReadPermission`, `shareModalReadWritePermission`, `shareModalCreateLinkButton`, `shareModalCopyLinkButton`, `shareModalLinkCopiedConfirmation`, `shareError`, `unshareError`, `removeAccessError`) to `apps/chat/src/i18n/locales/en.json`
- [x] 9.2 Add matching enum members to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`; replace any raw string literal keys introduced during earlier tasks with enum references
- [x] 9.3 RTL check: confirm `ShareFileModal` uses only logical Tailwind classes (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`) and, if it includes a copy icon or link icon, that it is symmetric (no mirroring needed) or uses `rtl:scale-x-[-1]` if directional

## 10. file-manager-tabs spec and full verification

- [x] 10.1 Confirm `DialFileManagerPage` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) still passes `actionProfile: DialFileManagerActionProfile.Browse` — this change does NOT flip it to `Full` (design.md D7); add a code comment or follow-up tracking note only if the codebase convention supports it, otherwise leave as a documented open item in the parent proposal
- [x] 10.2 Confirm the attach-modal flow (`actionProfile=Attach`) is unaffected — Share/Unshare/Remove access are gated on `Full` only, so `Attach` never surfaces them
- [x] 10.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
- [x] 10.4 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass
- [x] 10.5 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
