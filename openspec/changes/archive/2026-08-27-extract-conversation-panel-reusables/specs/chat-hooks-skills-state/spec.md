## ADDED Requirements

### Requirement: `useSkillsState` reproduces `SkillsContext`'s gated fetch behavior without app-specific gating imports

`@epam/ai-dial-chat-hooks` SHALL export `useSkillsState(params: { listSkills: () =>
Promise<SkillCatalogListResponseDto>; enabled: boolean; ready: boolean })` returning `{ skills,
sharedWithMe, publicSkills, isLoading, error, refetch, mergeSharedSkill }`. The hook SHALL NOT import
`OverlayFeature`, `useUiFeature`, `UserContext`, or any app auth enum — `enabled` and `ready` SHALL be
computed by the caller and passed in.

#### Scenario: Hook has no feature-flag or auth import
- **WHEN** `libs/chat-hooks` is linted and type-checked
- **THEN** `useSkillsState`'s source file contains no import of `OverlayFeature`, `useUiFeature`, or
  `UserContext`

### Requirement: Disabled feature clears state without fetching

When `enabled` is `false`, the hook SHALL immediately set `skills`, `sharedWithMe`, and `publicSkills` to
`[]`, clear `error`, set `isLoading` to `false`, and SHALL NOT call `listSkills`.

#### Scenario: Disabling the feature clears all skill state
- **WHEN** `enabled` is `false`
- **THEN** all three data arrays are `[]`, `error` is `null`, `isLoading` is `false`, and `listSkills` is
  never called

### Requirement: Fetch waits for readiness before running

When `enabled` is `true` but `ready` is `false`, the hook SHALL NOT call `listSkills` and SHALL leave
`isLoading` as `true` until `ready` becomes `true`.

#### Scenario: Not-ready state defers the fetch
- **GIVEN** `enabled` is `true` and `ready` is `false`
- **WHEN** the hook is evaluated
- **THEN** `listSkills` is not called and `isLoading` remains `true`

#### Scenario: Becoming ready triggers the deferred fetch
- **GIVEN** `enabled` is `true` and `ready` transitions from `false` to `true`
- **WHEN** the hook re-evaluates
- **THEN** `listSkills` is called exactly once

### Requirement: Loading, error, and cancellation semantics match `PromptsContext`'s pattern

Once `enabled && ready`, the hook SHALL call `listSkills` once, populate `skills`/`sharedWithMe`/
`publicSkills` on success (clearing `error`), set `error` on failure (leaving prior array values), and set
`isLoading` to `false` in both cases. The hook SHALL guard against state updates after unmount.

#### Scenario: Fetch failure sets error without clearing arrays
- **WHEN** `listSkills` rejects
- **THEN** `error` is the rejection value, `isLoading` becomes `false`, and the three arrays retain their
  prior values

### Requirement: Aggregate refetch

The hook SHALL expose `refetch: () => Promise<void>` that re-calls `listSkills` and replaces all three
data arrays on success, or sets `error` on failure.

#### Scenario: Refetch replaces the skill snapshot
- **WHEN** `refetch()` resolves
- **THEN** `skills`, `sharedWithMe`, and `publicSkills` are replaced from the new response

### Requirement: `mergeSharedSkill` upserts by URL identity

The hook SHALL expose `mergeSharedSkill: (item: SkillMetadataItemDto) => void` that removes any existing
entry in `sharedWithMe` whose `url` matches `item.url`, then appends `item` — used to make a
backend-resolved shared item win over a possibly-stale concurrent refetch.

#### Scenario: Upsert replaces an existing entry with the same URL
- **GIVEN** `sharedWithMe` already contains an item with `url: "https://x/skill.md"`
- **WHEN** `mergeSharedSkill` is called with a new item carrying the same `url`
- **THEN** `sharedWithMe` contains exactly one entry for that `url`, the new one

#### Scenario: Upsert appends when the URL is new
- **WHEN** `mergeSharedSkill` is called with an item whose `url` is not already present
- **THEN** `sharedWithMe` gains that item without removing any existing entry

### Requirement: Stable memoized result and callback identities

The hook's returned object, `refetch`, and `mergeSharedSkill` SHALL each have a stable identity across
renders that do not change the underlying data.

#### Scenario: Callback identities are stable
- **WHEN** the consuming component re-renders without `enabled`/`ready`/data changing
- **THEN** `refetch` and `mergeSharedSkill` keep the same function reference

### Requirement: `SkillsContext` becomes a thin wrapper computing `enabled`/`ready`

`apps/chat/src/context/SkillsContext.tsx` SHALL compute `enabled = useUiFeature(OverlayFeature.Skills)`
and `ready = useUser().status !== AuthStatus.Loading`, call `useSkillsState({ listSkills, enabled,
ready })`, and expose the result unchanged through the existing `SkillsContextType` interface.

#### Scenario: Existing consumers see no interface change
- **WHEN** `CatalogView`, `useSkillArchiveImport`, `SkillEditor`, or `SharedInvitation` calls
  `useSkills()`
- **THEN** the returned shape and behavior match `SkillsContextType` exactly as before this change
