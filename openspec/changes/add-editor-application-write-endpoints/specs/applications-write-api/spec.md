## ADDED Requirements

### Requirement: Application updates can be version-checked

`PATCH /api/v1/applications/{applicationName}` SHALL accept an optional `If-Match` request header and
forward it to `saveCustomApplication` (`ApplicationsService.updateApplication`, using
`apps/chat-api/src/common/utils/conditional-headers.ts`). When the stored application has moved on, Core
refuses the write and the BFF SHALL answer `412` (`PreconditionFailedException`) without writing.
Without `If-Match` the update SHALL stay unconditional, exactly as today. The `200` response
(`UpdatedApplicationDto`) SHALL carry the new version as `etag` when Core returns one:

```json
{ "id": "applications/bkt/loop__1.0.0", "etag": "\"v2\"" }
```

`GET /api/v1/deployments/{deployment}/details` SHALL carry, for an application read through
`getCustomApplication`, its version as `applicationDetails.etag`. The details stay cached as today
(`deployments:details:{sub}:{deployment}`, 60 s, invalidated by this user's update): a cached `etag`
names an older version, so an `If-Match` built from it answers `412`, which is the intended outcome.

Generated client: `ApplicationsApi.updateApplication({ applicationName, updateApplicationBodyDto, ifMatch })`
gains the optional `ifMatch` parameter (sent as the `If-Match` header);
`UpdatedApplicationDto.etag` and `ApplicationDetailsDto.etag` are new optional fields. Existing Chat
callers send no header and are unaffected. No UI, no i18n, no RTL impact; no feature flag.

#### Scenario: Version still current

- **WHEN** a client sends `PATCH` with `If-Match: "v1"` and the stored version is `"v1"`
- **THEN** the BFF SHALL save, and answer `200` with the new `etag`

#### Scenario: Changed elsewhere

- **WHEN** a client sends `PATCH` with `If-Match: "v1"` after another write moved the version to `"v2"`
- **THEN** the BFF SHALL answer `412` and nothing SHALL be written

#### Scenario: No version sent

- **WHEN** a client sends `PATCH` without `If-Match`
- **THEN** the BFF SHALL save unconditionally, as before
