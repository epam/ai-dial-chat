# chat-hooks-prompts-state Specification

## Purpose

A reusable `usePromptsState` hook exported by `@epam/ai-dial-chat-hooks` that encapsulates the aggregate fetch-on-mount behavior of `PromptsContext`, with all server-api and context knowledge kept at the app edge.

## Requirements

### Requirement: `usePromptsState` reproduces `PromptsContext`'s aggregate fetch-on-mount behavior

`@epam/ai-dial-chat-hooks` SHALL export `usePromptsState(params: { listPrompts: () =>
Promise<PromptListResponseDto> })` returning `{ prompts, folders, sharedWithMe, publicPrompts,
publicFolders, isLoading, error, refetch, refetchPublicPrompts }`. On mount, the hook SHALL call the
injected `listPrompts` once and populate all five data slices from its resolved fields (each defaulting
to `[]` when a field is absent from the response). The hook SHALL NOT import a `server-api` module,
`react-i18next`, or an application Context.

#### Scenario: Mount performs exactly one aggregate fetch
- **WHEN** a component calls `usePromptsState({ listPrompts })` and mounts
- **THEN** `listPrompts` is called exactly once and all five data slices are populated from its response

#### Scenario: Absent optional collections default to empty arrays
- **WHEN** `listPrompts` resolves with `publicPrompts`/`publicFolders` omitted
- **THEN** the hook's `publicPrompts`/`publicFolders` are `[]`, not `undefined`

### Requirement: Loading and error semantics

`isLoading` SHALL start `true` and become `false` once the mount fetch settles, whether it resolves or
rejects. On rejection, `error` SHALL be set to the rejection value and every data slice SHALL retain its
prior (or default empty-array) value.

#### Scenario: Rejection settles loading without clearing prior data
- **WHEN** the mount fetch rejects
- **THEN** `isLoading` becomes `false`, `error` is the rejection value, and `prompts`/`publicPrompts`
  remain `[]`

### Requirement: Cancellation protection on unmount

The hook SHALL guard both its success and failure branches against a component unmounting before the
mount fetch settles, so no state update is attempted after unmount.

#### Scenario: Unmounting before the fetch settles causes no post-unmount state update
- **WHEN** the consuming component unmounts before `listPrompts` resolves or rejects
- **THEN** no state setter is called after unmount

### Requirement: Aggregate refetch and compatibility alias

The hook SHALL expose `refetch: () => Promise<void>` that re-calls `listPrompts` and replaces all five
data slices on success, or sets `error` (without touching the data slices) on failure. `refetchPublicPrompts`
SHALL be the same function reference as `refetch`, preserving the existing `PromptsContextType`
compatibility alias.

#### Scenario: Refetch replaces every namespace
- **WHEN** `refetch()` resolves with a fresh response
- **THEN** all five data slices are replaced from that response and `error` is cleared

#### Scenario: `refetchPublicPrompts` is the same function as `refetch`
- **WHEN** the hook's result is inspected
- **THEN** `result.refetchPublicPrompts === result.refetch`

### Requirement: Stable memoized result and callback identities

The hook's returned object SHALL be memoized so its identity is stable across renders that do not change
its underlying data, and `refetch` SHALL have a stable identity across renders (empty dependency array).

#### Scenario: Result identity is stable across an unrelated re-render
- **WHEN** the consuming component re-renders without any of the hook's state changing
- **THEN** the hook's returned object reference is unchanged

### Requirement: `PromptsContext` becomes a thin wrapper over `usePromptsState`

`apps/chat/src/context/PromptsContext.tsx` SHALL call `usePromptsState({ listPrompts })`, where
`listPrompts` is the existing `apps/chat/src/server-api/prompts.api.ts` function, and SHALL expose the
hook's result unchanged through the existing `PromptsContextType` interface. `usePrompts()`'s
outside-provider guard error and the provider's structure SHALL be unchanged.

#### Scenario: Existing consumers see no interface change
- **WHEN** `CatalogView`, `usePromptSelectorOverlay`, or `PromptEditor` calls `usePrompts()`
- **THEN** the returned shape and behavior match `PromptsContextType` exactly as before this change
