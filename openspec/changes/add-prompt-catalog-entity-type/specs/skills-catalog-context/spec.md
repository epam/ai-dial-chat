## MODIFIED Requirements

### Requirement: `SkillsContext` owns skill listing state

`SkillsContext` SHALL remain the app's single owner of catalog skill listing state. Its provider value SHALL expose personal `skills`, `sharedWithMe`, organisation `publicSkills`, `isLoading`, `error`, and a stable aggregate `refetchSkills` callback. The value SHALL be `useMemo`'d and the callback `useCallback`'d. No component or mapper SHALL call a bucket-specific list API to assemble the catalog.

#### Scenario: Aggregate response populates all arrays

- **WHEN** `listCatalogSkills()` resolves with two personal, one shared, and one public skill
- **THEN** the matching context arrays contain those values, `isLoading` is `false`, and `error` is `null`

#### Scenario: Consumer hook outside the provider

- **WHEN** `useSkills()` is called without a `SkillsProvider`
- **THEN** it throws `'useSkills must be used within a SkillsProvider'`

### Requirement: Personal and organisation listings load independently

The browser SHALL issue one `listCatalogSkills()` request after the user profile settles. The BFF, not `SkillsProvider`, SHALL isolate personal and organisation upstream failures. The provider SHALL set `error` only when the aggregate request rejects; a successful partial response has `error: null` and empty arrays for failed namespaces.

While auth status is `Loading`, the request SHALL not be issued and `isLoading` stays `true`. Once the profile settles, `listCatalogSkills()` SHALL run without a frontend bucket argument because the BFF resolves the session bucket. The initial effect SHALL use a cancelled flag to avoid state updates after unmount.

#### Scenario: Exactly one frontend request

- **WHEN** the profile settles and the feature is enabled
- **THEN** `SkillsProvider` calls `listCatalogSkills()` once and never calls `listSkills()` for personal or public buckets

#### Scenario: Partial BFF response is not a frontend error

- **WHEN** the BFF returns personal skills and an empty public array after an upstream public failure
- **THEN** the context exposes that response with `error: null`

#### Scenario: Aggregate request rejects

- **WHEN** `listCatalogSkills()` rejects
- **THEN** all arrays remain empty, `error` is non-null, and `isLoading` becomes `false`

### Requirement: Listings are recursive and follow `nextToken` under a bounded page cap

Recursive pagination SHALL move from the browser to `SkillsListingService`. The BFF SHALL request `recursive: true` with a page limit of at most `1000`, follow tokens until exhausted, and reject a repeated token. The frontend SHALL contain no page loop or page-cap constants and SHALL treat the aggregate response as complete.

#### Scenario: Multi-page namespace is fully collected server-side

- **WHEN** DIAL Core returns two skill metadata pages for the caller bucket
- **THEN** `listCatalogSkills()` includes items from both pages in `skills` and the browser made one request

#### Scenario: Repeated token fails closed

- **WHEN** DIAL Core repeats a non-empty continuation token
- **THEN** the BFF rejects that namespace rather than looping indefinitely

### Requirement: Grouping folders are excluded from the skill arrays

The BFF SHALL exclude `nodeType: 'folder'` entries from `skills`, `sharedWithMe`, and `publicSkills`. Grouping structure reaches the UI only through each skill's `parentPath`.

#### Scenario: Aggregate metadata mixes folders and skills

- **WHEN** a namespace contains two item entries and one grouping folder
- **THEN** its aggregate array contains exactly the two skills

### Requirement: The provider short-circuits when the feature is disabled

When `OverlayFeature.Skills` is disabled, `SkillsProvider` SHALL issue no `listCatalogSkills()` request and SHALL expose empty arrays, `isLoading: false`, and `error: null`.

#### Scenario: Feature disabled

- **WHEN** the provider mounts with Skills disabled
- **THEN** no aggregate request is issued
