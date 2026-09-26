**Slicing strategy: contract-first, then risk-first.**

The data contract (`customViewState` + generated client) is agreed in slice 1
because the backend writer and the frontend reader both depend on it and can
then proceed independently. Slice 2 takes the highest-risk piece next — the
fallback lookup inside `useCitationMarkdownComponents`, where a naive merge
silently corrupts unrelated messages' marker positions (design D6) — and
proves it with a byte-identical `processedContent` test before anything is
built on top. Slice 3 (backend writer) and slice 4 (frontend reader) then
close the loop end to end.

No new HTTP endpoint is introduced: `customViewState` rides the existing
`saveConversation` / `getConversation` operations. The OpenAPI tasks below
exist because the *shape* of an existing response DTO changes.

## 1. Contract: the `customViewState` field

- [x] 1.1 Add `customViewState?: Record<string, unknown>` to the
      `Conversation` interface in
      `libs/chat-shared/src/models/chat.ts`, with a JSDoc line stating it is
      an open, feature-keyed container and that this change owns only the
      `annotations` key.
- [x] 1.2 Add `customViewState?: Record<string, unknown>` to
      `ConversationResponseDto` in
      `apps/chat-api/src/openapi/openapi-response.dto.ts`, decorated
      `@ApiPropertyOptional({ type: 'object', additionalProperties: true })`
      with a `description`, placed alongside `llmNamingDone` and following
      `apps/chat-api/AGENTS.md` §DTO conventions. Do not add nested
      validation to `SaveConversationBodyDto` — design D1 records why its
      bare `@IsObject()` stays as is.
- [x] 1.3 Update `libs/chat-shared/README.md` where the `Conversation` model
      is documented, per `.claude/rules/docs.md` (a public model gains a
      field in the same change).
- [x] 1.4 Run `npm run openapi` and `npm run openapi:check`; confirm
      `libs/chat-api-client/openapi.json` and the regenerated
      `ConversationResponseDto` carry the field. Do not hand-edit generated
      files.
- [x] 1.5 Build and lint the generated client:
      `npm exec nx build chat-api-client` and
      `npm exec nx lint chat-api-client`.

**Verification**

```sh
npm run openapi && npm run openapi:check
npm exec nx build chat-api-client && npm exec nx lint chat-api-client
npm run validate:docs
```

No existing API singleton change is needed in
`apps/chat/src/server-api/api-client.ts` — `conversationsApi` already exists
and no new operation is added.

## 2. Risk-first: fallback `data-id` resolution in `libs/quotations`

- [x] 2.1 Add an optional trailing `fallbackGroups: AnnotationGroup[] = []`
      parameter to `useCitationMarkdownComponents` in
      `libs/quotations/src/hooks/useCitationMarkdownComponents/useCitationMarkdownComponents.tsx`.
      Build a second `Map` from it (or extend `citGroupsByTagId` so message
      groups are inserted *after* pool groups and therefore overwrite them —
      pick one and document it inline). Consult it only when the message's
      own map misses.
- [x] 2.2 Leave `processedContent` computed from `groups` alone. Do **not**
      pass `fallbackGroups` to `injectCitationSentinels` — design D6 records
      why this corrupts marker offsets.
- [x] 2.3 Extend the empty-overrides fast path so it is taken only when
      `groups` is empty, `fallbackGroups` is empty, and the content has no
      `<cit` markup; otherwise a pool-only match gets no `cit` override.
- [x] 2.4 Add the new parameter to the `useCitationMarkdownComponents`
      section of `libs/quotations/README.md`, including a corrected usage
      example (`.claude/rules/docs.md`: every code fence must compile against
      the current API).
- [x] 2.5 Extend
      `libs/quotations/src/hooks/useCitationMarkdownComponents/tests/useCitationMarkdownComponents.spec.tsx`
      with the delta spec's new scenarios: pool-only id resolves to a
      dropdown; message group wins a colliding id; `processedContent` is
      byte-identical with an empty vs. a three-group pool alongside an
      offset-based group; a pool-only match still produces a `cit` override;
      an id in neither place stays literal text. Name tests by observable
      behaviour and query by role/label/text.
- [x] 2.6 Architecture guard: confirm the diff in `libs/quotations` adds no
      `/api` path, no `server-api` or generated-client import, no app
      context, no env/feature-flag/storage/auth access, and no reference to
      the name `customViewState`. The parameter carries plain
      `AnnotationGroup` data only (AGENTS.md §Library isolation).

**Verification**

```sh
npm run test:file -- libs/quotations/src/hooks/useCitationMarkdownComponents/tests/useCitationMarkdownComponents.spec.tsx
npm run verify:changed
```

## 3. Backend: accumulate into `customViewState` on the terminal save

- [x] 3.1 Create
      `apps/chat-api/src/conversations/utils/conversation-view-state.server.ts`
      exporting a pure
      `mergeHtmlTagAnnotationsIntoViewState(current: Record<string, unknown> | undefined, annotations: AnnotationDto[] | undefined): Record<string, unknown> | undefined`.
      It filters to `html_tag` selectors carrying both a selector `id` and a
      `body.source.attachment.url`, deduplicates by `id` keeping the first
      entry, appends new entries in arrival order, preserves every other key
      of `current`, returns a new object (no mutation), and returns
      `current` unchanged when nothing qualifies. Use extensionless relative
      imports. Reuse nothing from
      `apply-chunk-annotations.server.ts`'s `mergeAnnotations` — design D4
      records why the two identity rules stay separate.
- [x] 3.2 Add `apps/chat-api/src/conversations/utils/conversation-view-state.server.spec.ts`
      covering: first write creates the key; a duplicate id is discarded and
      the original object kept; unrelated keys survive; offset-only
      annotations produce no key and leave an absent `customViewState`
      absent; a `null`/malformed entry is skipped without throwing.
