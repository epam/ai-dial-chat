# publish-panel-library Specification

## Purpose

The standalone publish-panel library: its public surface, and the independence from catalog models, i18n, and app context it must keep.

## Requirements

### Requirement: Public package surface exports the shared publish UI and state
`libs/publish-panel/src/index.ts` SHALL export exactly the symbols currently re-exported for publish by `libs/catalog/src/index.ts`, plus the new access-rules surface added by the access-rules editor: components `PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`, `PublishAccessRules`, `PublishAccessRuleEditor`; the `usePublishFlow` hook (its `UsePublishFlowOptions.onPublish` signature now `(item: TItem, folderPath: string[], rules: PublicationRule[]) => Promise<void>`, `UsePublishFlowOptions` now also accepting an optional `onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>`, and `UsePublishFlowResult` now including `rules: PublicationRule[]`, `setRules: (rules: PublicationRule[]) => void`, `isRulesLoading: boolean`, and `hasRulesLoadError: boolean`); the pure functions `derivePublishState`, `formatPublishedDate`, and the `publish-folder-tree` helpers (`filterFolderTree`, `sortFolderTree`, `mergeFolderPaths`, `collectFolderKeys`, `toFolderPathKey`, `fromFolderPathKey`, `toDialFileTree`, `validateFolderName`, `getUniqueFolderName`, `getSiblingFolderNames`); and all associated types/interfaces (`PublishFolderNode`, `PublishHistoryEntry`, `PublishResourceSummary`, `PublishCalloutKind`, `PublishDerivationInput`, `PublishDerivedState`, `PublishFlowItem`, `UsePublishFlowOptions`, `UsePublishFlowResult`, `PublicationRule`, `PublicationRuleFunction`, every `*Texts`/`*Labels` and `*Props` interface, including the new `PublishAccessRulesProps`/`PublishAccessRuleEditorProps`/labels). Internal-only helpers (e.g. `PublishPanel.tsx`'s unexported `calloutVariant`/`calloutMessage`/`withBoldFolderName`) SHALL NOT be exported from the barrel.

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
- **THEN** both supply an `onPublish` matching the new three-argument signature `(item, folderPath, rules) => Promise<void>`, and both read `rules`/`setRules` from the hook's return value to wire into `PublishPanel`'s controlled props

#### Scenario: usePublishFlow's onFetchExistingRules option is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply an `onFetchExistingRules` calling the shared `apps/chat/src/server-api/publish-rules.api.ts` wrapper, and both read `isRulesLoading`/`hasRulesLoadError` from the hook's return value

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
