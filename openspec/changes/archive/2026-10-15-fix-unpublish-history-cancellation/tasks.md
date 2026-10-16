# Tasks

Slicing strategy: vertical, risk-first — the failing regression test comes first, then the minimal change to `publication.util.ts`, then cleanup. Read `apps/chat-api/AGENTS.md` before editing anything under `apps/chat-api/`.

## 1. Regression test from the live fixture

- [x] 1.1 In `apps/chat-api/src/publish/tests/publication.util.spec.ts`, add a `resolvePublicationsForSource` case using the live fixture: an `APPROVED` `ADD` (`sourceUrl: prompts/{bucket}/hhm-text-formatter`, `targetUrl: prompts/public/hhm/hhm-text-formatter`, `targetFolder: public/hhm/`, `createdAt: 1792058406051`) and a newer `APPROVED` `DELETE` (`sourceUrl` and `targetUrl` both `prompts/public/hhm/hhm-text-formatter`, same folder, `createdAt: 1792059866179`), asserting the result is empty. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/publication.util.spec.ts` fails on exactly this case before section 2.
- [x] 1.2 Add the neighbouring cases from the spec delta: a pending removal from the public copy leaves the folder listed once; a newer `ADD` after the removal survives; a removal of a different name in the same folder and of the same name in another folder cancels nothing; percent-encoded versus plain `targetUrl` still pairs (both directions); application and toolset `targetUrl` shapes pair; a removal with no `targetUrl` cancels nothing via the new pairing. Verification: the same command shows these failing or passing as expected, and every pre-existing case in the file is untouched.

## 2. Pair removals by folder and `targetUrl`

- [x] 2.1 In `apps/chat-api/src/publish/publication.util.ts`, add `targetUrl?: string` to `PublicationResourceLike`, add helpers returning an `ADD`'s published-copy `targetUrl` (through `findPublishingResource`) and a publication's `DELETE` `targetUrl`s, and normalize both with `safeDecodeURIComponent` and the existing folder-key normalization. Update the doc comments on `resolvePublicationsForSource` and `removesSource` to describe the target-based pairing. Verification: `npm run test:file -- apps/chat-api/src/publish/tests/publication.util.spec.ts` passes, including section 1 and all pre-existing #8445 cases.
- [x] 2.2 Fill the cancellation map from every approved removal in the resolved set keyed by `(target folder, targetUrl)` and apply it to each `ADD` by its own key, keeping the legacy `sourceUrl`-based folder-wide cancellation alongside it and reusing the existing timestamp comparison, undateable fallbacks and warning unchanged. Verification: same test file passes; `npm exec nx lint chat-api` reports no new findings.

## 3. Spec check

- [x] 3.1 Run `npm run validate:specs` and `npm run spec:impact` and confirm the `catalog-publish-api` delta cites only existing paths. Verification: `validate:specs` exits 0.

## 4. Integration check

- [ ] 4.1 Run `npm run verify:changed` once for the slice, then `npm run verify:full` once to close the change. No `build:quiet` is needed — no bundling, DTO or OpenAPI surface changes. Verification: both commands exit 0.