- [x] 3.3 In `finalize` in
      `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`,
      call the helper while building `finalConversation` so the merged state
      is part of the single existing `persistenceService.saveConversation`
      call. Wrap the helper call so a throw degrades to saving without the
      update plus a `this.logger.warn`, matching how `finalize` already
      tolerates a failed save. Do not add a second save and do not move the
      `beginFinalizing` fence.
- [x] 3.4 Extend
      `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`:
      a `Done` generation writes the message's `html_tag` annotations into
      `customViewState.annotations`; a re-cited id is not duplicated across
      two generations; an unrelated `customViewState` key survives; a
      `Stopped` generation still contributes; `saveConversation` is still
      invoked exactly once by `finalize`; a throwing merge still saves the
      messages and logs a warning.

**Verification**

```sh
npm run test:file -- apps/chat-api/src/conversations/utils/conversation-view-state.server.spec.ts
npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts
npm exec nx lint chat-api
npm run verify:changed
```

No supertest task: no controller is added or changed — the field travels on
the existing `saveConversation` body, whose DTO gains a documentation-only
property (task 1.2).

## 4. Frontend: derive the pool and wire it through

- [x] 4.1 Create
      `apps/chat/src/hooks/conversation/useConversationAnnotationPool.ts`
      with JSDoc explaining *why* it exists (an agent message can cite a
      source annotated in an earlier turn). It reads
      `conversation.customViewState?.annotations`, defensively filters
      untrusted persisted JSON (non-array → empty; skip `null` entries and
      entries without an `html_tag` selector), groups with
      `groupAnnotationsByCitId` from `@epam/ai-dial-quotations`, memoises on
      `conversation.customViewState`, and returns a module-level shared
      `EMPTY_POOL` constant when there is nothing — design D5 records why
      reference stability matters here.
- [x] 4.2 Add
      `apps/chat/src/hooks/conversation/tests/useConversationAnnotationPool.spec.ts`
      covering: a well-formed pool becomes one group per id; a string, a
      `null` entry, and a selector-less entry are ignored without throwing;
      an absent `customViewState` yields the shared empty array; the return
      value is reference-identical across a re-render with unchanged input.
- [x] 4.3 In
      `apps/chat/src/components/ConversationView/ConversationView.tsx`, call
      the hook with the `conversation` prop it already receives and pass the
      result to `ConversationMessageItem` as a new prop (e.g.
      `fallbackCitationGroups`). Touch nothing else in this file.
- [x] 4.4 In
      `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`,
      accept the prop, pass it as the new trailing argument to
      `useCitationMarkdownComponents`, and build a memoised
      `[...citationGroups, ...fallbackCitationGroups]` union used **only** by
      `handleCitationPreview` and `handleCitationOpenInBrowser` so
      `annotationToPdfCanvasContent` / `annotationToOoxmlCanvasContent` can
      find a pooled annotation's siblings (design D7). Never pass the union
      as the hook's `groups`.
- [x] 4.5 Extend
      `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`:
      a message whose `<cit data-id>` resolves only from the pool renders an
      interactive citation marker rather than literal text; activating its
      Preview invokes the canvas with the pooled annotation's attachment;
      the same message with an empty pool still renders literal text.

**Verification**

```sh
npm run test:file -- apps/chat/src/hooks/conversation/tests/useConversationAnnotationPool.spec.ts
npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx
npm run verify:changed
```

No i18n task — this change introduces no user-visible string; it removes
literal markup that was never meant to be shown.

No RTL task — no new UI surface, no new directional class or icon. The
pool-resolved marker is the existing `CitationDropdown`, already covered.

No feature-flag task — the spec gates nothing behind `ENABLED_FEATURES` /
`ENABLED_FEATURES_ROLES`.

## 5. Docs and close-out

- [x] 5.1 Update `docs/architecture.md` if and only if the conversation data
      model or a cross-cutting mechanism it describes is affected by the new
      field; if it does not describe the conversation model's fields, record
      that no change is needed rather than inventing a section. No change
      needed: `docs/architecture.md` does not document `Conversation`'s
      fields (e.g. `llmNamingDone`/`responseFormat` are absent too), so
      `customViewState` needs no entry there.
- [x] 5.2 Run `npm run validate:docs` (touched two lib READMEs and a lib's
      public API).
- [x] 5.3 Run exactly one `npm run verify:full`. Result: 3781/3782 tests pass;
      the one failure (`http-lifecycle.integration.spec.ts`, telemetry) and
      the one failed build (`attachment-canvas-consumer-fixture`, a
      `@tabler/icons-react` module-resolution error in that fixture's Vite
      build) are both pre-existing/environment issues unrelated to any file
      this change touches (no conversations, `customViewState`, quotations,
      or chat-shared involvement).
- [x] 5.4 Run `npm run build:quiet` — the generated client changed, so
      bundling is affected. `@epam/chat` and `@epam/chat-api` build
      successfully; the only failure is the same pre-existing
      `attachment-canvas-consumer-fixture` `@tabler/icons-react` module-
      resolution error from 5.3, confirming it is an unrelated environment
      issue.

## 6. Follow-ups (out of scope, do not implement here)

- [x] 6.1 Record as a follow-up: convert
      `useCitationMarkdownComponents`'s five (now six) positional parameters
      to an options object. Design D6 notes the signature is at the edge of
      what positional arguments carry well; changing it now would break a
      published lib for no functional gain.
- [x] 6.2 Record as a follow-up: decide whether the pool needs an upper
      bound (design Open Question 1). Dedup by id already bounds it by
      distinct cited sources; no cap is added here.
