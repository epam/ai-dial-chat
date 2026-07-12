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
- [x] 4.8 Run `npm exec nx lint chat-api` — passes. `npm exec nx test chat-api` could not be run: the vitest runner fails on every spec file repo-wide in this environment (`Cannot read properties of undefined (reading 'config')`), confirmed pre-existing/unrelated via `git stash`; verified this domain instead via `npm exec nx build chat-api` and `npm exec nx typecheck chat-api` (clean)

## 5. Generated API Client

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client` from the updated Swagger spec
- [x] 5.2 Run `npm run openapi:check` — verify no schema drift
- [x] 5.3 Run `npm exec nx build chat-api-client` — confirmed via the `chat-api` build, which depends on it

## 6. Frontend — Wire Real API

- [x] 6.1 Create `apps/chat/src/server-api/share.api.ts` — thin wrapper calling `shareApi.createShareLink({ itemId, access })` from the generated client; export `createShareLink`
- [x] 6.2 Replace the mock body in `apps/chat/src/utils/share-link.ts` with a call to `createShareLink`; map response to `ShareLinkData`; remove mock constants
- [x] 6.3 Run `npm exec nx typecheck chat` — passes. `npm exec nx test chat` blocked by the same repo-wide vitest issue as 4.8

## 7. Access level as an array (edit implies view)

- [x] 7.1 Change `access` from a scalar `ShareLinkAccess`/`ShareAccess` to `ShareLinkAccess[]`/`ShareAccess[]` across `CreateShareLinkDto`, `ShareLinkResponseDto`, `ShareLinkData`, `SharePopoverProps`, `AccessControlProps`; "Can edit" now produces `[View, Edit]`, "Can view" produces `[View]`
- [x] 7.2 Update `ShareService`'s `ACCESS_PERMISSIONS` lookup to a union-of-permissions computation (`access.flatMap(...)` through a `Set`) instead of a single lookup
- [x] 7.3 Update `AccessControl`/`SharePopover` comparisons from `===` to `access.includes(ShareLinkAccess.Edit)`
- [x] 7.4 Regenerate `libs/chat-api-client`; update `apps/chat/src/utils/share-link.ts`'s `toShareLinkAccess` to map array-to-array
- [x] 7.5 Fix `useShareLink.setAccess`: it was patching `data.access` locally without re-fetching, so changing access never produced a new link. Rewrote it to re-call `getShareLink(itemId, access)` (a real bug found and fixed after the array conversion, not part of the original conversion scope) with a request-id guard against stale responses
- [x] 7.6 Update all affected tests (`share.service.spec.ts`, `share.controller.spec.ts`, `SharePopover.spec.tsx`, `useShareLink.spec.ts`, `SharePopoverContainer.spec.tsx`) to array fixtures

## 8. Opening a share link (accept-invitation flow)

There was previously no consumer for a generated share link: DIAL Core's `invitationLink` is an API path (`/v1/invitations/{id}`), not a frontend route, so opening a link fell through to `NotFoundPage`. This section closes that gap.

- [x] 8.1 `ShareService.buildInvitationUrl` replaces `toAbsoluteUrl`: extracts the invitation id from DIAL Core's `invitationLink` and rebuilds `{appOrigin}/catalog/shared/{invitationId}` instead of re-anchoring DIAL Core's raw path
- [x] 8.2 Add `apps/chat-api/src/common/validators/invitation-id.pattern.ts`, `share/dto/get-invitation.dto.ts`, `share/dto/accept-invitation-response.dto.ts`
- [x] 8.3 Add `ShareService.acceptInvitation` — calls DIAL Core's `getInvitation(id, { accept: true })`, the call that actually grants access; returns `{ itemId }` from `resources[0].url`
- [x] 8.4 Add `GET /api/v1/share/invitations/:invitationId` on `ShareController`; regenerate `libs/chat-api-client`
- [x] 8.5 Add `ROUTES.SharedInvitation = '/catalog/shared/:invitationId'`; add `apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx` — silently accepts on mount, redirects to `/catalog?itemId=` on success or shows an error notification + redirects to `/catalog` on failure; register the route in `app.tsx`
- [x] 8.6 Add `apps/chat/src/server-api/share.api.ts`'s `acceptInvitation`; add `apps/chat/src/types/catalog.ts` (`CatalogQuery.ItemId`)
- [x] 8.7 Add `initialDetailsItemId?: string` to `libs/catalog`'s `CatalogProps`; `Catalog` opens that item's details panel automatically once via the existing `handleOpenDetails` flow
- [x] 8.8 Wire `CatalogView` to read `?itemId=` via `useSearchParams` and pass it through as `initialDetailsItemId`
- [x] 8.9 Add `share.invitationAcceptError` i18n key; write/update tests (`Catalog.spec.tsx`, `CatalogView.spec.tsx`, new `SharedInvitation.spec.tsx`); run typecheck/lint/build on `chat-api`, `ai-dial-catalog`, `chat` — all clean
- [ ] 8.10 Confirm DIAL Core's actual behavior for re-accepting an already-accepted invitation (idempotent vs. error) once the real DIAL Core contract is available — currently `SharedInvitationPage` always retries acceptance on every visit (see design.md Risks)
