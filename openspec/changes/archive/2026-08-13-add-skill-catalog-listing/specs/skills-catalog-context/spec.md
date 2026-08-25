## ADDED Requirements

### Requirement: `SkillsContext` owns skill listing state

`apps/chat/src/context/SkillsContext.tsx` SHALL define a `SkillsContext`, a `SkillsProvider`, and a `useSkills` consumer hook. It is the only owner of skill listing state in the app; no component, mapper, or other context SHALL call `listSkills` directly.

The context value SHALL expose:

- `skills: SkillMetadataItemDto[]` — skills in the caller's own bucket.
- `publicSkills: SkillMetadataItemDto[]` — skills in the organisation bucket.
- `isLoading: boolean` — `true` until both listings have settled.
- `error: unknown` — the rejection reason of the most recent failed listing, or `null`.

The value SHALL be wrapped in `useMemo` over exactly those fields, so consumers do not re-render on unrelated parent renders.

The context SHALL expose no refetch callback. This change performs no skill mutation, so nothing would call one; an exported function no caller invokes is dead API. A later change that adds a mutation adds the refetch it needs alongside it.

`useSkills` SHALL throw a clear error (`'useSkills must be used within a SkillsProvider'`) when called outside the provider.

The provider SHALL NOT call `useTranslation`, read route params, or access `localStorage`. i18n keys needed: none — the context has no user-visible strings. RTL impact: none (no UI).

#### Scenario: Both listings resolve

- **WHEN** the provider mounts, the personal listing resolves two skills, and the organisation listing resolves one
- **THEN** `skills` has two entries, `publicSkills` has one, `isLoading` is `false`, and `error` is `null`

#### Scenario: Consumer hook outside the provider

- **WHEN** `useSkills()` is called from a component that is not inside `SkillsProvider`
- **THEN** it throws `'useSkills must be used within a SkillsProvider'`

#### Scenario: Context value identity is stable across unrelated re-renders

- **WHEN** the provider re-renders with no change to skills, loading, or error state
- **THEN** the context value is referentially identical to the previous render

---

### Requirement: Personal and organisation listings load independently

`SkillsProvider` SHALL issue both listings through `Promise.allSettled` so neither can block or hide the other:

- Personal: `listSkills({ bucket: <the caller's bucket>, path: '', recursive: true, limit: <page size> })`.
- Organisation: the same call against the literal bucket `public`.

The caller's bucket SHALL come from `UserProfile.bucket` via `useUser()`. When it is absent or an empty string, the personal listing SHALL be skipped rather than issued with an empty bucket.

While the profile is still loading (`AuthStatus.Loading`) and no bucket has arrived, neither listing SHALL be issued and `isLoading` SHALL stay `true`. Once the profile settles, the effect SHALL proceed even if no bucket resolved: the organisation listing runs alone and `isLoading` reaches `false`. `UserProfile.bucket` is optional, so gating solely on a non-empty bucket would leave the catalog's skeleton up forever in a deployment that never populates one.

A rejected listing SHALL set `error` and leave that namespace's array empty; the other namespace SHALL still populate. `isLoading` SHALL reach `false` regardless of either outcome.

The initial fetch SHALL run inside `useEffect` with a `cancelled` flag so no `setState` runs after unmount.

#### Scenario: Organisation listing fails, personal listing succeeds

- **WHEN** `listSkills` for the `public` bucket rejects and the personal listing resolves three skills
- **THEN** `skills` has three entries, `publicSkills` is empty, `error` is the organisation rejection reason, and `isLoading` is `false`

#### Scenario: Personal listing fails, organisation listing succeeds

- **WHEN** the personal listing rejects and the organisation listing resolves one skill
- **THEN** `publicSkills` has one entry, `skills` is empty, and `isLoading` is `false`

#### Scenario: Both listings fail

- **WHEN** both listings reject
- **THEN** both arrays are empty, `error` is non-null, and `isLoading` is `false`

#### Scenario: Profile still loading

- **WHEN** the provider mounts while the auth status is `Loading` and `user.bucket` is `undefined` or `''`
- **THEN** no `listSkills` request is issued and `isLoading` stays `true`

#### Scenario: Profile settles without a bucket

- **WHEN** the auth status settles to `Authenticated` but `user.bucket` is `''`
- **THEN** only the organisation listing is issued, `skills` is empty, and `isLoading` reaches `false`

#### Scenario: Unmount before the listings settle

- **WHEN** the provider unmounts before either listing resolves
- **THEN** no state update is attempted

---

### Requirement: Listings are recursive and follow `nextToken` under a bounded page cap

Each listing SHALL be issued with `recursive: true` so nested grouping folders are flattened in a single pass.

When a listing response carries a `nextToken`, `SkillsProvider` SHALL issue the next page with that token and concatenate the items, repeating until the response has no `nextToken` or a named constant `SKILL_LISTING_MAX_PAGES` (initially `10`) has been reached, whichever comes first.

When the page cap stops the loop before the listing is exhausted, the provider SHALL keep the items collected so far and emit a console warning naming the bucket and the page cap. It SHALL NOT silently present a truncated listing as complete.

#### Scenario: Multi-page listing is fully collected

- **WHEN** the personal listing returns page one with a `nextToken` and page two without one
- **THEN** `skills` contains the items from both pages, in order

#### Scenario: Page cap reached

- **WHEN** every response up to and including page `SKILL_LISTING_MAX_PAGES` carries a `nextToken`
- **THEN** the provider stops requesting further pages, keeps the items already collected, and logs a truncation warning naming the bucket

---

### Requirement: Grouping folders are excluded from the skill arrays

Entries whose `nodeType` is `folder` SHALL be filtered out of `skills` and `publicSkills`. Only entries with `nodeType: 'item'` — actual skills — SHALL be exposed by the context. Grouping folder structure reaches the UI through each skill's own `parentPath`, not as standalone entries.

#### Scenario: Listing mixes folders and skills

- **WHEN** a listing resolves three entries: two with `nodeType: 'item'` and one with `nodeType: 'folder'`
- **THEN** the corresponding context array has exactly the two `item` entries

---

### Requirement: The provider short-circuits when the feature is disabled

`SkillsProvider` SHALL read `useUiFeature(OverlayFeature.Skills)` and, when the feature is not enabled, SHALL issue no listing request at all, exposing empty arrays, `isLoading: false`, and `error: null`.

#### Scenario: Feature disabled

- **WHEN** `OverlayFeature.Skills` is not enabled and the provider mounts
- **THEN** no `listSkills` request is issued and the context exposes empty arrays with `isLoading: false`

---

### Requirement: The provider mounts once near the app root

`SkillsProvider` SHALL be mounted in `apps/chat/src/app/app.tsx` alongside the other catalog-facing providers (`DeploymentsProvider`, `PromptsProvider`), inside the authenticated tree so `user.bucket` is available, and SHALL NOT be mounted per-route or per-component.

#### Scenario: One provider instance

- **WHEN** the user navigates between the catalog route and a conversation route within one session
- **THEN** the provider is not remounted and the skill listings are not re-issued
