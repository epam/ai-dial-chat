## MODIFIED Requirements

### Requirement: Catalog details operations are injected into a headless controller

`@epam/ai-dial-chat-hooks` SHALL export a `CatalogDetailsApi` matching the exact
current app wrapper signatures for deployment details, deployment limits,
personal/shared/public prompt reads, skill-file download, skill-file listing,
and single-skill metadata. `useCatalogItemDetails` SHALL accept an already
configured instance and return stable `onFetchDetails`, `onLoadContentFile`, and
`onLoadSkillDetailsFile` callbacks.

The operation names SHALL be `getDeploymentDetails`, `getDeploymentLimits`,
`getPrompt`, `getPublicPrompt`, `downloadSkillFile`, `listSkillFiles`, and
`getSkillMetadata`, with their current parameter-object/positional conventions
preserved rather than normalized into a fabricated API. `getSkillMetadata`
SHALL be declared on the skill-scoped `SkillDetailsApi` port (which
`CatalogDetailsApi` extends), positionally shaped like its sibling
`downloadSkillFile`:

```ts
getSkillMetadata(
  bucket: string,
  path: string,
  signal?: AbortSignal,
): Promise<SkillMetadataItemDto>;
```

The host supplies it from `apps/chat/src/server-api/skills.api.ts`, so the
endpoint path, API version, generated-client instance, auth, and CSRF handling
all stay at the application boundary. Hosts that compose the port object SHALL
memoize it (`useMemo`) so callback identity stays stable and no detail-fetching
effect re-fires on an unrelated rerender.

The hook MAY use generated DIAL Core DTO types and operation signatures under
the existing `chat-hooks` exception, but SHALL NOT construct/configure a client,
know a base URL/auth/CSRF value, or import server-api, app contexts, i18n,
routing, notifications, storage, or rendered UI. Its current-skill ref SHALL be
private implementation state, not part of the returned public contract.

#### Scenario: Host supplies configured operations

- **WHEN** a host calls `useCatalogItemDetails` with an app adapter
- **THEN** all requests use that adapter and no import chain reaches
  `apps/chat/src/server-api` or client construction

#### Scenario: Callbacks remain stable

- **WHEN** the host re-renders with referentially unchanged options
- **THEN** all three returned callbacks retain their identities

#### Scenario: Metadata operation is injected, never constructed

- **WHEN** `libs/chat-hooks` is linted and type-checked
- **THEN** no source file contains the `/api/v1/skills/metadata` path, imports a
  generated API client instance, or configures a base URL, auth header, or CSRF
  token for the metadata request — the operation arrives only as the
  `getSkillMetadata` member of the injected port

#### Scenario: Port surface stays host-agnostic

- **WHEN** a host other than `apps/chat` implements `SkillDetailsApi`
- **THEN** `getSkillMetadata` can be satisfied with any function of
  `(bucket, path, signal?)` returning the metadata DTO, with no assumption about
  transport, routing, or app state
