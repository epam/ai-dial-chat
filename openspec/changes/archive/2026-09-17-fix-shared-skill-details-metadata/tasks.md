**Slicing strategy: contract-first, then vertical.** Group 1 agrees the HTTP
contract and its generated client, because both the app adapter and the
`libs/chat-hooks` port depend on its exact shape and the OpenAPI regeneration is
a hard gate. Groups 2–5 then move one vertical path (shared-skill provenance)
end to end: adapter → lib fetch → app wiring → race guard. Group 6 is the
independent race-guard slice in `libs/catalog`, which needs nothing from the
earlier groups and can be done in parallel. Every group is independently
verifiable.

Scope discipline: each task touches only what it requires. No drive-by cleanup
in untouched files. Temporary diagnostics are already removed — no debug logging
is added, restored, or removed anywhere in this change.

## 1. BFF endpoint and generated client (contract-first)

- [x] 1.1 Add a provenance-only single-skill resolution to `apps/chat-api/src/skills/listing/skills-listing.service.ts`: parse/validate identity, encode the path with `encodeDialResourcePath`, call the SDK `listSkillMetadata`, normalize with `mapToSkillMetadataItem`, and strip `isMy`/`canEdit`/`sharedWithMe` from the result. Raise `NotFoundException` on a Core 404 or unnormalizable metadata, `BadRequestException` when the resolved `nodeType` is a folder, and route other upstream failures through `handleDialSdkError`. Do not modify or reuse `apps/chat-api/src/skills/lookup/skills-lookup.service.ts` (design D2).
- [x] 1.2 Bind the new method on the `SkillsService` facade (`apps/chat-api/src/skills/skills.service.ts`), following the existing `listSkills`/`listSkillFiles` binding pattern.
- [x] 1.3 Add the thin `@Get('metadata')` handler to `apps/chat-api/src/skills/skills.controller.ts` with `operationId: 'getSkillMetadata'`, `@Query() query: SkillResourceQueryDto`, the session `at` from `req.user`, and a full `@ApiOperation` + `@ApiResponse` set for 200/400/401/403/404/502/503 per `apps/chat-api/AGENTS.md`. Add no `@Throttle` (no skills endpoint has one and `apps/chat-api` declares no `ThrottlerModule`).
- [x] 1.4 Add the single-item response DTO wiring in `apps/chat-api/src/skills/dto/skill-metadata.dto.ts` so Swagger emits `SkillMetadataItemDto` as the `200` type with runtime metadata (class, not interface).
- [x] 1.5 Unit-test the service resolution in `apps/chat-api/src/skills/listing/tests/skills-listing.service.spec.ts`: item resolved with `author`/`updatedAt`; another user's bucket used verbatim rather than the caller's; encoded/nested path forwarded; ownership fields absent from the result; folder → 400; Core 404 → 404; unnormalizable metadata → 404; upstream 5xx/timeout → 502/503.
- [x] 1.6 Add supertest coverage in `apps/chat-api/src/skills/tests/skills.controller.spec.ts`: `200` payload shape; `400` for a bad bucket, a bad path, and a grouping-folder path; `401` without a session; `403`; `404`; `502`; `503`. Assert the response body carries no `isMy`, `canEdit`, or `sharedWithMe`, and that a READ-only shared skill's `permissions` contains no WRITE.
- [x] 1.7 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`, so the endpoint appears in `libs/chat-api-client/openapi.json` with strong types and the generated method is committed.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/skills/listing/tests/skills-listing.service.spec.ts
npm run test:file -- apps/chat-api/src/skills/tests/skills.controller.spec.ts
npm run openapi && npm run openapi:check
npm exec nx build chat-api-client && npm exec nx lint chat-api-client
npm run verify:changed
```

## 2. Application API adapter

- [x] 2.1 Add a `getSkillMetadata(bucket, path, signal?)` wrapper to `apps/chat/src/server-api/skills.api.ts` delegating to the **normal** (non-`Raw`) generated `skillsApi.getSkillMetadata` through the existing `api-client.ts` singleton — matching the `listSkillFiles` wrapper's shape, not `base.ts` helpers.
- [x] 2.2 Extend `apps/chat/src/server-api/tests/skills.api.spec.ts`: the wrapper forwards `bucket`/`path` unchanged, passes `{ signal }` only when a signal is given, and returns the generated client's resolved DTO.

