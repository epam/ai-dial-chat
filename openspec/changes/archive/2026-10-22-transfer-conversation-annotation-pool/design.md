## Context

`libs/chat-hooks/src/conversation/conversation-transfer/` owns every transformation export and import apply to a conversation's file references. There are four helpers:

| Helper | File | Used by |
| --- | --- | --- |
| `collectAttachmentRefs` (via `forEachAttachmentReference`) | `attachment-refs.ts` | `.dial` export (which files to download), `planAttachmentUploads` (which files to upload) |
| `stripConversationAttachments` | `export-conversation.ts` | single "without attachments" export, export-all |
| `rewriteAttachmentUrls` | `import-conversation.ts` | import, after uploads |
| `dropForeignAttachmentRefs` | `import-conversation.ts` | import, after the rewrite |

All four walk only `messages[].custom_content`, covering its `attachments`, `stages[].attachments` and `annotations[].body.source.attachment`. The citation pool `customViewState.annotations` (from #9002) is filled by the backend at every terminal save (`mergeHtmlTagAnnotationsIntoViewState` in `apps/chat-api/src/conversations/utils/conversation-view-state.server.ts`). Its entries are first-wins copies of message `html_tag` citations, and they are never removed. The helpers carry the pool through untouched.

How the pool causes a 403 after import:

1. Import removes a foreign `source` from a message citation.
2. `groupAnnotationsByCitId` skips any annotation without `body.source.attachment.url`, so the message has no group for that `data-id`.
3. `buildCitGroupsByTagId` lets a message's own groups override the pool. With no own group left, the pool group wins.
4. The pool group still points at the exporter's file, so the click gets a 403.

`useConversationImport` collects skipped and dropped names into one `Set` per job (`skippedAttachmentNames`). Names are therefore already unique per job.

## Goals / Non-Goals

**Goals:**
- Make the pool a fourth reference site with the same semantics as message citations in all four helpers. Covering it in the shared walk also makes upload planning pick it up.
- Stay robust to a malformed pool, because import makes the field attacker-controllable.
- Keep every other `customViewState` key byte-identical.

**Non-Goals:**
- `replay.replayUserMessagesStack`, agent `custom_content.state`, and share-flow coverage of the pool (see the proposal).
- Changing how the pool is written, grouped or rendered.

## Decisions

### D1. Handle the pool inside `conversation-transfer`, and amend the view-state spec

These helpers already own the persisted conversation format. They operate on the domain `Conversation` from `@epam/ai-dial-chat-shared`, which declares `customViewState`. The `conversation-custom-view-state` spec gets an explicit, narrow exception and an honest grep scenario.

*Alternatives:* (a) a host-injected visitor or strip/rewrite/drop callback. Every host would have to wire it or the bug returns, and the hooks' API grows to serve one field. (b) A shape-based walk over every `customViewState` key. This is a heuristic and would touch keys declared opaque. The user chose D1.

### D2. A single pool accessor, reused by every walk

Add a small module-private helper in `attachment-refs.ts`. It reads `conversation.customViewState?.['annotations']` and returns it only when `Array.isArray` holds. It also exposes an entry guard that accepts only non-null objects. An unrecognised entry is passed through by identity. Each walk reuses the existing per-annotation functions on the recognised entries:

- `forEachAttachmentReference` visits `entry.body?.source?.attachment` after the message loop. Message order stays first, which keeps upload planning and ` (n)` suffix allocation deterministic. Existing suffix assignments for message references do not change.
- `stripConversationAttachments` maps the pool through the same source-stripping as `stripAnnotationSources`.
- `rewriteAttachmentUrls` maps it through `rewriteAnnotations`.
- `dropForeignAttachmentRefs` maps it through `dropForeignAnnotationSources`, pushing into the same `droppedNames`.

Each helper rebuilds `customViewState` as `{ ...customViewState, annotations: mapped }` only when the pool is an array. The original object is returned otherwise. `rewriteAnnotations` and `dropForeignAnnotationSources` already return the same annotation when nothing applies, so their per-entry handling needs no change. The guard only has to keep non-object entries away from them: `annotation.body?.…` on a string is harmless, but a `null` entry would throw.

*Alternative:* a separate pool-specific implementation of each walk. Rejected because it duplicates logic that must stay in lockstep with the message sites.

### D3. Strip the source but keep the entry, rather than deleting pool entries

This mirrors the message citation path, so one helper serves both and the quote is preserved. A source-less entry is inert:

- `groupAnnotationsByCitId` skips it.
- The backend's `qualifyingAnnotationId` does not count it as known, so a later turn that cites the same id with a real source is appended and becomes the group.

*Alternative:* remove the entry, and the `annotations` key when the pool becomes empty. This is cleaner data but a separate code path, and it changes the shape of the object other code may already rely on.

### D4. No extra deduplication in `dropForeignAttachmentRefs`

`dropForeignAttachmentRefs` may push the same name twice, once for the message citation and once for its pool copy. The hook's per-job `Set` collapses it. A test at the hook level asserts the warning lists a name once. Changing the helper's return to unique names is optional and only cosmetic.

## Risks / Trade-offs

- **[A pool entry referencing a file in the user's own bucket keeps its source after a re-import]** → This is intended and matches message citations. The user can read their own files.
- **[Cross-turn citations lose their chip after export-all]** → Expected. Export-all deliberately ships no files. The `<cit>` stays unresolved, exactly like a stripped message citation today.
- **[Existing `.dial` archives exported before this change lack pool-only files]** → On import those references find no bytes, so `planAttachmentUploads` reports them as skipped and `dropForeignAttachmentRefs` removes them. The result is no 403 and a correct warning.
- **[The spec exception widens what a lib may know]** → It is scoped to `conversation-transfer` and to the `annotations` key, and the grep scenario pins the allowed files.

## Migration Plan

Frontend-only and stateless. No data migration. Previously saved imported conversations with stale pool references are not repaired; a re-import fixes them. Roll back by reverting the commit.

## Open Questions

None blocking. Follow-up issue to file: the share flow (`collectConversationResourceUrls`) should grant access to files referenced only by the pool.
