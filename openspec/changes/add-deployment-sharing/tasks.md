## 1. Scaffold libs/share

- [x] 1.1 Generate the Nx lib: `npm exec nx g @nx/react:library share --directory=libs/share --bundler=vite --unitTestRunner=vitest --importPath=@epam/ai-dial-share` (or adapt flags to match workspace conventions)
- [x] 1.2 Add `"type:ui"` tag to `libs/share/project.json`; add the import boundary rule to `eslint.config.mjs` (apps may import from `share`; `share` may not import from apps or `chat-api-client`)
- [x] 1.3 Add `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-catalog` as peer/dependencies in `libs/share/package.json`

## 2. Move SharePopover to libs/share (from PR #7710)

- [x] 2.1 Cherry-pick or manually port `SharePopover.tsx`, `QrPlaceholder.tsx`, `SharePopover.module.scss` from PR #7710 into `libs/share/src/components/SharePopover/`
- [x] 2.2 Move share types (`ShareLinkAccess`, `SharePopoverView`, `ShareLinkData`) from `apps/chat/src/types/share.ts` into `libs/share/src/types/share.ts`; delete the app-level file
- [x] 2.3 Refactor `SharePopover` to accept flat data props (`url`, `isLoading`, `error`, `expiresInDays`, `access`, `canEditAccess`, `onAccessChange`, `onClose`) — remove `useShareLink` import and all internal hook calls; remove `item: CatalogItem` prop
- [x] 2.4 Export `SharePopover`, `QrPlaceholder`, `ShareLinkAccess`, `SharePopoverView`, `ShareLinkData` from `libs/share/src/index.ts`
- [x] 2.5 Port `SharePopover.spec.tsx` (24 tests from PR #7710) into `libs/share/src/components/SharePopover/tests/SharePopover.spec.tsx`; update assertions to use the new flat-prop API

## 3. App — shareOverlay integration (from PR #7710)

- [x] 3.1 Cherry-pick or port `libs/catalog` changes from PR #7710: `shareOverlay` prop on `CatalogProps`, `DetailsPanelProps`, and `Header`; `DialDropdown` anchoring in `Header`; `shouldShowShare` visibility logic
- [x] 3.2 Port `Header.spec.tsx` and `Catalog.spec.tsx` changes from PR #7710; run `npm exec nx test catalog` — all tests pass
- [x] 3.3 Port `useShareLink` hook from PR #7710 into `apps/chat/src/hooks/useShareLink/useShareLink.ts`; update import of share types to `@epam/ai-dial-share`
- [x] 3.4 Create `apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx` — calls `useShareLink(item.id)`, derives `canEditAccess` from `item.type` against `EDITABLE_ACCESS_TYPES`, renders `<SharePopover>` from `@epam/ai-dial-share` with flat props
- [x] 3.5 Write `apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx` — cover: wires hook data to SharePopover props, `canEditAccess` true/false per entity type
- [x] 3.6 Update `CatalogView` to pass `shareOverlay={(item, onClose) => <SharePopoverContainer item={item} onClose={onClose} />}`
- [x] 3.7 Delete `apps/chat/src/components/SharePopover/` (replaced by `SharePopoverContainer` + lib)
- [x] 3.8 Add i18n keys under `share.*` to `apps/chat/src/i18n/locales/en.json` (from PR #7710); update `visibilityNote` to "This deployment and its updates will be visible to users with the link." and `visibilityNoteEdit` to "Anyone with the link will be able to view and edit this deployment."
- [x] 3.9 Export `useCodeCopy` from `libs/chat-shared/src/index.ts` (from PR #7710)

## 4. Backend — Share Domain (NestJS)

- [x] 4.1 Create `apps/chat-api/src/share/dto/create-share-link.dto.ts` — `CreateShareLinkDto` with `@IsString() @IsNotEmpty() @Matches(/^[a-zA-Z0-9._\-/]+$/) itemId` and `@IsEnum(['view','edit']) access`; add `@ApiProperty` on both fields
- [x] 4.2 Create `apps/chat-api/src/share/dto/share-link-response.dto.ts` — `ShareLinkResponseDto` with `url: string`, `expiresInDays: number`, `access: 'view' | 'edit'`; add `@ApiProperty` on all fields
- [x] 4.3 Create `apps/chat-api/src/share/share.service.ts` — inject `DialClientService`; call DIAL Core share API (SDK method or raw fetch with documented gap comment); map response to `ShareLinkResponseDto`; throw `BadGatewayException` / `ServiceUnavailableException` on errors; use `Logger`
- [x] 4.4 Create `apps/chat-api/src/share/share.controller.ts` — `@ApiTags('share')`, `@Controller({ path: 'share', version: '1' })`, `POST /` handler with `@ApiOperation`, `@ApiResponse` for 201/400/401/429/502/503, `@Throttle({ default: { limit: 20, ttl: 60000 } })`
- [x] 4.5 Create `apps/chat-api/src/share/share.module.ts` — import `DialCoreModule`; provide `ShareService`; register in `AppModule`
- [x] 4.6 Write `apps/chat-api/src/share/tests/share.service.spec.ts` — cover: success, DIAL Core 502 → `BadGatewayException`, network error → `ServiceUnavailableException`
- [x] 4.7 Write `apps/chat-api/src/share/tests/share.controller.spec.ts` — cover: delegates to service, invalid `access` → 400, invalid `itemId` pattern → 400, unauthenticated → 401
- [ ] 4.8 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — fix any failures

## 5. Generated API Client

- [ ] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client` from the updated Swagger spec
- [ ] 5.2 Run `npm run openapi:check` — verify no schema drift
- [ ] 5.3 Run `npm exec nx build chat-api-client` — confirm clean build

## 6. Frontend — Wire Real API

- [x] 6.1 Create `apps/chat/src/server-api/share.api.ts` — thin wrapper calling `shareApi.createShareLink({ itemId, access })` from the generated client; export `createShareLink`
- [x] 6.2 Replace the mock body in `apps/chat/src/utils/share-link.ts` with a call to `createShareLink`; map response to `ShareLinkData`; remove mock constants
- [ ] 6.3 Run `npm exec nx typecheck chat` and `npm exec nx test chat` — fix any failures
