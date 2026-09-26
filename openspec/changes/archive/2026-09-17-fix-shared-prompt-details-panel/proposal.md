## Why

A prompt share link opens the Catalog page instead of the shared prompt's
details panel ([#8886](https://github.com/epam/ai-dial-chat/issues/8886)). The
invitation itself is accepted correctly — only the panel never opens. Two
independent defects both break the same hand-off, so fixing either alone leaves
the symptom in place:

1. **The redirect carries an id the catalog cannot match.** `createShareLink`
   stores a prompt's resource url percent-encoded
   (`toShareResourceUrl` → `encodeDialResourcePath`, the only kind that is
   re-encoded), so the invitation peek in
   `ShareInvitationService.acceptInvitation` reads back
   `prompts/{bucket}/Work/tone%20of%20voice`. The frontend's catalog item id for
   a prompt is the decoded form — `buildPromptId` is fed a path that
   `urlToPromptPath` has already decoded — so
   `Catalog`'s `items.find(item => item.id === initialDetailsItemId)` matches
   nothing and the effect returns without opening a panel. Every other resource
   kind passes its id through unchanged in both directions, so only prompts
   disagree.
2. **The prompt is not in the list yet.** `SharedInvitationPage` refetches
   deployments, toolsets, and skills after accepting, but never prompts. A
   prompt has no list-item summary to merge — `resolveSharedItemSummary`
   deliberately returns `{}` for a prompt id, because prompts have no
   deployments/toolsets list entry to summarise — so the refetch is the only way
   a just-granted prompt reaches `PromptsContext.sharedWithMe` and therefore the
   catalog's item list.

## What Changes

- **Backend**: `toPublicItemId` (new, in `share/utils/share-resource.util.ts`) is
  the inverse of `toShareResourceUrl` — it decodes a prompt id per path segment
  and passes every other kind through unchanged. `acceptInvitation` applies it
  to the `itemId` it returns, so the response reports the same id the prompt
  listing endpoints report. The summary resolution keeps using the raw upstream
  url, since that is what its DIAL Core lookups expect.
- **Frontend**: `SharedInvitationPage` adds `refetchPrompts()` to the
  post-accept `Promise.all`, alongside the existing deployments/toolsets/skills
  refetches.
- **API contract**: only the `itemId` property description changes;
  `libs/chat-api-client` is regenerated for it. No shape, status code, or
  operation changes.

## Impact

**Backend (`apps/chat-api`)**

- `share/utils/share-resource.util.ts` — new `toPublicItemId`.
- `share/invitation/share-invitation.service.ts` — apply it on the accept
  response.
- `share/dto/accept-invitation-response.dto.ts` — `itemId` description states
  that a prompt path comes back decoded.

**Frontend (`apps/chat`)**

- `pages/SharedInvitation/SharedInvitation.tsx` — `usePrompts().refetchPrompts`
  joins the post-accept refetch. `PromptsProvider` already wraps `App` in
  `main.tsx`, so both invitation routes (catalog and conversation) are inside it.

**Tests**

- `share-invitation.service.spec.ts` — a prompt invitation returns the decoded id.
- `SharedInvitation.spec.tsx` — a prompt invitation refetches prompts and
  redirects with the decoded id.
- `ConversationSharedInvitation.spec.tsx` — mocks `PromptsContext`, since it
  renders the same page component.

**Not changed**

No cache invalidation is added: `PromptService` has no list cache to invalidate,
unlike the 30s deployments/toolsets caches `acceptInvitation` already clears.
No i18n, no RTL, no styling, and no new endpoint.

**Rollback**

Revert. Nothing is persisted and the endpoint shape is unchanged.

## Acceptance criteria

1. Accepting a prompt invitation returns an `itemId` equal to the `id` the
   prompt listing endpoints report for the same prompt, including for names
   containing spaces or other characters DIAL Core percent-encodes.
2. Accepting a prompt invitation refetches prompts before the redirect, so the
   granted prompt is in the catalog's item list when the redirect lands.
3. Recipient B opening A's prompt share link lands on the catalog with that
   prompt's details panel open.
4. Application, toolset, skill, and conversation invitations behave exactly as
   before — their ids are passed through unchanged and their summary merges are
   untouched.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **Decode on the backend + refetch prompts** (chosen) | Fixes both causes at the layer that owns each; the encode/decode pair sits in one file. |
| Decode in `SharedInvitationPage` before building the redirect | Rejected — puts DIAL Core's encoding rules in a page component, and leaves the BFF reporting an id no other endpoint reports. |
| Match loosely in `libs/catalog` (compare decoded ids) | Rejected — a lib would have to know a host resource-id encoding convention, and it would mask the same mismatch anywhere else it appears. |
| Resolve a `sharedPrompt` summary to merge, mirroring skills | Rejected — larger surface for this fix; a prompt refetch is cheap and DIAL Core reflects the grant immediately here. Worth revisiting only if a race is observed. |
