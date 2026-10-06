# chat-hooks-sharing Specification

## Purpose

Reusable sharing hooks exported by `@epam/ai-dial-chat-hooks`: the share-link request lifecycle and a lazy, deduplicated share-recipients-count lookup, both driven by an already-configured generated-client API instance.

## Requirements

### Requirement: Share-link request lifecycle hook

`@epam/ai-dial-chat-hooks` SHALL export `useShareLink`
(`libs/chat-hooks/src/useShareLink/useShareLink.ts`, also re-exported from the
`@epam/ai-dial-chat-hooks/sharing` entry point), which owns a
loading/error/stale-response-guard/re-fetch state machine for creating a DIAL
share link. Its signature is `useShareLink(shareApi: Pick<ShareApi,
'createShareLink'>, itemId: string, origin: string = window.location.origin)`:
an already-configured generated-client `ShareApi` instance, the resource's
full DIAL Core resource path as its identifier, and the origin the returned
link is re-anchored to (DIAL Core's `url` is rebuilt as `origin` + its
path/search/hash). It takes no initial access list: the first request (on
mount and whenever `itemId` changes, which also clears `data`) uses
`[ShareLinkAccess.View]` (`ShareLinkAccess` from `@epam/ai-dial-share`). The hook SHALL NOT accept, forward, or reference a
resource-kind parameter — `CreateShareLinkDtoResourceKindEnum` and the
`ShareResourceKind` it mirrored no longer exist, because every resource's
identifier, prompts included, is already a self-sufficient full resource
path (see `prompts-api`, `prompt-share-link`). The hook SHALL NOT construct,
configure, or hold any base URL, auth header, or CSRF token itself — that
configuration is the caller's responsibility and is fully contained in the
client instance passed in.

The hook SHALL return `UseShareLinkResult` = `{ data: ShareLinkData |
undefined, isLoading: boolean, error: Error | null, setAccess: (access:
ShareLinkAccess[]) => void }`; a non-`Error` rejection is wrapped as
`new Error('Failed to create share link')`. Calling
`setAccess` SHALL trigger a re-fetch. Responses from a stale (superseded)
call SHALL be discarded and SHALL NOT overwrite `data`/`error` from a more
recent call.

#### Scenario: Successful link creation populates data

- **WHEN** a consumer renders the hook with a configured client instance
  whose share-link operation resolves to a value
- **THEN** `isLoading` becomes `true` during the call and `false` after, and
  `data` holds the resolved `ShareLinkData` with `error` remaining `null`

#### Scenario: Access change triggers re-fetch

- **WHEN** a consumer calls `setAccess` with a new `ShareLinkAccess[]` after
  the initial fetch has resolved
- **THEN** the hook calls the client instance's share-link operation again
  with the new access array and updates `data`/`isLoading` accordingly

#### Scenario: A prompt resource is requested the same way as any other

- **WHEN** a consumer renders the hook with a prompt's full `prompts/{bucket}/{path}` id as the resource identifier
- **THEN** the hook calls the client instance's share-link operation with that id and no resource-kind argument, identically to how it is called for an application, toolset, conversation, or skill id

#### Scenario: Stale response is discarded

- **WHEN** `setAccess` is called again before a previous in-flight call has
  resolved
- **THEN** the earlier call's eventual resolution SHALL NOT overwrite `data`
  or `error` — only the result of the most recently initiated call is
  reflected

#### Scenario: Fetch failure surfaces an error

- **WHEN** the client instance's share-link operation rejects
- **THEN** `error` holds the rejection (wrapped in an `Error` when it is not one), `isLoading` becomes `false`,
  and `data` is left as it was before the failed call

### Requirement: Share-recipients-count lazy lookup hook

`@epam/ai-dial-chat-hooks` SHALL export `useShareRecipientsCount(shareApi:
Pick<ShareApi, 'getShareRecipientsCount'>)`
(`libs/chat-hooks/src/useShareRecipientsCount/useShareRecipientsCount.ts`, also
re-exported from `@epam/ai-dial-chat-hooks/sharing`), which performs an
on-demand, deduplicated, per-resource-id lookup of a share's recipient count
against an already-configured generated-client `ShareApi` instance. The hook
SHALL own the exported string enum `RecipientsCountStatus` (`Idle = 'idle'`,
`Loading = 'loading'`, `Resolved = 'resolved'`, `Unknown = 'unknown'`).

The hook SHALL return `UseShareRecipientsCountResult` = `{
requestRecipientsCount: (itemId: string) => void, getRecipientsCount:
(itemId: string) => RecipientsCountEntry, invalidateRecipientsCount: (itemId:
string) => void }`, where `RecipientsCountEntry` is `{ status:
RecipientsCountStatus; count?: number }` and an id never requested reports
`RecipientsCountStatus.Idle`. A
given resource id SHALL be fetched at most once unless
`invalidateRecipientsCount` is called for that id; repeated `requestRecipientsCount` calls for the same
id before it resolves SHALL NOT trigger duplicate network calls.

#### Scenario: First request for a resource fetches and resolves

- **WHEN** a consumer calls `requestRecipientsCount(resourceId)` for an id it has not
  requested before
- **THEN** `getRecipientsCount(resourceId)` reports `RecipientsCountStatus.Loading` until the network
  call resolves, then `RecipientsCountStatus.Resolved` with the recipient count as
  `count`

#### Scenario: Duplicate request for an in-flight resource is deduplicated

- **WHEN** a consumer calls `requestRecipientsCount(resourceId)` twice for the same id
  before the first network call has resolved
- **THEN** the client instance's recipients-count operation is called
  exactly once for that id

#### Scenario: Failed fetch reports unknown status

- **WHEN** the recipients-count operation rejects for a given resource id
- **THEN** `getRecipientsCount(resourceId)` reports `RecipientsCountStatus.Unknown` and no `count` —
  matching `apps/chat`'s existing "unknown on error" behavior exactly

#### Scenario: Invalidate forces a re-fetch on next request

- **WHEN** a consumer calls `invalidateRecipientsCount(resourceId)` after that id has
  already resolved, and then calls `requestRecipientsCount(resourceId)` again
- **THEN** the recipients-count operation is called again for that id rather
  than returning the previously cached value
