# Spec: Prompt share links

## ADDED Requirements

### Requirement: `POST /api/v1/share` qualifies a bucket-relative prompt path

`CreateShareLinkDto` SHALL gain an optional `resourceKind?: ShareResourceKind` where `ShareResourceKind` has one member, `Prompt = 'prompt'`. It marks `itemId` as a bucket-relative path — the form the prompts endpoints return — rather than a full DIAL Core resource path.

When `resourceKind` is `Prompt`, `ShareService.createShareLink` SHALL build the DIAL Core resource url as `prompts/{callerBucket}/{itemId}`, taking the bucket from the caller's session (`SessionUser.bucket`, forwarded by the controller). When `resourceKind` is absent, `itemId` SHALL be passed through unchanged, so every existing caller behaves byte-identically.

An unrecognised `resourceKind` SHALL be rejected with `400` by the DTO before the service runs.

The invitation URL for a prompt SHALL use the catalog accept-invitation route, since prompts are surfaced in the catalog — the existing `conversations/`-prefix check already yields that outcome for a `prompts/…` url.

`resolveSharedItemSummary` SHALL return an empty summary for a `prompts/` itemId instead of attempting deployment or toolset resolution: a prompt has no entry in either list, so the lookup could only fail.

#### Scenario: A prompt path is qualified with the caller's bucket

- **WHEN** `createShareLink` is called with `itemId: 'Work/AI/summarize'`, `resourceKind: 'prompt'`, and a session bucket of `my-bucket`
- **THEN** DIAL Core's `shareResource` receives `resources: [{ url: 'prompts/my-bucket/Work/AI/summarize', permissions: ['READ'] }]`
- **AND** the returned url points at the catalog accept-invitation route

#### Scenario: A non-prompt itemId is untouched

- **WHEN** `createShareLink` is called with `itemId: 'applications/other-bucket/my-app'` and no `resourceKind`
- **THEN** DIAL Core receives that url verbatim

#### Scenario: An unknown resourceKind is rejected

- **WHEN** the request body carries `resourceKind: 'conversation'`
- **THEN** the response is `400`

#### Scenario: Accepting a prompt invitation resolves no list summary

- **WHEN** an accepted invitation's itemId starts with `prompts/`
- **THEN** the response carries neither `sharedDeployment` nor `sharedToolset`, and no deployment or toolset resolution is attempted

---

### Requirement: The frontend tags prompt share requests with the resource kind

`getShareLink` SHALL accept an optional `resourceKind` and forward it in the request body. `useShareLink` SHALL accept it too and include it in the memoised load callback's dependencies, so switching item or kind re-requests the link.

`SharePopoverContainer` SHALL pass `CreateShareLinkDtoResourceKindEnum.Prompt` for a `CatalogEntityType.Prompt` item and `undefined` for every other type. A prompt SHALL NOT offer edit access, since it is not in `EDITABLE_ACCESS_TYPES`.

`CatalogView.isShareVisible` SHALL return `true` for a Prompt item only when `item.isMyApp` is true.

#### Scenario: A prompt share request carries the resource kind

- **WHEN** the share popover opens for a prompt item
- **THEN** `useShareLink` is called with the prompt's id and `'prompt'`

#### Scenario: A deployment share request carries no resource kind

- **WHEN** the share popover opens for an agent item
- **THEN** `useShareLink` is called with the item id and `undefined`

#### Scenario: A prompt cannot be shared with edit access

- **WHEN** the share popover opens for a prompt item
- **THEN** `canEditAccess` is `false`, so the access control renders as a static label
