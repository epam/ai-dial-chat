# Spec Delta

## Purpose

Defines the endpoint that reports the publication status of every saved version of an application or toolset, so the Versions history can show Not published, In review or Published without adding publication lookups to the catalog listings.

## ADDED Requirements

### Requirement: Version statuses endpoint

The backend SHALL expose `GET /api/v1/catalog/{entityType}/{entityId}/version-statuses`, URI-versioned like the sibling `publish-history` route, for an authenticated user. It SHALL return an array with one entry per version in the entity's version group, each carrying `id`, `version`, `status` (Not published, In review, Published, or unknown), `publishedFolders` (the target folders of a published version, empty otherwise) and `publishedBy` (the publisher's display name of a published version, absent otherwise):

```json
[
  { "id": "applications/abc/Design/Review__1.0.0", "version": "1.0.0", "status": "published", "publishedFolders": ["Organization/Design"], "publishedBy": "Jane Doe" },
  { "id": "applications/abc/Design/Review__1.1.0", "version": "1.1.0", "status": "in-review", "publishedFolders": [] },
  { "id": "applications/abc/Design/Review__2.0.0", "version": "2.0.0", "status": "not-published", "publishedFolders": [] }
]
```

The wire values of `status` are `published`, `in-review`, `not-published` and `unknown`. The group SHALL be resolved from the deployments listing (applications) or the toolsets listing (toolsets): the items sharing the entity's `versionGroupId` and owner bucket, read through the existing cached listing without an extra DIAL Core call. `version` SHALL be the item's `displayVersion`; clients join statuses to their rows by `id`.

Errors: `400` for an invalid `entityType` or `entityId` (same allowlist validation as `publish-history`), `401` without a session, `404` when no version of the entity exists in the listing, `502` when DIAL Core returns an error, `503` when DIAL Core is unavailable or times out. The OpenAPI operation SHALL be `getCatalogVersionStatuses`, with a response DTO class (`VersionStatusEntryDto`), called by the frontend through the normal generated method via a thin wrapper in `apps/chat/src/server-api/`.

The endpoint SHALL be called when a panel that shows the Versions history opens, never from the catalog.

#### Scenario: Statuses for every version of the group
- **WHEN** the caller requests statuses for an application that has three saved versions
- **THEN** the response has three entries, each with its own `id`, `version`, `status` and `publishedFolders`

#### Scenario: Never-published private resource
- **WHEN** none of the versions was ever published
- **THEN** the response is `200`, every entry is Not published with an empty `publishedFolders`, and no error is raised

#### Scenario: Unknown entity
- **WHEN** no version of the requested entity exists in the listing
- **THEN** the response is `404`

### Requirement: Status mapping

For each version, the status SHALL be derived from the publications whose source resource url is that version's resource url:

- no matching publication, a `Rejected` publication, or an approved removal (`action: 'DELETE'` with `Approved` status, as defined for `publish-history`) SHALL map to Not published;
- a `Pending` publication SHALL map to In review;
- an `Approved` publication SHALL map to Published, `publishedFolders` SHALL list its target folders without Core's `public/` prefix and trailing slash, in the form `publish-history` returns, and `publishedBy` SHALL be the publication's display author, falling back to its author.

When a version has both a `Pending` and an `Approved` publication, Published SHALL win. A resource that is not in the caller's own bucket (shared with the caller) has its publications in the owner's bucket, which DIAL Core does not let a non-admin read, so each of its entries SHALL be returned with status unknown, an empty `publishedFolders` and no `publishedBy`; unknown SHALL NOT be presented as Not published. The Save panel opens only for the user's own resources, so this is a defensive path for the Publish panel and direct callers. A publication whose resource `action` is `ADD_IF_ABSENT` SHALL be treated like `ADD`.

#### Scenario: Pending request shows In review
- **WHEN** a version has one `Pending` publication
- **THEN** its status is In review

#### Scenario: Approved publication shows Published with folders and publisher
- **WHEN** a version has an `Approved` publication to `Organization/Design` by `Jane Doe`
- **THEN** its status is Published, `publishedFolders` is `["Organization/Design"]` and `publishedBy` is `Jane Doe`

#### Scenario: Rejected publication
- **WHEN** a version only has a `Rejected` publication
- **THEN** its status is Not published

#### Scenario: Approved removal
- **WHEN** a version has an `Approved` publication and a later approved `DELETE` removal for the same published copy
- **THEN** its status is Not published

#### Scenario: Shared resource
- **WHEN** the entity is owned by another user and shared with the caller
- **THEN** every entry has status unknown

### Requirement: Publications are read once per request

The service SHALL read the caller's own-bucket publication list from DIAL Core once per request and SHALL match every version's source resource url against it in one pass. It SHALL NOT call `publish-history` or re-read the list once per version. `Pending` publications SHALL be expanded for detail lookup in addition to `Approved` and status-less ones; this SHALL be a separate predicate for the statuses service, because `isDetailCandidate` in `apps/chat-api/src/publish/publication.util.ts` is shared with `publish-history`, which deliberately skips `Pending` and `Rejected`. Detail lookups SHALL keep the bounded concurrency and the drop-one-failed-lookup behavior defined for `publish-history`.

#### Scenario: One list read for many versions
- **WHEN** statuses are requested for an entity with ten versions
- **THEN** DIAL Core's publication list is read once, and `publish-history` behavior is unchanged

#### Scenario: One unreadable publication
- **WHEN** a detail lookup for one candidate publication fails
- **THEN** that publication is dropped and the request still succeeds

### Requirement: Version statuses cache and invalidation

The resolved own-bucket publications (the list plus the expanded details) SHALL be cached per user bucket under the key `publish:bucket-publications:{bucket}`, with a TTL equal to the one `publish-history` uses (60 s). The response itself SHALL NOT be cached: the version group is joined to the cached publications and to the cached listing on every call, so a version saved or deleted since the last call is reflected at once. Publishing or unpublishing any entity SHALL clear the bucket's entry, on the same paths that clear the `publish-history` entry. A decision made by an administrator (Pending to Approved or Rejected) does not pass through those paths, so a status can lag by up to the TTL.

#### Scenario: Publishing a sibling clears the cache
- **WHEN** version `B` is published while publications were cached after opening version `A`
- **THEN** the next statuses request, from either version, reflects `B`'s new status without waiting for the TTL

#### Scenario: A newly saved version has a status at once
- **WHEN** the user saves as new version `2.0.0` and a statuses request follows
- **THEN** the response includes `2.0.0` with status Not published

#### Scenario: Cache is per user
- **WHEN** two users request statuses for the same entity
- **THEN** each response is computed from, and cached against, the requesting user's own bucket

### Requirement: Authorization and logging

Any authenticated user MAY call the endpoint; the result is scoped to the caller's own bucket and the entity's own version group, so no extra role is required. The endpoint SHALL NOT log publication payloads, author names or tokens.

#### Scenario: Unauthenticated call
- **WHEN** the request has no valid session
- **THEN** the response is `401`
