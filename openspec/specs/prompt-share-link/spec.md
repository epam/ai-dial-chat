# prompt-share-link Specification

## Purpose

Prompt share links end to end: how `POST /api/v1/share` qualifies a bucket-relative prompt path, how the frontend tags prompt share requests with the resource kind, and how accepting a prompt invitation hands the recipient's catalog an id and a list entry it can open.

## Requirements

### Requirement: The frontend shares a prompt like any other catalog item

`getShareLink` and `useShareLink` SHALL accept only the item's full resource id — the same `itemId` shape used for every other resource type. Neither accepts nor forwards a `resourceKind` parameter; that parameter, and the `ShareResourceKind`/`CreateShareLinkDtoResourceKindEnum` types it depended on, no longer exist (see `chat-hooks-sharing`).

`SharePopoverContainer` SHALL call `useShareLink` with `item.id` for every entity type, Prompt included, with no per-type branch to attach a resource kind.

`CatalogView.isShareVisible` SHALL return `true` for a Prompt item only when `item.isMyApp` is true.

A prompt SHALL offer edit access, the same as Agent/Skill/Toolset — `CatalogEntityType.Prompt` is a member of `EDITABLE_ACCESS_TYPES`. `ShareInvitationService.createShareLink` maps `ShareAccess.Edit` to DIAL Core's `['READ', 'WRITE']` permissions for any resource type, prompts included, so there is no backend restriction backing a view-only default.

#### Scenario: A prompt share request carries no resource kind

- **WHEN** the share popover opens for a prompt item
- **THEN** `useShareLink` is called with the prompt's full `id` and no `resourceKind` argument

#### Scenario: A deployment share request is handled identically

- **WHEN** the share popover opens for an agent item
- **THEN** `useShareLink` is called with the item's `id`, exactly as it is for a prompt item — neither call site passes a resource kind

#### Scenario: A prompt can be shared with edit access

- **WHEN** the share popover opens for a prompt item
- **THEN** `canEditAccess` is `true`, so the access control renders as the "Can view" / "Can edit" dropdown
- **AND** choosing "Can edit" requests a link whose access includes `Edit`, which `createShareLink` maps to DIAL Core permissions `['READ', 'WRITE']` on the prompt's own `prompts/{bucket}/{path}` id

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
