## ADDED Requirements

### Requirement: Publish request accepts an optional publishCredentials flag

`PublishCatalogEntityDto` SHALL gain an optional `publishCredentials?: boolean` field, validated with `@IsOptional()` and `@IsBoolean()` and documented with `@ApiPropertyOptional`. It SHALL mean "publish this entity together with the publisher's own credentials for it", which DIAL Core honours by copying the credential onto the published copy so members of the organization use the entity without authorising individually.

`PublishController.publish` SHALL pass the field through to `PublishService.publish` unchanged; the controller SHALL NOT derive, infer, or override it. Whether the caller holds a credential at all is the frontend's decision (see `catalog-publish-flow`) — being signed in is exactly the state in which both `true` and `false` are legitimate, so the value carries the publisher's intent and nothing else.

`PublishService.publish` SHALL include `publishCredentials: true` on the single `ADD` resource of the `createPublication` body **only** when the flag is `true`, and SHALL omit the property entirely otherwise:

```ts
resources: [
  {
    action: 'ADD',
    sourceUrl,
    targetUrl,
    ...(publishCredentials ? { publishCredentials: true } : {}),
  },
];
```

This keeps the Core request byte-identical to the pre-change request for every caller that does not send the field, so no existing publication path can change behaviour.

The flag SHALL NOT affect authorization or the recorded actor. DIAL Core continues to derive the publication's `author` from the caller's bearer token, to enforce target-folder write access against it, and to hold the publication `PENDING` until an administrator approves it. This endpoint SHALL apply no role gate of its own: any caller who may publish the entity may set the flag.

No credential value SHALL ever appear in the request, the response, or any log line — only the boolean crosses the wire.

The unpublish endpoint SHALL NOT accept the field: a `DELETE` resource grants nobody anything.

OpenAPI operation `publishCatalogEntity` SHALL expose `PublishCatalogEntityDto.publishCredentials?: boolean`. Because the field is optional, the regenerated `libs/chat-api-client` SHALL stay source-compatible with request literals that omit it.

#### Scenario: Publish with shared credentials sets the flag on the Core resource

- **WHEN** an authenticated user with target-folder write access publishes a toolset with `publishCredentials: true`
- **THEN** the `createPublication` body's single `ADD` resource carries `publishCredentials: true`, and the endpoint returns 201

#### Scenario: Publish without the field sends the pre-change request

- **WHEN** a request body omits `publishCredentials` entirely
- **THEN** the `ADD` resource sent to Core has no `publishCredentials` property at all, exactly as before this change

#### Scenario: Explicit false is omitted rather than sent

- **WHEN** a request sends `publishCredentials: false`
- **THEN** the `ADD` resource sent to Core has no `publishCredentials` property

#### Scenario: Non-boolean value is rejected before Core

- **WHEN** a request sends `publishCredentials: "yes"`
- **THEN** the `ValidationPipe` returns 400 without calling Core

#### Scenario: The flag applies no additional authorization

- **WHEN** a non-administrator with target-folder write access publishes with `publishCredentials: true`
- **THEN** the request is accepted and forwarded to Core on exactly the same terms as a publish without the flag — Core's own write-access check and pending-approval lifecycle are the only gates

#### Scenario: Unpublish rejects the field

- **WHEN** an unpublish request body includes `publishCredentials`
- **THEN** the global `ValidationPipe`'s `forbidNonWhitelisted` returns 400, and the `DELETE` resource sent to Core is unchanged

### Requirement: Publish history reports whether each publication carried shared credentials

`PublishHistoryEntryDto` SHALL gain a required `publishCredentials: boolean` field, reporting whether that publication requested the publisher's credentials be shared. It SHALL be read from the `publishCredentials` property of the same resource the history narrowing already matches by `sourceUrl`, and SHALL default to `false` when Core omits the property — the field is always present in the response, never optional, so a frontend never has to distinguish "false" from "unknown".

`publication.util.ts` SHALL expose a helper alongside `getPublicationSourceAction` that reads the flag off that matched resource, and `PublicationResourceLike` SHALL gain the optional `publishCredentials?: boolean` property. The narrowing, the `DELETE`-cancellation rules, the bounded-concurrency detail lookups, and the caching behaviour of the history endpoint SHALL be otherwise unchanged.

The field reports what the publication **requested**, not what DIAL Core ultimately applied. Core is the authority on whether a credential was actually copied; this endpoint holds no publish state of its own and SHALL NOT assert more than the publication record says.

Response (200):

```json
[
  {
    "entityId": "toolsets/bucket-123/tool-abc123__1.2.0",
    "entityType": "toolset",
    "folderPath": "Organization/Data Science/Published models",
    "version": "1.2.0",
    "publishedAt": "2026-07-13T10:00:00.000Z",
    "publishedBy": "user@example.com",
    "publishCredentials": true
  }
]
```

#### Scenario: History reports a publication made with shared credentials

- **WHEN** the entity's matched publication resource carries `publishCredentials: true`
- **THEN** that history entry reports `publishCredentials: true`

#### Scenario: History reports a publication made without shared credentials

- **WHEN** the entity's matched publication resource carries `publishCredentials: false`
- **THEN** that history entry reports `publishCredentials: false`

#### Scenario: A publication predating the field reports false

- **WHEN** Core returns a matched resource with no `publishCredentials` property at all
- **THEN** that history entry reports `publishCredentials: false` rather than omitting the field

#### Scenario: The new field does not change history narrowing

- **WHEN** publish history is read for an entity with a mix of `ADD` and approved `DELETE` publications
- **THEN** the set of entries returned, their order, and their folder paths are exactly what they were before this change — only the extra field is added to each entry
