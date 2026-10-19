## Context

`duplicateConversation` splits the source path into `decodedFolderSegments` and a filename, builds `{deploymentKey}__{title}`, checks whether that path exists in the caller's bucket, appends `__{uuid}` on collision, and saves the body with `id` and `folderId` rewritten from the same segments. The parser (`parse-scheduled-task-conversation-path.ts`) decides "is a scheduled run" from the path alone: `.scheduler` right after the bucket, a valid schedule id, and a trailing UUID on the filename.

## Goals / Non-Goals

**Goals:** a copy of a run is an ordinary chat; no change to contracts or other flows.
**Non-Goals:** migrating existing bad copies, changing the parser or the host.

## Decisions

### D1. Strip in `duplicateConversation`, by segments

Right after `decodedFolderSegments` is computed, compute `destinationFolderSegments`: if `decodedFolderSegments[0] === SCHEDULER_SEGMENT` (from `apps/chat-api/src/conversations/constants/conversation.constants.ts`) and there is a second segment, use `decodedFolderSegments.slice(2)`; otherwise use it unchanged. Use `destinationFolderSegments` for the existence check, `decodedDestinationSubPath`, `encodedDestinationSubPath` and `folderId`. Keep deriving `isApplicationDeployment` from the source folder segments, because `isApplicationDeploymentPath` already skips the `.scheduler/{id}` prefix, and keep the source-read paths on the original segments.

*Why by segments and not by parser result:* a file under `.scheduler/{id}` that the parser would reject (no UUID) must not stay in the Scheduler's namespace either.

*Alternatives:* see the proposal table.

### D2. Where the copy goes

The bucket root, or `applications/{bucket}/{app}` for application runs. That is where an ordinary chat is created (`createConversation` uses `folderId = bucket`), and the panel is flat, so the copy appears like any other chat.

### D3. Collision handling unchanged

The existing rule (append a fresh UUID only when the clean path exists) now runs on the stripped path, so a copy that gets a UUID is at the root, outside `.scheduler`, and the parser never sees it.

### D4. Nothing else changes

Rename keeps paths; publish/unpublish build targets from a caller-chosen public folder and the resource name only (`conversation-publish.service.ts`); the three runtime users of `.scheduler` tolerate its absence (`libs/chat-hooks/src/conversation/get-model-id-from-conversation-id.ts` strips it only when present).

## Risks / Trade-offs

- [Copies made before the fix remain fake runs] → accepted; they cannot be identified reliably.
- [A saved body might carry scheduler-specific fields] → low risk: Core writes the run body and the DTO has no such field; covered by the manual check below.
- [Spec said folders are always preserved] → reworded in `auto-index-duplicate-names`; behavior for non-scheduler folders is unchanged.

## Migration Plan

Single commit, no data or API migration. Rollback by revert.

## Open Questions

None. The destination (bucket root) and the UUID suffix on collision were agreed with the requester in chat; product/QA confirmation happens on the PR.
