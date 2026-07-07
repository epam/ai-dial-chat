## Context

`apps/chat-api` grew four independent duplications as domains (conversations, files, models, applications, toolsets) were added in isolation:

1. Two error-mapping modules (`dial-error.ts` for SDK errors, `dial-fetch-error.ts` for raw-`fetch` errors) that overlap in the status codes they handle but differ in logging and AbortError/timeout support.
2. Three DIAL resource-path encoders (`encodeDialResourcePath`, `encodeDialFileResourcePath`, `encodeDialToolsetPath`) plus one inline duplicate in `conversation.service.ts`, all doing per-segment decode/re-encode with minor variations in the decode helper used.
3. The same `@Matches(/^[\w.-]+$/)` bucket-name regex copy-pasted into 7 file DTOs.
4. Two `MessageAttachment` → `DisplayAttachment` mappers — the full one in `apps/chat` and a simplified, incomplete one in `libs/conversation-stages` that is missing audio support and uses a different id fallback.

None of these are new capabilities; each is an internal implementation detail behind an already-stable external contract (HTTP status codes returned to clients, URL strings sent to DIAL Core, DTO validation behavior, and rendered attachment UI). The risk is entirely in behavioral drift during consolidation, not in designing new behavior.

## Goals / Non-Goals

**Goals:**
- Collapse each of the four duplications into exactly one implementation, imported everywhere it's needed.
- Preserve byte-for-byte / status-code-for-status-code equivalent behavior at every call site.
- Close the one real behavior gap found during the audit: `conversation-stages` silently drops audio attachments because its local mapper never handles the audio case.
- Keep `libs/chat-shared` and `libs/conversation-stages` free of app-owned integration details (URL resolution, DIAL paths), per the library isolation rule in AGENTS.md.

**Non-Goals:**
- No new REST endpoints, no OpenAPI/generated-client changes.
- No broader service decomposition (e.g. splitting `AppService`, extracting a `DialCoreModule`) — tracked separately.
- No splitting `chat-shared` into multiple packages.

## Decisions

### 1. Error mapper: merge into `common/dial/dial-error.mapper.ts`, keep two entry points

Decision: one file exporting `mapDialHttpStatus(status, context, logger?)`, `handleDialSdkError(error, context, logger?)`, and `handleDialFetchError(err, context, logger, timeoutMs?)`. `handleDialSdkError` replaces `handleDialError` and is the SDK-shape (`{ status }`) counterpart to `handleDialFetchError`; both delegate to the same `mapDialHttpStatus`.

Alternative considered: fold everything into a single `handleDialError(errorOrResponse, context, logger)` that branches on shape. Rejected — the SDK error and the raw-fetch error (`AbortError`, network `TypeError`, `Response`-like) have different enough shapes that one function would need internal type-narrowing branches, which is harder to unit-test in isolation than two thin, purpose-named wrappers around a shared core.

Logging: `logger` becomes optional but should be passed at every call site going forward for observability parity — SDK-path services (conversations, files, chat, rate, user-config, transcription, bucket) currently log nothing on DIAL errors, unlike the fetch-path services (models, applications, deployments, toolsets, application-schemas). Passing `logger` is additive (more logs, same exceptions thrown) so it carries no behavioral risk to callers.

Re-throw rule: `HttpException` instances passed in are re-thrown unchanged (matches the existing `ThemeService` pattern) — this must be the first branch in both `handleDialSdkError` and `handleDialFetchError`.

### 2. Path encoder: extract `common/utils/encode-dial-path.ts`, single signature

Decision: `encodeDialResourcePath(path: string): string` — split on `/`, safely decode each segment with `safeDecodeURIComponent`, re-encode with `encodeURIComponent`, rejoin with `/`. This becomes the one implementation used by conversations, files, and toolsets.

**Decode-helper resolution (2026-07-03):** The three existing encoders differ only in which decode helper they call per segment — `safeDecodeURIComponent` (conversations, toolsets) vs `safeDecodePathForCompare` (files). The latter is not a separate algorithm; it is `path.split('/').map(safeDecodeURIComponent).join('/')` defined locally in `files.service.ts`. When applied to an **already-split segment** (no literal `/`), `safeDecodePathForCompare(segment)` is identical to `safeDecodeURIComponent(segment)` because `split('/')` yields a single element. The full-path form of `safeDecodePathForCompare` is used elsewhere in `files.service.ts` for listing/comparison (~lines 713–714) and must **not** be folded into the shared encoder — it stays in `files.service.ts` for that use case only.

Canonical per-segment decode for the unified helper: **`safeDecodeURIComponent` only** (matches conversations and toolsets, the stability-sensitive callers). Task 2.1 characterization tests still assert all three encoders produce identical output on the shared fixture set before deletion; any unexpected divergence is a test failure, not an open design choice.

