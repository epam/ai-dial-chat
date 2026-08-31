## Context

Prompts are stored in DIAL Core at `prompts/{bucket}/{path}`, exactly like every other resource type (`applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, `conversations/{bucket}/{path}`, `skills/{bucket}/{path}`). Every other type exposes that same full path as its one identity field, end to end. Prompts alone split it: `PromptResponseDto` returns `id` (bucket-relative) and `bucket` (session bucket by default, owner bucket for a prompt shared with the caller) as two fields, and the CRUD/query endpoints take a `path` query param plus an optional `bucket` query param instead of one identifier.

This was a deliberate choice recorded in `openspec/changes/archive/2026-07-30-prompts-backend-api/design.md` (Decision 1), matching the legacy chat's `getPromptRootId()` convention. It has since produced two kinds of cost, both already documented elsewhere in this repo:

1. **A bridge that only prompts need.** `openspec/changes/archive/2026-08-24-add-prompt-catalog-entity-type/tasks.md` (task 9.4) added `ShareResourceKind`/`resourceKind: 'prompt'` to the share DTOs specifically so a bucket-relative prompt id could be qualified into a full resource url at the sharing boundary. `publish.service.ts` carries an equivalent `toSourceUrl` special case. Both exist only because a prompt id doesn't already look like every other resource's id.
2. **Two catalog actions that don't work for prompts.** `prompt-catalog-integration/spec.md` documents, in its own words, that "Unshare" and "Revoke access" are "unsupported" for prompts specifically because `DiscardSharedCatalogItemDto`/`RevokeSharedAccessDto`'s allowlist doesn't accept a bare prompt path and a prompt path plus separate bucket doesn't fit that allowlist's one-field shape either. This is not a deliberate product decision; it is a byproduct of the id split.

This change removes the split: a prompt's `id` becomes the same kind of full resource path every other type already uses.

## Goals / Non-Goals

**Goals:**
- One identity field (`prompts/{bucket}/{path}`) for a prompt everywhere it crosses an API boundary: `PromptResponseDto`, the prompt CRUD/list/folder/move endpoints, sharing (create/discard/revoke/recipients), publish, catalog id mapping, and favourites.
- Delete the prompt-only bridging code this asymmetry produced: `ShareResourceKind`, the `resourceKind`/`bucket` fields on the four share DTOs, `IsCatalogResourcePath`'s prompt bypass, and `publish.service.ts`'s `toSourceUrl` prompt branch.
- Make "Unshare" and "Revoke access" work for prompts, the same way they already work for skills, by fixing the id shape that blocked them rather than adding another per-type predicate.
- Carry existing users' prompt favourites forward through the id-shape change with no silent loss.

**Non-Goals:**
- No change to who can do what. DIAL Core remains the sole authorization authority for every prompt operation, exactly as it is today for a `bucket` query param pointing at someone else's namespace; this change only changes how that bucket travels (embedded in one string vs. a separate field), not what's checked.
- No change to the organisation/public prompt namespace's semantics — `prompts/public/{path}` already exists in DIAL Core today; this change stops splitting it into `id: path, bucket: 'public'` and starts returning it as one string, nothing else.
- No introduction of API versioning (`/api/v2/...`). `apps/chat-api`'s `main.ts` serves the compiled `apps/chat` frontend from the same process/container, so backend and frontend ship as one artifact — there is no rolling-deploy window where an old frontend talks to a new backend's prompt endpoints, so a compatibility shim is unnecessary complexity for this codebase's actual deploy model.
- No redesign of the Prompts folder model, the sentinel-file (`.folder`) mechanism, or the prompt editor's UX — only the identifier shape they carry changes.

## Decisions

### D1: A prompt's public identity is `prompts/{bucket}/{path}`, matching every other resource

`PromptResponseDto.id` (and every request parameter that today accepts `path`/`bucket`) changes to a single field carrying the full resource path, using the same convention `applications/`, `toolsets/`, `conversations/`, and `skills/` already use. The separate `bucket` response field is removed — it's now a substring of `id`, recoverable the same way every other resource type's owner bucket already is (e.g. `resolveDeploymentFolder` reading the first path segment).

Alternative considered: keep `bucket` as a *derived, read-only* convenience field alongside the new `id`, so existing frontend code that destructures `{ id, bucket }` keeps compiling. Rejected — it re-introduces exactly the two-shapes-for-one-identity problem this change exists to remove, and every caller of the old shape is being touched by this change anyway (see proposal Impact).

Organisation (public) prompts: no new concept. `prompts/public/{path}` becomes their `id` verbatim; the `PUBLIC_BUCKET` constant remains an internal implementation detail for building and recognising that namespace, same as it is today, but it stops surfacing as a separate `bucket: 'public'` response field.

### D2: Endpoints take one `id` parameter instead of `path` + optional `bucket`

`GetPromptQueryDto`, `RequiredPromptPathDto`, and the query params on move/delete/folder endpoints replace their `path`/`bucket` pair with a single `id: string` field, validated as a full resource path (allowlisted to `prompts/{bucket}/{path}`, same allowlist family the share DTOs use for `applications|toolsets|conversations|skills`, now including `prompts`). Route paths themselves (`/api/v1/prompts/item`, `/api/v1/prompts`, `/api/v1/prompts/move`, `/api/v1/prompts/folders`) are unchanged — only the query parameter shape changes, from `?path=...&bucket=...` to `?id=...`.

Server-side, a small parse step (extending the existing `prompt-mapper.util.ts`) splits `id` into `(bucket, subPath)` at the boundary where each sub-service needs it — `prompts-resource.service.ts` and friends keep their internal `(bucket, path)` signatures; only the DTO-facing boundary changes. This mirrors exactly how the share domain already parses a full `itemId` into a DIAL Core `resourceTypes` filter via `RESOURCE_KIND_BY_PREFIX`.

`POST /api/v1/prompts` (create) is unaffected — it never took a `path`/`bucket` pair; the server derives a new path in the caller's session bucket and returns the new full `id` in the response, same as today's create flow already returns a bucket-relative `id`.

### D3: Remove `ShareResourceKind` and the bridge it enabled

Because every prompt `itemId` reaching the share endpoints is now already a full `prompts/{bucket}/{path}` string, the qualification step `resourceKind: 'prompt'` existed to perform becomes unnecessary. `ShareResourceKind`, the `resourceKind` field on `CreateShareLinkDto`/`DiscardSharedCatalogItemDto`/`RevokeSharedAccessDto`/`GetShareRecipientsDto`, `DiscardSharedCatalogItemDto.bucket`, `ShareService.resolveResourceUrl`'s prompt branch, and `IsCatalogResourcePath`'s prompt-shaped bypass are all deleted. `prompts/` is added to the shared allowlist pattern directly, the same way `skills/` was added in an earlier change — no conditional branch, no bypass.

`RESOURCE_KIND_BY_PREFIX` already has a `['prompts/', 'PROMPT']` entry from the prior fix in this same domain; it needs no further change.

### D4: `publish.service.ts` drops its prompt bucket-qualification branch

`toSourceUrl`'s prompt-specific qualification (turning a bucket-relative id into `prompts/{callerBucket}/{path}`) is removed; a prompt's `entityId` arriving at the publish endpoint is already a full path, so it's treated exactly like a skill's `entityId` — no branch by entity type for this purpose. `entityType: 'prompt'` itself is untouched: it still exists as a discriminator for prompt-specific publish behavior that has nothing to do with id shape (no version, trimmed publication title).

### D5: Catalog id mapping drops its dual scheme

`libs/chat-hooks/src/catalog/map-prompt-to-catalog-item.ts` currently uses the bare `prompt.id` for personal/organisation prompts and `buildPromptResourceUrl({ bucket: prompt.bucket, path: prompt.id })` only for a shared prompt. Once `PromptResponseDto.id` is always the full path, `CatalogItem.id` is simply `prompt.id`, unconditionally — the same one-line mapping every other entity type already uses. `buildPromptResourceUrl`/`parsePromptResourceUrl` in `libs/chat-hooks/src/prompt/prompt-resource.ts` are deleted; nothing needs to assemble or disassemble a prompt id from parts anymore, because the BFF now hands out the assembled form directly.

Consequently `CatalogView`'s `isUnshareVisible`/`isRevokeShareVisible` predicates stop special-casing `Prompt` to `false` — they fall through to the lib's built-in `isMyApp`/`sharedWithMe` rule, same as skills.

### D6: Favourites migration normalises on read, keyed by "does it already look like a full id"

`prompts.installed` today stores whatever `CatalogItem.id` was at favourite time: a bare path for a personal prompt, already-qualified `prompts/{ownerBucket}/{path}` for a shared one (per the current `map-prompt-to-catalog-item.ts` split — see D5). After this change every new entry is a full id. For existing stored entries, `migrateConfig` gains a step that recognises a bare entry (no `prompts/` prefix) and qualifies it with the user's own session bucket — safe because a bare-stored entry can only have come from a *personal* prompt under the old scheme (shared ones were already qualified). An already-qualified entry is left untouched.

This reuses the existing versioned-migration mechanism (`CURRENT_CONFIG_VERSION` bump, `migrateConfig` gains one more shape to handle), the same mechanism that introduced `prompts.installed` itself in the v3→v4 step.

Alternative considered: a one-off backfill script run once at deploy time. Rejected — `migrateConfig` already runs per-user on every config read and is the established pattern for this exact kind of shape change in this codebase; a separate script would be a second migration mechanism for the same class of problem.

## Risks / Trade-offs

- **[Risk]** Every prompt endpoint's request/response shape changes at once → a partially-applied change leaves the frontend and backend disagreeing about the contract for however long the gap exists.
  **Mitigation**: implement and land backend + frontend + regenerated client together (see Migration Plan); the app already deploys backend and frontend as one artifact, so there is no intermediate "half-migrated" version served to real traffic.
- **[Risk]** The `isUnshareVisible`/`isRevokeShareVisible` predicates newly returning `true` for prompts is a *behavior* change (new UI surface), not just a refactor — if the underlying discard/revoke endpoints have any prompt-specific edge case the skill rollout didn't hit, it will surface for the first time here.
  **Mitigation**: the discard/revoke/recipients backend support for `prompts/` already shipped and is unit-tested (prior change in this same session); this change only removes the DTO bypass and flips the frontend predicate, it does not touch `ShareService`'s DIAL Core call logic for prompts.
- **[Risk]** Favourites migration misclassifies an entry (e.g. a bare string that isn't actually a prompt path).
  **Mitigation**: the migration only ever touches the existing `prompts.installed` array, which by construction (validated by `PROMPT_PATH_PATTERN` on write) never contains anything else; the only ambiguity resolved is "bare vs. already-qualified," decided by the presence of the `prompts/` prefix.
- **[Trade-off]** `PromptResponseDto` loses its explicit `bucket` field, which was a minor convenience for any code that wanted "just the owner" without parsing. No current spec'd consumer needs that in isolation (every consumer that read `bucket` also had `id`, and gets the same information by parsing `id`), so this is accepted as a one-time small parsing cost at exactly the boundaries that need it, in exchange for one identity shape everywhere else.

## Migration Plan

1. Backend: change `PromptResponseDto`, the query DTOs, and the five prompt sub-services to produce/consume the full `id` (D1–D2); update `prompt-mapper.util.ts` as the central parse/assemble point.
2. Backend: remove the share-domain bridge (D3) and the publish special case (D4); extend the shared catalog-resource allowlist to include `prompts/` unconditionally.
3. Backend: add the `migrateConfig` favourites step (D6) and bump `CURRENT_CONFIG_VERSION`.
4. Regenerate `libs/chat-api-client` (`npm run openapi && npm run openapi:check`) against the new backend contract.
5. Frontend: update `prompts.api.ts`, `share.api.ts`, `CatalogView.tsx`, `PromptEditor.tsx`, `SharePopoverContainer.tsx`, `FavoriteApplicationsContext.tsx`, `usePromptSelectorOverlay.tsx`, and the `libs/chat-hooks` catalog mapper/prompt-resource module (D5) to consume the single `id`.
6. Update the affected spec files listed in the proposal's Impact section and `docs/architecture.md` if it names the old shape.
7. Land backend + client regeneration + frontend together in one change (no independent rollout stage needed — see Non-Goals). Rollback is a plain revert of this change, since there is no external persisted state that depends on the new shape except `prompts.installed`, which the migration step degrades gracefully by leaving already-qualified entries untouched on a rollback (they'd simply stop matching a bare-path comparison, if any remained, which none do after one successful forward migration pass).

## Open Questions

- Should the new query parameter be named `id` (matching `PromptResponseDto.id`) or `itemId` (matching the share domain's `DiscardSharedCatalogItemDto.itemId`/`RevokeSharedAccessDto.itemId`)? This design assumes `id` for symmetry with the response DTO field it round-trips with tasks; confirm during implementation review if the share-domain naming is preferred instead for cross-domain consistency.
- Does any external consumer (Postman collection, integration tests outside this repo, a documented public API contract) rely on the current `path`+`bucket` shape strongly enough to need a deprecation notice rather than a direct breaking change? Assumed no, per the "single artifact deploy" reasoning in Non-Goals, but worth a final check against `postman/chat-api.postman_collection.json` and any published API changelog before implementation.
