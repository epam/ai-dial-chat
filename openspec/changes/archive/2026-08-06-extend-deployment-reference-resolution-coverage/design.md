## Context

`findDeploymentByIdOrReference` (`apps/chat/src/utils/deployment-id.ts`) already resolves a deployment from either its `id` or DIAL Core `reference`, and was already wired into the deployment-list lookups (`ConversationView`, `ConversationPanelView`, etc. — see `deployment-reference-resolution`). This change closes two remaining gaps found while live-debugging one specific conversation:

1. Two REST call sites (`/configuration`, `/limits`) and one lib-facing prop (`selectedDeploymentId` fed into `libs/conversation-input`'s `useModelSelector`, which does its own plain `id`-only `.find()`) still received the raw, possibly-`reference` value instead of the already-resolved real `id`.
2. A separate, unrelated bug in `getModelIdFromConversationId` (used only to guess a deployment id from a conversation-list row's resource path, since the list endpoint doesn't return `model.id`) surfaced in the same session: it treated the reserved `.scheduler/{scheduleId}` path segment DIAL Scheduler writes conversations under as if it were part of the deployment id.

## Goals / Non-Goals

**Goals:**
- Every place that sends a deployment id to a REST endpoint or to `libs/conversation-input` uses the resolved real `id`, never the raw value that might be a `reference`.
- `.scheduler/{scheduleId}` is recognized and stripped before deployment-id extraction.
- The icon-tooltip fallback in `ConversationPanelView` degrades gracefully (short, readable) rather than showing a full guessed path when the guess can't be confirmed against the deployments list.

**Non-Goals:**
- Making `getModelIdFromConversationId` generally reliable for arbitrary real conversation folders mixed with multi-segment deployment ids — confirmed during this investigation to be fundamentally unrecoverable from the path alone (a real conversation folder and a deployment id's own `/`-segments are indistinguishable once encoded into the resource path). Fixing this properly would require the backend to return `model.id` directly on `GET /api/v1/conversations/list` items, which is out of scope here (documented as a known limitation, not fixed).
- Changing `libs/conversation-input`'s `useModelSelector` itself — per library isolation, the lib doesn't gain a reference-matching helper; the app layer instead passes it an already-correct `id`.

## Decisions

1. **Resolve at the boundary, not inside the lib.** Every fix in this change happens in `apps/chat/src/*` (context/components), passing an already-resolved real `id` downward. `libs/conversation-input` keeps its simple `id`-only match — it doesn't need to know DIAL Core's `reference` concept exists.
   - *Alternative considered*: teach `useModelSelector` a reference-aware matcher. Rejected — would leak an app/Core-specific concept (`reference`) into a host-agnostic lib, and the app already has the resolved deployment object in scope everywhere this matters.
2. **`.scheduler` stripping stays a literal, exact-match check.** `SCHEDULER_SEGMENT = '.scheduler'` mirrors the backend's own reserved constant (`apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts`) exactly — no heuristic guessing, since this is a backend-enforced reserved name that can't collide with a real folder/deployment segment.
3. **Fallback tooltip shows the last path segment, not the full guess.** When `findDeploymentByIdOrReference` can't find a match (deployment removed, or the guessed id was contaminated by real conversation-folder segments), showing the full percent-encoded path is actively misleading. Showing just the last segment (decoded) degrades to "best-effort short name" instead of "wrong full path."

## Risks / Trade-offs

- [Risk] `getModelIdFromConversationId` can still silently return a wrong multi-segment "id" when a conversation lives inside a real, arbitrarily-named folder (not just `.scheduler`) — the lookup will simply fail to match, and the row falls back to the last-segment tooltip and no icon. → Mitigation: this is the known, documented, accepted limitation (see Non-Goals); the fallback is now safe/graceful rather than confusing.
- No migration/rollback concerns — all changes are lookup/display-logic fixes with no data or API contract changes.