**Verification**

```sh
npm run test:file -- apps/chat/src/server-api/tests/skills.api.spec.ts
```

## 3. Shared details pipeline in `libs/chat-hooks`

- [x] 3.1 Add `getSkillMetadata(bucket, path, signal?): Promise<SkillMetadataItemDto>` to the `SkillDetailsApi` port in `libs/chat-hooks/src/catalog/useSkillItemDetails.ts` (inherited by `CatalogDetailsApi` in `libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`), with JSDoc.
- [x] 3.2 Extend `onFetchSkillDetails`'s `Promise.allSettled` in `libs/chat-hooks/src/catalog/useSkillItemDetails.ts` to a third entry calling `api.getSkillMetadata(bucket, path)`, and resolve the overview's skill argument as: fulfilled metadata → the response (authoritative); rejected → the existing `skills.find((candidate) => candidate.url === item.id)` listing entry. Keep the existing early return for an unparseable `item.id` and keep `overview` omitted when the file listing rejects.
- [x] 3.3 Confirm `buildSkillOverview` in `libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts` needs no row-shape change (author row conditional, updated row always present with an empty value, file count from the listing) and adjust only its JSDoc to state that its skill argument is the authoritative metadata response with the listing entry as fallback. Do not add any fallback that fills a gap in a fulfilled metadata response from the listing entry, and do not read `author`/`updatedAt` off any file-listing entry.
- [x] 3.4 Add `libs/chat-hooks/src/catalog/tests/useSkillItemDetails.spec.ts` (new file) covering: all three requests fulfilled → provenance from the metadata response; sparse listing entry + populated metadata → populated Overview rows; metadata rejected → fallback to the listing entry with manifest and file count intact and nothing thrown; metadata fulfilled without `author` while the listing entry has one → author row omitted; metadata fulfilled + file listing rejected → `overview` still omitted; all three rejected → `undefined`; unparseable `item.id` → no request issued; `SKILL.md`'s own file-level `author`/`updatedAt` never reaching the Overview.
- [x] 3.5 Extend `libs/chat-hooks/src/catalog/tests/useCatalogItemDetails.spec.ts` so the skill branch asserts the metadata request is issued through the injected port and that a deployment or prompt item never calls it.
- [x] 3.6 Extend `libs/chat-hooks/src/catalog/tests/map-skill-to-catalog-item.spec.ts` for `buildSkillOverview`'s author-present / author-absent / no-timestamp row behavior against a metadata-shaped input.
- [x] 3.7 Architecture guard: verify no file under `libs/chat-hooks/src` contains the `/api/v1/skills/metadata` path, imports a generated client instance or `apps/chat/src/server-api`, or reads auth/CSRF/base-URL/env/feature-flag/routing state for this request — the operation arrives only as the injected `getSkillMetadata` port member (`AGENTS.md` §Library isolation and the documented `chat-hooks` types-only exception).

**Verification**

```sh
npm run test:file -- libs/chat-hooks/src/catalog/tests/useSkillItemDetails.spec.ts
npm run test:file -- libs/chat-hooks/src/catalog/tests/useCatalogItemDetails.spec.ts
npm run test:file -- libs/chat-hooks/src/catalog/tests/map-skill-to-catalog-item.spec.ts
npm exec nx lint chat-hooks
npm run verify:changed
```

## 4. Host wiring for both details surfaces

- [x] 4.1 Add `getSkillMetadata` to the memoized API adapter object in `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts` (the `useMemo` that already supplies `downloadSkillFile` and `listSkillFiles`), keeping its dependency list stable.
- [x] 4.2 Add `getSkillMetadata` to the memoized `skillDetailsApi` object in `apps/chat/src/components/SkillSelector/SkillDetailsPanelContainer.tsx`, so the chat-route panel follows the same contract.
- [x] 4.3 Extend `apps/chat/src/hooks/useCatalogItems/tests/useCatalogItems.spec.ts`: opening a skill's details calls the metadata wrapper with the bucket and path parsed from the item's resource URL, and catalog loading issues no per-skill metadata request.
- [x] 4.4 Add `apps/chat/src/components/SkillSelector/tests/SkillDetailsPanelContainer.spec.tsx` (new file) asserting that opening the chat-route panel for a shared skill whose context entry lacks provenance renders the Author and Last updated values from the metadata response. Query by role/label/text, not implementation selectors.
- [x] 4.5 Extend `apps/chat/src/pages/SharedInvitation/tests/SharedInvitation.spec.tsx`: after invitation acceptance the initial Overview renders provenance, and it still renders after a catalog refetch replaces `sharedWithMe` with the sparse listing entry (the regression this change fixes). Assert the acceptance order (refetch, then merge) is unchanged.

