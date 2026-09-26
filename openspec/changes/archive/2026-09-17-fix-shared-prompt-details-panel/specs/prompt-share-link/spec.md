## ADDED Requirements

### Requirement: An accepted prompt invitation reports the prompt's catalog id

`ShareInvitationService.acceptInvitation` SHALL return an `itemId` in the same
form the prompt listing endpoints report for that prompt — the decoded
`prompts/{bucket}/{path}` id `buildPromptId` produces — not the percent-encoded
resource url DIAL Core stores.

`share-resource.util.ts` SHALL own both directions of that conversion as a
matched pair: `toShareResourceUrl` encoding a prompt id for the DIAL Core call
boundary, and `toPublicItemId` decoding it back. `toPublicItemId` SHALL decode
per `/`-separated segment, so an encoded `%2F` inside a name cannot become a
path separator, and SHALL pass every non-prompt id through unchanged — the same
kinds `toShareResourceUrl` leaves alone.

The conversion SHALL apply only to the value returned to the caller. The
invitation peek, the accepting call, and `resolveSharedItemSummary` SHALL keep
using the raw upstream resource url, so decoding cannot change which DIAL Core
resource is addressed.

#### Scenario: A prompt id round-trips through the share link

- **WHEN** a prompt whose path contains a space is shared, and the invitation is later accepted
- **THEN** `acceptInvitation` returns the decoded id (`prompts/{bucket}/Work/tone of voice`), matching the `id` `GET /api/v1/prompts` reports for the same prompt

#### Scenario: Other resource kinds are unaffected

- **WHEN** an application, toolset, skill, or conversation invitation is accepted
- **THEN** `itemId` is the upstream resource url unchanged, and the `sharedDeployment`/`sharedToolset`/`sharedSkill` summaries are resolved exactly as before

### Requirement: Accepting an invitation refreshes the prompt list

`SharedInvitationPage` SHALL refetch prompts alongside deployments, toolsets,
and skills after accepting an invitation, before navigating to the shared item.

A prompt has no list-item summary to merge — `resolveSharedItemSummary` returns
no `sharedPrompt`, because a prompt has no deployments/toolsets list entry to
summarise — so the refetch is the only path by which a just-granted prompt
reaches `PromptsContext.sharedWithMe`, and therefore the catalog's item list.
The catalog opens the details panel only for an `initialDetailsItemId` it finds
among its items, so a redirect that lands before the refetch completes SHALL NOT
be relied upon.

No prompt list cache invalidation is specified server-side: unlike deployments
and toolsets, `PromptService` holds no list cache for `acceptInvitation` to
clear.

#### Scenario: A shared prompt link opens its details panel

- **WHEN** a recipient opens a prompt share link
- **THEN** the invitation is accepted, prompts are refetched, and the redirect to `/catalog?itemId={decoded prompt id}` opens that prompt's details panel

#### Scenario: The refetch runs for every resource kind

- **WHEN** any invitation is accepted, prompt or not
- **THEN** the prompts refetch is part of the same post-accept batch as the deployments, toolsets, and skills refetches
