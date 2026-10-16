# Proposal

## Why

After an administrator approves an unpublish, the catalog publish history still lists the folder, so re-publishing to it warns "Version is already published in <folder>. Publishing will replace it." and the button reads "Update version" ([#9172](https://github.com/epam/ai-dial-chat/issues/9172)). The history is also the visibility source for Unpublish, so anything reading it treats a removed item as still published.

### Problem

Reproduced on a live Core (prompt `hhm-text-formatter`, folder `hhm`). Both publications are `APPROVED` and sit in the author's own bucket:

- `ADD` — `sourceUrl: prompts/{bucket}/hhm-text-formatter`, `targetUrl: prompts/public/hhm/hhm-text-formatter`, `targetFolder: public/hhm/`.
- `DELETE` (newer) — `sourceUrl: prompts/public/hhm/hhm-text-formatter`, `targetUrl: prompts/public/hhm/hhm-text-formatter`, `targetFolder: public/hhm/`.

Catalog Unpublish runs on the **public copy**, so `handleUnpublish` sends the public id (`apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts:209`) and `PublishService.unpublish` derives the `DELETE` `sourceUrl` from it. History is requested for the **personal** id, and `resolvePublicationsForSource` only treats a `DELETE` as a removal when its `sourceUrl` equals that personal id (`removesSource`, `apps/chat-api/src/publish/publication.util.ts:188`; applied at `:354-381`). The `DELETE` is never recognised, so the approved `ADD` is never cancelled.

Conversations are unaffected because their unpublish sends the author's own `sourceUrl` (`apps/chat-api/src/conversations/conversation-publish.service.ts:204`), which is what their history matches on.

## What Changes

- Match an approved `DELETE` to the `ADD` it removes by **target folder + `targetUrl`** (percent-encoding tolerant) instead of by `sourceUrl`. `targetUrl` is the one field `publish` and `unpublish` both derive through `getPublishedTargetUrl`, and Core returns it when the publication is read back (verified against a live Core).
- Keep the existing rules unchanged: only an `APPROVED` removal cancels, a pending/rejected one cancels nothing, a newer `ADD` survives (publish → unpublish → publish again), and an undateable approved removal still wins asymmetrically with a warning.
- Add `targetUrl` to `PublicationResourceLike` in `publication.util.ts`.
- Regression test built from the live fixture above, plus the existing #8445 cases kept green.

### Non-goals

- The "Update version" label on a prompt (separate frontend wording issue).
- An unpublish performed by a different account: its `DELETE` lands in that account's bucket, which the author's history (`publications/{bucket}/`) never reads. A possible follow-up is to verify that the public copy still exists.
- Changing what `unpublish` sends to Core, the frontend, the DTOs, or the OpenAPI contract.

### Alternatives considered

- **Match by `targetUrl` (chosen):** one pure function in `publication.util.ts`, no extra Core calls, uses a field both operations already share.
- **Make `unpublish` send the personal `sourceUrl`:** rejected — a public id carries no link back to the author's bucket and chat-api has no database to store one.
- **Check that the public copy still exists on every history read:** more robust (also covers a removal by another account) but adds a Core call per listed folder and new failure modes; kept as a follow-up, not needed for this bug.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-publish-api`: the "Publish history endpoint derives history from Core publications" requirement changes how an approved removal is paired with the `ADD` it cancels (by folder and `targetUrl`, not `sourceUrl`).

## Impact

- Code: `apps/chat-api/src/publish/publication.util.ts`, `apps/chat-api/src/publish/tests/publication.util.spec.ts`.
- API: no contract change; `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` returns fewer, correct entries after an approved removal. No OpenAPI regeneration.
- Libs: none touched; no isolation concerns.
- i18n: no new user-visible strings.
- Docs: the `catalog-publish-api` spec delta. `catalog-unpublish-api` shows `sourceUrl` as the personal path in its example while the frontend actually sends the public id; the design notes this mismatch rather than changing that spec.
- Compatibility / rollback: not breaking. History is read-only and cached for 60 s, so reverting the commit restores the previous behaviour with no data migration.
