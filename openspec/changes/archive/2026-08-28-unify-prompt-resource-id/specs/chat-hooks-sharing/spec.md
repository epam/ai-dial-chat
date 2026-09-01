## MODIFIED Requirements

### Requirement: Share-link request lifecycle hook

`@epam/ai-dial-chat-hooks` SHALL export a hook (the generalized form of
`apps/chat`'s `useShareLink`) that owns a loading/error/stale-response-guard/
re-fetch state machine for creating a DIAL share link. The hook SHALL accept
an already-configured generated-client API instance capable of calling the
DIAL `createShareLink` operation, the resource's full DIAL Core resource path
as its identifier, and an initial access list (`ShareLinkAccess[]`, from
`@epam/ai-dial-share`). The hook SHALL NOT accept, forward, or reference a
resource-kind parameter — `CreateShareLinkDtoResourceKindEnum` and the
`ShareResourceKind` it mirrored no longer exist, because every resource's
identifier, prompts included, is already a self-sufficient full resource
path (see `prompts-api`, `prompt-share-link`). The hook SHALL NOT construct,
configure, or hold any base URL, auth header, or CSRF token itself — that
configuration is the caller's responsibility and is fully contained in the
client instance passed in.

The hook SHALL return `{ data: ShareLinkData | null, isLoading: boolean,
error: unknown, setAccess: (access: ShareLinkAccess[]) => void }`. Calling
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
- **THEN** `error` holds the rejection reason, `isLoading` becomes `false`,
  and `data` is left as it was before the failed call