**Verification**

```sh
npm run test:file -- apps/chat/src/hooks/useCatalogItems/tests/useCatalogItems.spec.ts
npm run test:file -- apps/chat/src/components/SkillSelector/tests/SkillDetailsPanelContainer.spec.tsx
npm run test:file -- apps/chat/src/pages/SharedInvitation/tests/SharedInvitation.spec.tsx
npm run verify:changed
```

## 5. Request identity in the headless panel pipeline

- [x] 5.1 Pair the existing `isCancelled` flag in `libs/chat-hooks/src/catalog/useSkillDetailsPanelData/useSkillDetailsPanelData.ts` with a monotonic request-token ref captured at call time, so a response for the same skill closed and reopened cannot land. Keep the effect keyed on `catalogItem?.id` only, so a favorite toggle or a listings refresh triggers no refetch.
- [x] 5.2 Add `libs/chat-hooks/src/catalog/useSkillDetailsPanelData/tests/useSkillDetailsPanelData.spec.ts` (new file) covering: close and reopen the same skill with the first request still pending → only the second result is applied; switching skills mid-flight → the first response is discarded; a favorite toggle and a listings refresh → no additional fetch; `skillId` set to `null` → no result applied.

**Verification**

```sh
npm run test:file -- libs/chat-hooks/src/catalog/useSkillDetailsPanelData/tests/useSkillDetailsPanelData.spec.ts
npm exec nx lint chat-hooks
```

## 6. Request identity in `libs/catalog` (independent slice)

- [x] 6.1 Add a monotonic `pendingRequestIdRef` to `libs/catalog/src/components/Catalog/Catalog.tsx`'s `fetchDetails`, capture it per call, and apply `setFetchedDetails`/`setIsDetailsLoading` only while the captured token is current. Increment it in `handleCloseDetails` so an in-flight response for a closed panel is dropped. Retain `pendingItemIdRef` unchanged for `retryDetailsUntil`'s between-attempt bail-out.
- [x] 6.2 Extend `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`: close-and-reopen the same item with a pending request → only the second result renders; a response arriving after close updates nothing and the panel stays closed; switching items mid-flight → the first response is discarded; the post-auth retry loop still bails out when the panel closes between attempts.
- [x] 6.3 Architecture guard: verify `libs/catalog` gained no knowledge of endpoint paths, generated clients, backend DTOs, app contexts, auth/session, env, feature flags, routing, or storage — the change is request-identity bookkeeping only.

**Verification**

```sh
npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx
npm exec nx lint catalog
```

## 7. Documentation and closing verification

- [x] 7.1 Update the affected READMEs and docs in this same change: `apps/chat-api/README.md` if it enumerates skills routes, `docs/architecture.md` if its `ApiEndpoints`/backend-domain inventory lists skills routes, and `libs/chat-hooks/README.md` for the `SkillDetailsApi` / `CatalogDetailsApi` port's new `getSkillMetadata` member (every documented name and signature must match the source).
- [x] 7.2 Run `npm run validate:docs` and fix whatever it reports (README coverage, lib README export names, relative-link resolution).
- [x] 7.3 Confirm no i18n work is needed: `catalog.details.skill.author` and `catalog.details.skill.updated` already exist in `apps/chat/src/i18n/locales/en.json` and no new user-visible string is introduced. No RTL task is required — no new UI surface is added and the Overview rows' layout, ordering, and icons are unchanged.
- [ ] 7.4 Close the change with exactly one `npm run verify:full`, plus `npm run build:quiet` only if bundling was affected.

**Verification**

```sh
npm run validate:docs
npm run verify:full
```