Alternative considered: keep three thin per-domain wrappers around a shared core (`encodeDialConversationPath`, `encodeDialFilePath`, `encodeDialToolsetPath`) for call-site clarity. Rejected as unnecessary indirection — none of the three needs domain-specific behavior once the decode helper is unified, so a single shared name is simpler and the SDK TODO comment carries over to the one file.

### 3. Bucket name validator: constants module, no behavior change

Decision: mirror the existing `deployment-id.pattern.ts` shape exactly — `apps/chat-api/src/common/validators/bucket-name.pattern.ts` exporting `BUCKET_NAME_PATTERN = /^[\w.-]+$/` and `BUCKET_NAME_VALIDATION_MESSAGE`. Each of the 7 DTOs replaces its inline `@Matches(/^[\w.-]+$/)` with `@Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })`. No new Swagger metadata; `@ApiProperty` descriptions are untouched.

### 4. Attachment mapper: pure lib mapper + app adapter, resolver-callback boundary

Decision: the canonical mapper lives in `libs/chat-shared/src/utils/message-attachment-to-display.ts` and takes the `MessageAttachment` DTO plus two optional resolver callbacks:

```ts
interface AttachmentDisplayResolvers {
  resolvePreviewUrl?(dto: MessageAttachment): string | undefined;
  resolvePlayUrl?(dto: MessageAttachment): string | undefined;
}
```

Default behavior (used by `conversation-stages` and any caller that passes no resolvers): image preview falls back to `dto.url`, audio play falls back to `dto.url`, and a `data:` URL is synthesized when `dto.data` (base64) is present but `dto.url` is not. `apps/chat`'s existing `attachment-dto-to-display.ts` becomes a thin wrapper that passes `resolveCatalogIconUrl` / `resolveDialFileDownloadUrl` as the resolvers, preserving today's app behavior exactly (catalog icon URLs, DIAL file download URL resolution).

This is the only design decision with a real library-isolation constraint: `resolveCatalogIconUrl` and `resolveDialFileDownloadUrl` construct app/server-api-owned URLs and must not move into `chat-shared`. The resolver-callback shape is exactly the "narrow interface" pattern AGENTS.md §Library isolation calls for.

Alternative considered: pass a single `resolveUrl(dto, kind: 'preview' | 'play')` callback instead of two named ones. Rejected — the two call sites (image preview, audio play) already use different app resolvers in `apps/chat`, so two named optional callbacks are more explicit and let `conversation-stages` opt into only the defaults without threading a discriminant.

`annotationToDisplayAttachment` (used for citation/annotation rendering) stays in `apps/chat` since it is not needed by `conversation-stages` and has no duplicate to consolidate.

## Risks / Trade-offs

- [Error mapper migration touches 15+ call sites across many domains] → Migrate and run `nx test chat-api` after each domain group (SDK-path group, then fetch-path group) rather than one big-bang swap; keep the old files until every call site is migrated and tests are green, then delete in the same task.
- [Path-encoder unification could silently change encoding for an undocumented edge case] → Add characterization tests against the *current* three encoders' outputs for a shared fixture set (empty path, single segment, nested paths, pre-encoded segments, unicode, `%2F` in a segment) before deleting any of them. Per-segment decode is resolved to `safeDecodeURIComponent`; tests guard against any latent divergence the code review did not catch.
- [Attachment mapper unification changes `conversation-stages` rendering (adds audio support, changes id fallback)] → This is an intended behavior fix, not a regression, but flag it explicitly in the PR description since it changes rendered output for a lib consumer; confirm with a snapshot/unit test on `StageItem` that audio attachments now render.
- [Optional `logger` param on the merged error mapper could be forgotten at new call sites, silently losing the intended logging-parity improvement] → Not enforced by the type system by design (some call sites, e.g. bucket dry-run helpers, may have no logger in scope); accepted as a soft goal, not a hard requirement.

## Migration Plan

Implement backend slice first (error mapper → path encoder → bucket validator), verify with `nx test chat-api` + `nx lint chat-api` after each, then the frontend/libs slice (chat-shared mapper → app adapter → conversation-stages migration), verified with `nx test @epam/ai-dial-chat-shared`, `nx test conversation-stages`, `nx test @epam/chat`. No feature flag or staged rollout needed — this ships as one internal refactor PR since all changes are same-behavior and covered by tests before merge. No user-facing rollback path is needed beyond a normal revert; there is no data migration.

## Open Questions

_(none — path-encoder decode helper resolved in Decision §2; characterization tests in task 2.1/2.2 verify, not decide)_
