# publish-panel-library Specification

## Purpose

The standalone publish-panel library: its public surface, and the independence from catalog models, i18n, and app context it must keep.

## Requirements

### Requirement: Public package surface exports the shared publish UI and state
`libs/publish-panel/src/index.ts` SHALL export exactly the symbols currently re-exported for publish by `libs/catalog/src/index.ts`, plus the new access-rules surface added by the access-rules editor: components `PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`, `PublishAccessRules`, `PublishAccessRuleEditor`; the `usePublishFlow` hook (its `UsePublishFlowOptions.onPublish` signature now `(item: TItem, folderPath: string[], rules: PublicationRule[], author: string) => Promise<void>`, `UsePublishFlowOptions` now also accepting an optional `onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>` and an optional `defaultAuthor?: string`, and `UsePublishFlowResult` now including `rules: PublicationRule[]`, `setRules: (rules: PublicationRule[]) => void`, `isRulesLoading: boolean`, `hasRulesLoadError: boolean`, `author: string`, and `setAuthor: (author: string) => void`); the pure functions `derivePublishState`, `formatPublishedDate`, and the `publish-folder-tree` helpers (`filterFolderTree`, `sortFolderTree`, `mergeFolderPaths`, `collectFolderKeys`, `toFolderPathKey`, `fromFolderPathKey`, `toDialFileTree`, `validateFolderName`, `getUniqueFolderName`, `getSiblingFolderNames`); and all associated types/interfaces (`PublishFolderNode`, `PublishHistoryEntry`, `PublishResourceSummary`, `PublishCalloutKind`, `PublishDerivationInput`, `PublishDerivedState`, `PublishFlowItem`, `UsePublishFlowOptions`, `UsePublishFlowResult`, `PublicationRule`, `PublicationRuleFunction`, every `*Texts`/`*Labels` and `*Props` interface, including the new `PublishAccessRulesProps`/`PublishAccessRuleEditorProps`/labels). Internal-only helpers (e.g. `PublishPanel.tsx`'s unexported `calloutVariant`/`calloutMessage`/`withBoldFolderName`) SHALL NOT be exported from the barrel.

#### Scenario: Consumer imports the publish panel from the new package
- **WHEN** `apps/chat` or `libs/catalog` code writes `import { StandalonePublishPanel, usePublishFlow } from '@epam/ai-dial-publish-panel'`
- **THEN** the import resolves successfully and yields the same component/hook behavior as before the move

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/publish-panel` attempts to import `calloutVariant` (or any other unexported internal helper) from `@epam/ai-dial-publish-panel`
- **THEN** the import fails to resolve, since the barrel does not re-export it

#### Scenario: New access-rules types and components are part of the public surface
- **WHEN** `apps/chat` code writes `import { PublicationRule, PublicationRuleFunction, PublishAccessRules } from '@epam/ai-dial-publish-panel'`
- **THEN** the import resolves successfully

#### Scenario: usePublishFlow's extended onPublish signature is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply an `onPublish` matching the new four-argument signature `(item, folderPath, rules, author) => Promise<void>`, and both read `rules`/`setRules` and `author`/`setAuthor` from the hook's return value to wire into `PublishPanel`'s controlled props

#### Scenario: usePublishFlow's onFetchExistingRules option is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply an `onFetchExistingRules` calling the shared `apps/chat/src/server-api/publish-rules.api.ts` wrapper, and both read `isRulesLoading`/`hasRulesLoadError` from the hook's return value

#### Scenario: usePublishFlow's defaultAuthor option is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply a `defaultAuthor` resolved by the host from the signed-in user's display name, with no session, claims, or context access inside the library
### Requirement: The library has no dependency on catalog domain models
`PublishPanel` and `StandalonePublishPanel` SHALL NOT import `CatalogItem`, `EntityHeader`, or any other symbol from `@epam/ai-dial-catalog`. `PublishPanel` SHALL accept an optional `renderSummary?: () => ReactNode` prop in place of the removed `item?: CatalogItem` prop; when `renderSummary` is provided, its return value SHALL render where the entity-header block previously rendered; when `renderSummary` is absent and `resource?: PublishResourceSummary` is provided, the existing title-only summary rendering SHALL apply unchanged. `StandalonePublishPanel` SHALL forward the same `renderSummary` prop through to `PublishPanel` without inspecting it. `usePublishFlow`'s generic type parameter default SHALL be `<TItem extends PublishFlowItem = PublishFlowItem>`, not `CatalogItem`.

#### Scenario: PublishPanel renders a caller-supplied summary
- **WHEN** a consumer renders `<PublishPanel renderSummary={() => <CustomHeader />} ... />`
- **THEN** `CustomHeader`'s output appears where the entity-header block previously rendered, with no reference to `CatalogItem` inside `PublishPanel` itself

#### Scenario: PublishPanel falls back to the resource summary
- **WHEN** a consumer renders `<PublishPanel resource={{ title: 'Q3 planning notes' }} ... />` without `renderSummary`
- **THEN** the panel renders the existing title-only summary row, matching current conversation-publish behavior

#### Scenario: Static analysis confirms no catalog import
- **WHEN** `libs/publish-panel/src/**` is searched for imports of `@epam/ai-dial-catalog` or relative paths into `libs/catalog`
- **THEN** no such import exists

### Requirement: The library has no dependency on i18n, server-api, or app-level context
All user-facing strings SHALL continue to be supplied via `*Texts` props with English-language defaults, exactly as `libs/catalog` implements this code today. The library SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/chat-api-client`, or any app-level React Context/provider (matching the library-isolation contract in AGENTS.md §Library isolation).

#### Scenario: No i18n import
- **WHEN** `libs/publish-panel/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed in via props

#### Scenario: No server-api or generated-client import
- **WHEN** `libs/publish-panel/src/**` is searched for imports from `apps/chat/src/server-api` or `@epam/chat-api-client`
- **THEN** none are found

### Requirement: The library builds as an independent Nx/Vite publishable project
`libs/publish-panel` SHALL define a `package.json` (`name: "@epam/ai-dial-publish-panel"`, `private: true`, `nx.tags: ["publishable"]`, `nx.targets.publish` running the shared `tools/publish-lib.mjs`), a `vite.config.mts` (React + `dts()` plugins, `build.lib` entry `src/index.ts` with `formats: ['es']`, peer dependencies externalized via `rollupOptions.external`, and `resolve.alias` entries for sibling libs it imports from in dev mode), and a `tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` triad — all scaffolded after `libs/conversation-input`'s equivalent files. `tsconfig.base.json`'s `compilerOptions.paths` SHALL register `"@epam/ai-dial-publish-panel/*": ["./libs/publish-panel/*"]`. A `README.md` SHALL document the package's purpose, public exports, and the `renderSummary` extension point.

#### Scenario: Library builds standalone
- **WHEN** `npm exec nx build publish-panel` is run
- **THEN** it succeeds and emits declaration files via `dts()`, independent of `libs/catalog`

#### Scenario: Path alias resolves for consumers
- **WHEN** `apps/chat` or `libs/catalog` source imports `@epam/ai-dial-publish-panel`
- **THEN** TypeScript and Vite resolve it via the `tsconfig.base.json` path alias without error

### Requirement: Moving the code preserves RTL and accessibility behavior unchanged
Since this is a structural extraction and not a behavior change, all RTL logical-property usage (`ms-*`/`me-*`, `start-*`/`end-*`, `rtl:-translate-x-full`) and existing accessibility semantics (dialog roles, `aria-live` regions, list semantics on `PublishHistoryList`, keyboard dismissal) already implemented on the moved components SHALL be preserved exactly as-is; the move SHALL NOT introduce new physical-direction classes or remove any existing ARIA attribute.

#### Scenario: RTL slide-in behavior is unchanged after the move
- **WHEN** `StandalonePublishPanel` is rendered with `dir="rtl"` on an ancestor, before and after the library move
- **THEN** it slides in from the same visual edge using the same `rtl:-translate-x-full` transform in both cases

#### Scenario: Accessibility attributes survive the move
- **WHEN** the moved components are inspected after relocation
- **THEN** every ARIA role/attribute present before the move (e.g. `PublishHistoryList`'s list semantics, the submit-error callout's `role="alert"`) is still present, unchanged

### Requirement: usePublishFlow reports the publish rejection reason to the host

`usePublishFlow`'s `handleSubmit` SHALL bind the rejection thrown by `onPublish` and pass it to a new optional option `onPublishError?: (item: TItem, folderPath: string[], error: unknown) => void`, the symmetric counterpart of the existing `onPublishSuccess`. A bindingless `catch` that discards the error SHALL NOT be used, since the rejection carries the only means of resolving the failed response's server message and trace ID ([GitHub issue #7898](https://github.com/epam/ai-dial-chat/issues/7898)).

`onPublishError` SHALL be called after `hasSubmitError` is set and before `handleSubmit` resolves to `false`. The hook SHALL NOT await the callback, so `isSubmitting` clears without waiting on host-side work such as parsing a response body; the callback's declared return type SHALL therefore be `void`.

The library SHALL NOT itself display a notification, toast, or any user-visible failure copy beyond the existing `PublishCalloutKind.SubmitError` callout, whose text remains a host-supplied `PublishPanelLabels.submitError` label with an English default. Notification presentation stays entirely with the host, consistent with the library's no-i18n and no-host-integration rules.

`onPublishError` SHALL be part of the public surface via the already-exported `UsePublishFlowOptions` type, and `libs/catalog` SHALL thread it from `CatalogProps` → `Catalog` → `DetailsPanel` → `usePublishFlow` so catalog hosts can supply it.

#### Scenario: A rejected publish reaches the host with the original error
- **GIVEN** a host supplies `onPublishError` and its `onPublish` rejects with an error
- **WHEN** the user submits the publish flow
- **THEN** `onPublishError` is called exactly once with the item, the selected folder path, and that same error object
- **AND** `hasSubmitError` is `true`, `isSubmitting` is `false`, and `handleSubmit` resolves to `false`

#### Scenario: A successful publish never invokes the error callback
- **GIVEN** a host supplies both `onPublishSuccess` and `onPublishError`
- **WHEN** the publish request succeeds
- **THEN** only `onPublishSuccess` is called

#### Scenario: Omitting the callback keeps the previous behavior
- **GIVEN** a host does not supply `onPublishError`
- **WHEN** its `onPublish` rejects
- **THEN** `hasSubmitError` is still set and `handleSubmit` still resolves to `false`, with no error thrown from the hook

#### Scenario: The library still renders no failure notification of its own
- **WHEN** a publish request fails
- **THEN** the only library-rendered failure feedback is the submit-error callout, and no notification/toast is created inside `libs/publish-panel`

### Requirement: usePublishFlow owns the publication's display author

`usePublishFlow` SHALL own the display-author value for the publish flow, exactly as it already owns folder selection and access rules.

`UsePublishFlowOptions` SHALL gain an optional `defaultAuthor?: string`, defaulting to `''`. `UsePublishFlowResult` SHALL gain `author: string` and `setAuthor: (author: string) => void`.

The hook SHALL seed `author` from `defaultAuthor` and SHALL keep an internal "edited" flag, initially false. While that flag is false, a subsequent change to `defaultAuthor` SHALL replace the current `author`; once `setAuthor` has been called, later `defaultAuthor` changes SHALL be ignored. This exists because the host resolves the display name asynchronously — it can arrive after the panel first renders, and it changes when a different user's session loads — so neither a one-shot `useState` seed nor an unconditional sync is correct on its own.

`handleSubmit` SHALL pass the current `author`, trimmed, as `onPublish`'s fourth argument. `reset()` SHALL restore `author` to the current `defaultAuthor` and clear the edited flag, alongside the folder, rules, and submit-error state it already resets.

The library SHALL NOT resolve the author itself: it holds no notion of a session, OIDC claims, or the signed-in user, per AGENTS.md §Library isolation. `defaultAuthor` is the app-level adapter contract carrying that host knowledge into the lib.

#### Scenario: Author is seeded from defaultAuthor

- **WHEN** a host calls `usePublishFlow({ defaultAuthor: 'Daniil Pavlov', ... })`
- **THEN** the returned `author` is `'Daniil Pavlov'` on first render

#### Scenario: Late-arriving defaultAuthor replaces an untouched value

- **GIVEN** the hook was first called with `defaultAuthor: ''` because the user profile had not loaded
- **WHEN** the host re-renders with `defaultAuthor: 'Daniil Pavlov'` and `setAuthor` has never been called
- **THEN** the returned `author` becomes `'Daniil Pavlov'`

#### Scenario: Late-arriving defaultAuthor does not overwrite an edited value

- **GIVEN** the user has changed the field via `setAuthor('DIAL Team')`
- **WHEN** the host re-renders with a different `defaultAuthor`
- **THEN** the returned `author` stays `'DIAL Team'`

#### Scenario: Submit forwards the trimmed author

- **GIVEN** `author` is `'  DIAL Team  '` and a destination folder is selected
- **WHEN** `handleSubmit()` runs
- **THEN** `onPublish` is called with `'DIAL Team'` as its fourth argument

#### Scenario: Reset restores the prefill

- **GIVEN** the user has changed the field via `setAuthor('DIAL Team')`
- **WHEN** `reset()` runs
- **THEN** `author` returns to the current `defaultAuthor` and a later `defaultAuthor` change replaces it again

#### Scenario: Omitted defaultAuthor leaves the field empty

- **WHEN** a host calls `usePublishFlow` without `defaultAuthor`
- **THEN** `author` is `''` and `onPublish` receives `''`, leaving the decision to the host's own publish call

### Requirement: PublishPanel renders a controlled author field below the destination folder

`PublishPanel` SHALL render a labelled, single-line text input for the publication's display author inside the destination-folder block: after `PublishFoldersTree` and its callout, and before the `PublishAccessRules` wrapper. `StandalonePublishPanel` SHALL forward the same props through to `PublishPanel` without inspecting them.

`PublishPanelProps` and `StandalonePublishPanelProps` SHALL each gain required controlled props `author: string` and `onAuthorChange: (author: string) => void`, mirroring the existing `rules` / `onRulesChange` pair. This is a breaking change for consumers implementing these prop types; both in-repo consumers are updated in the same change.

The field SHALL be rendered with ui-kit 2.0 `Input` (`labelProps`, `placeholder`, `caption`, `maxLength={200}`, `disabled` while `isSubmitting` is true), matching how `PublishAccessRuleEditor` already uses `Input`. It SHALL never block submission: an empty author is a valid state, and no inline error or callout is introduced for it.

`PublishPanelLabels` SHALL gain optional `authorLabel`, `authorPlaceholder`, and `authorHint` entries with English defaults (`'Author'`, `'Author name'`, and a hint explaining the value is shown as the publication's author), so the library stays free of i18n per AGENTS.md §Library isolation.

Accessibility: the input SHALL be associated with its visible label through `Input`'s `labelProps` (not a bare `aria-label`), SHALL be reachable in the panel's natural tab order between the folder tree and the access-rules controls, and SHALL carry its hint as the field's `caption` so it is announced as the field's description. No new live region is required, because the field produces no dynamic feedback.

RTL/direction impact: none beyond what the surrounding panel already provides. The field uses ui-kit `Input` and existing layout utilities with CSS logical properties only; no directional icon is added, so no `rtl:` mirroring applies.

Memoisation: no new `useMemo`/`useCallback` is required. The field is a controlled input whose value and change handler come from `usePublishFlow`, whose `setAuthor` is already stable.

#### Scenario: Field renders between the folder tree and the access rules

- **WHEN** the publish panel is open
- **THEN** the author input appears after the destination-folder tree (and its callout, when shown) and before the access-rules section

#### Scenario: Editing the field calls onAuthorChange

- **WHEN** the user types in the author input
- **THEN** `onAuthorChange` is called with the input's next value, and the rendered value comes from the `author` prop

#### Scenario: Field is disabled while a publish request is in flight

- **GIVEN** `isSubmitting` is true
- **THEN** the author input is disabled, alongside the folder tree and access-rules controls

#### Scenario: Empty author does not block submission

- **GIVEN** the user clears the author input and a destination folder is selected
- **THEN** the Publish action stays enabled and no error callout appears

#### Scenario: Labels fall back to English defaults

- **WHEN** a consumer renders `PublishPanel` without `labels.authorLabel`
- **THEN** the field renders with the library's English default label, with no i18n import inside the library

#### Scenario: StandalonePublishPanel forwards the author props unchanged

- **WHEN** a consumer renders `<StandalonePublishPanel author={author} onAuthorChange={setAuthor} ... />`
- **THEN** the inner `PublishPanel` receives both values unmodified
