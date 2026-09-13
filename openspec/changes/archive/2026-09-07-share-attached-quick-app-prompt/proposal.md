## Why

Sharing a quick app (an application built on a quick-app schema) shares only the
application resource itself — the prompt attached to it as a `dial-prompt` skill
(`application_properties.skills[]`) is a separate DIAL Core prompt resource that never
receives a share grant. The recipient of the share link opens the app and hits
"Access denied to the prompt" every time (issue #8529).

`ShareService.createShareLink` already resolves related resources for conversations
(it walks a conversation's `custom_content` for `files/...` attachment urls and shares
them alongside the conversation). It does no such lookup for applications — the
`conversation-share` spec explicitly mandated "no related-resource lookup" for every
non-conversation kind. That left quick apps' attached prompts unshared.

## What Changes

- `ShareService.getRelatedResourceUrls` now dispatches by resource kind:
  - `conversations/` → existing file-attachment walk (extracted unchanged into
    `getConversationRelatedResourceUrls`).
  - `applications/` → new `getApplicationRelatedResourceUrls`: parses
    `applications/{bucket}/{path}` via `parseDialApplicationResource`, calls
    `getCustomApplication`, and collects the `url` of every
    `application_properties.skills[]` entry whose `type` is exactly `'dial-prompt'`.
  - everything else (toolsets, skills, models, prompts) → `[]`, proxied directly.
- Collected prompt urls are appended after the application in
  `shareResource.resources` with the same permissions as the app, so the recipient
  is granted access to both.
- Same cross-bucket rule as conversations: a referenced prompt whose bucket is
  neither the app's own nor the public/organization bucket is silently dropped
  (DIAL Core rejects mixed-owner share requests, and the caller cannot grant
  access to a prompt in another user's private bucket).
- `collectApplicationPromptResourceUrls` is a defensive pure helper that walks
  `application_properties` as an opaque `Record<string, unknown>` — it does not
  import the Quick Apps editor's `QuickApp2Config` type (which lives in the editor
  package, not this repo). A missing/malformed `skills` array yields no urls rather
  than throwing; an application read that returns no data degrades to app-only
  sharing rather than failing.

## Non-goals

- Sharing toolsets referenced by a quick app (`application_properties.tool_sets[]`).
  Same class of bug, but broader and more varied reference shapes; explicitly out
  of scope for #8529 and left for a follow-up.
- Any frontend change. The `POST /api/v1/share` request/response contract is
  unchanged; the server just resolves more related resources before proxying to
  DIAL Core.
- Any new endpoint or DTO.

## Acceptance criteria

- Sharing a quick app with one `dial-prompt` skill shares the app and the prompt
  with the same permissions.
- Multiple `dial-prompt` skills are shared once each (deduped, first-seen order);
  `type: 'custom'` and other skill kinds contribute nothing.
- A referenced prompt in another user's private bucket is omitted; the share
  still succeeds. A prompt in the `public` bucket is kept.
- The application pre-read is best-effort: if it rejects, returns an upstream
  error, or returns no data, the failure is logged as a warning and the app is
  shared alone (no related prompts, no failure). The pre-read never blocks
  sharing the app itself — before this lookup existed, an `applications/...`
  itemId could be shared as long as `shareResource` succeeded, and that baseline
  path stays intact.
- `collectApplicationPromptResourceUrls` is covered by direct unit tests pinning
  its defensive edge cases (non-array `skills`, non-object entries, non-string
  urls, non-prompt urls, absent `application_properties`, non-object application).

## Rollback / backward-compat

Non-breaking. The change only adds related resources to the share request DIAL Core
already accepts; it never removes or rewrites the application resource itself.
Reverting the single `getRelatedResourceUrls` dispatch restores the prior behavior
(applications shared alone).
