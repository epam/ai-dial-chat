## Why

Issue #9003 is still partly open. PR #9092 made export and import strip, re-point and drop every attachment reference in `messages[].custom_content`. But a conversation also keeps the citation pool from #9002 in `customViewState.annotations`, and neither direction looks at it. QA reproduced the result on dev `1.2.0-dev.339`:

- **Stale references survive.** An export-all file, or a single "without attachments" export, still carries pool `body.source` references into the exporter's bucket.
- **Stripping the message unmasks the pool.** After import removes the foreign `source` from a message citation, `groupAnnotationsByCitId` (`libs/quotations/src/utils/group-annotations-by-source.ts`) skips that annotation. `buildCitGroupsByTagId` (`libs/quotations/src/utils/citation-injection.ts`) then resolves the `<cit>` from the stale pool group. A citation the warning listed as skipped still opens the exporter's file, and the user gets a 403.
- **The `.dial` path breaks too.** It does not bundle files that only the pool references, and import never rewrites pool URLs. A cross-turn citation (#9002) therefore gets a 403 even after a single export with attachments, which is the scenario the issue reports as working.

## What Changes

- The transfer reference walk (`forEachAttachmentReference`, `libs/chat-hooks/src/conversation/conversation-transfer/attachment-refs.ts:73`) also visits each entry of `customViewState.annotations`. As a result, `.dial` export bundles files referenced only by the pool, and import uploads them.
- `stripConversationAttachments` (export-all and single without-attachments) removes `body.source` from each pool entry. It keeps the entry's quote, title and target, and every other `customViewState` key.
- `rewriteAttachmentUrls` re-points pool `body.source.attachment` references to the uploaded locations. Like the message sites, it keeps the anchor and applies a suffixed `title`.
- `dropForeignAttachmentRefs` removes a foreign pool `source` and reports the file name in the skipped-attachment warning. The job's existing name `Set` (`useConversationImport`) already deduplicates names, so a file cited both in a message and in the pool is listed once.
- The pool is untrusted persisted JSON. A non-array value, a `null` entry or a non-object entry is left untouched rather than thrown on.
- The `conversation-custom-view-state` spec narrows its "no library reads `customViewState`" rule. The rule now forbids rendering libraries from reading the pool. It makes an explicit exception for `libs/chat-hooks` conversation transfer, which already owns the persisted conversation format. The rule's grep scenario is already false today, because `libs/chat-shared/src/models/chat.ts` declares the field. The spec now says so.

Not breaking: no public API, prop or export file format changes. Old export files import as before, with more stale references removed. To roll back, revert the commit.

### Non-goals

- `replay.replayUserMessagesStack`: a legacy field the domain `Conversation` does not model. It stays an opaque passthrough.
- Agent `custom_content.state`: opaque agent data with no reliable file-reference shape.
- The share flow (`apps/chat-api/src/share/utils/share-resource.util.ts`) does not grant access to files referenced only by the pool. That is the same root cause in a different flow, tracked as a separate issue.
- Bulk export with attachments stays out of scope.

### Alternatives considered

- **Host-injected pool visitor** (apps/chat passes strip/rewrite/drop callbacks): this keeps the field name out of libs. Rejected: every host would have to wire it, or the bug comes back, and the hooks' API grows to serve one field.
- **Shape-based walk over every `customViewState` key**: this avoids naming `annotations`. Rejected: it is a heuristic, and it would touch keys the view-state spec declares opaque.

### Acceptance criteria

- A conversation exported through export-all or "without attachments" contains no `files/…` reference under `customViewState.annotations`. All other `customViewState` keys are unchanged.
- A `.dial` export of a conversation whose pool references a file no message references contains that file under `res/…`. After import, the pool points at the uploaded copy.
- Importing a `.json` file whose pool references another user's bucket saves the conversation without that pool `source` and names the file once in the warning. Clicking the citation does not request the foreign file.
- Unit tests cover all four walks, including a file referenced only by the pool and a malformed pool. `npm run validate:specs` passes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversation-export`: the without-attachments and export-all modes also strip pool citation sources, and the `.dial` mode also bundles files referenced by the pool.
- `conversation-import`: rewrite and drop also cover `customViewState.annotations[].body.source.attachment`.
- `conversation-custom-view-state`: the library-isolation rule for `customViewState` gets an explicit exception for conversation transfer in `libs/chat-hooks`, and the contradicted grep scenario is replaced.

## Impact

- **Code**: `libs/chat-hooks/src/conversation/conversation-transfer/` (`attachment-refs.ts`, `export-conversation.ts`, `import-conversation.ts`) and their specs under `tests/`. `useConversationExport`/`useConversationImport` already call these helpers, so their wiring is unchanged.
- **Library isolation**: everything stays inside `libs/chat-hooks` and operates on the domain `Conversation` from `@epam/ai-dial-chat-shared`. No REST path, client construction or host context enters the lib. `libs/quotations` still never sees `customViewState`.
- **Backend / API / OpenAPI**: none.
- **i18n**: no new strings. Dropped pool files reuse `conversationImport.warningAttachmentSkipped`.
- **RTL / a11y / feature flags / telemetry**: none.
- **Docs**: `libs/chat-hooks/README.md` only if it lists the reference sites; checked during apply.
