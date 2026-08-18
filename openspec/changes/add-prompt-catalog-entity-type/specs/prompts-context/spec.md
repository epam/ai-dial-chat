## ADDED Requirements

### Requirement: `PromptsContext` owns all prompt and prompt-folder state

`apps/chat/src/context/PromptsContext.tsx` SHALL define a React Context following the `ThemeContext` reference pattern: `createContext<PromptsContextType | undefined>(undefined)`, a provider whose value is wrapped in `useMemo`, and a `usePrompts` consumer hook that throws a clear error when used outside the provider.

No prompt state SHALL be added to `DeploymentsContext`. Prompts share no lifecycle with deployments, and folding them in would re-render every deployment consumer on a prompt mutation.

The context value SHALL expose:

```ts
interface PromptsContextType {
  prompts: PromptResponseDto[];
  folders: PromptFolderResponseDto[];
  sharedWithMe: PromptResponseDto[];
  publicPrompts: PromptResponseDto[];
  publicFolders: PromptFolderResponseDto[];
  isLoading: boolean;
  error: unknown;
  refetchPrompts: () => Promise<void>;
  refetchPublicPrompts: () => Promise<void>;
}
```

The provider SHALL be mounted in `apps/chat/src/app/app.tsx` above every consumer (`CatalogView` and the `PromptEditor` route), alongside the existing app-level providers.

#### Scenario: Provider loads every prompt namespace on mount

- **WHEN** `PromptsProvider` mounts
- **THEN** it calls `listPrompts()` exactly once and does not call `listPublicPrompts()`
- **AND** `isLoading` is `true` until that aggregate request settles, then `false`
- **AND** `prompts`, `folders`, `sharedWithMe`, `publicPrompts`, and `publicFolders` hold the namespaces returned in the one response

#### Scenario: Consumer hook throws outside the provider

- **WHEN** `usePrompts()` is called from a component with no `PromptsProvider` ancestor
- **THEN** it throws an error naming `usePrompts` and `PromptsProvider`

#### Scenario: Context value is referentially stable

- **WHEN** the provider's parent re-renders without any prompt state changing
- **THEN** the context value object identity is unchanged and no consumer re-renders

#### Scenario: Unmount before fetch completes causes no state update

- **WHEN** `PromptsProvider` unmounts while `listPrompts()` is still in flight
- **THEN** the cancelled flag suppresses the state update and no setState-on-unmounted-component warning is emitted

---

### Requirement: The aggregate response degrades by namespace at the BFF boundary

`PromptsContext` SHALL make one aggregate `listPrompts()` request. The BFF SHALL isolate personal/shared and organisation listing failures before constructing that response: if one upstream namespace fails, the request still resolves with that namespace empty and the successful namespace populated. The context SHALL set `error` only when the aggregate request itself rejects, which occurs when the BFF cannot return any prompt namespace. `isLoading` SHALL reach `false` in every outcome.

#### Scenario: Organisation prompts fail, personal prompts still render

- **WHEN** the organisation upstream listing fails and the BFF resolves `listPrompts()` with personal/shared data and empty public arrays
- **THEN** `prompts` and `folders` hold the personal data
- **AND** `publicPrompts` and `publicFolders` are empty arrays
- **AND** `isLoading` is `false` and `error` is `null`

#### Scenario: Aggregate request fails

- **WHEN** both upstream namespace listings fail and `listPrompts()` rejects
- **THEN** every array is empty, `isLoading` is `false`, and `error` is non-null so the catalog can surface an error state instead of an empty state

#### Scenario: User has no prompts

- **WHEN** the aggregate list call resolves with every namespace empty
- **THEN** `error` is `null`, every array is empty, and the catalog renders its normal empty state rather than an error

---

### Requirement: Every mutation refetches rather than patching local state

After any successful create, update, delete, move, folder-create, folder-rename, or folder-delete, the caller SHALL invoke `refetchPrompts()` before treating the operation as complete. `refetchPublicPrompts` SHALL remain a compatibility alias of that same aggregate callback, not issue a second organisation-only request. The context SHALL NOT patch its arrays optimistically.

This is required for correctness, not simplicity: a folder rename rewrites the `id` of every prompt beneath it, and a folder delete removes all descendants. Reproducing that path arithmetic client-side would diverge from the backend, which is the authority on prompt paths.

#### Scenario: Folder rename updates every descendant prompt id

- **WHEN** `renamePromptFolder('Work/AI', { name: 'ML' })` succeeds and `refetchPrompts()` runs
- **THEN** `prompts` contains `Work/ML/summarize` and no longer contains `Work/AI/summarize`
- **AND** no descendant id was computed client-side

#### Scenario: Folder delete removes contained prompts from state

- **WHEN** `deletePromptFolder('Work/AI')` succeeds and `refetchPrompts()` runs
- **THEN** every prompt whose `folderId` started with `Work/AI` is absent from `prompts`

#### Scenario: Delete refetches instead of splicing

- **WHEN** `deletePrompt('summarize')` succeeds
- **THEN** the context state is replaced by a fresh `listPrompts()` result, not by removing the entry locally

#### Scenario: Failed mutation leaves state untouched

- **WHEN** `updatePrompt` rejects with a 409
- **THEN** no refetch is triggered and the context arrays are unchanged, so the UI still shows the pre-mutation truth

---

### Requirement: Non-functional contract for the prompts context

- **State ownership**: `PromptsContext` SHALL be the single owner of prompt list, folder list, shared-with-me, and organisation-prompt state. Details-panel content state stays panel-scoped inside `libs/catalog`'s `Catalog` component, per `catalog-item-details-fetch`. Editor form state stays local to `PromptEditor`.
- **Memoisation**: the context value MUST be `useMemo`'d on its constituent state; `refetchPrompts` MUST be `useCallback`'d and `refetchPublicPrompts` MUST reference that same callback, so consumers can list either as an effect dependency without re-triggering.
- **Feature flag**: the provider itself is not gated and performs the aggregate fetch when mounted. Consumption is gated by `OverlayFeature.Prompts` at the `CatalogView` and route level; disabling the feature hides prompt UI but does not change provider lifecycle.
- **i18n**: this capability introduces no user-visible strings; error presentation belongs to its consumers.
- **RTL / direction impact**: none — no UI is rendered by this capability.
- **Accessibility**: none directly; loading and error presentation belong to consumers.
- **Observability**: none beyond the shared API client's existing per-request logging. No new metrics.
- **Caching**: no client-side cache and no TTL. State lives for the provider's lifetime and is refreshed by explicit refetch. Rate limiting is a backend concern already covered by the prompts controller's `@Throttle` settings.

#### Scenario: Feature disablement hides consumers without changing provider ownership

- **WHEN** `OverlayFeature.Prompts` is disabled
- **THEN** no prompt item or editor route is exposed
- **AND** the root-mounted provider may still issue its single aggregate `/api/v1/prompts` request

#### Scenario: Refetch identity is stable across renders

- **WHEN** a consumer lists `refetchPrompts` in a `useEffect` dependency array
- **THEN** the effect does not re-run on unrelated provider re-renders
