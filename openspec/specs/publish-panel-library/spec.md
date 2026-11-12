# publish-panel-library Specification

## Purpose

The standalone publish-panel library: its public surface, and the independence from catalog models, i18n, and app context it must keep.

## Requirements
### Requirement: Public package surface exports the shared publish UI and state
`libs/publish-panel/src/index.ts` SHALL be the only public entry for the publish UI (`libs/catalog/src/index.ts` no longer re-exports any publish symbol; it only imports `@epam/ai-dial-publish-panel/styles.css`) and SHALL export: components `PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`, `PublishAccessRules`, `PublishAccessRuleEditor`; the `usePublishFlow` hook (its `UsePublishFlowOptions.onPublish` signature now `(item: TItem, folderPath: string[], rules: PublicationRule[], author: string, publishCredentials: boolean) => Promise<void>`, `UsePublishFlowOptions` now also accepting an optional `onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>` and an optional `defaultAuthor?: string`, and `UsePublishFlowResult` now including `rules: PublicationRule[]`, `setRules: (rules: PublicationRule[]) => void`, `isRulesLoading: boolean`, `hasRulesLoadError: boolean`, `author: string`, `setAuthor: (author: string) => void`, `publishCredentials: boolean`, and `setPublishCredentials: (value: boolean) => void`); the pure functions `derivePublishState`, `formatPublishedDate`, and the `publish-folder-tree` helpers (`filterFolderTree`, `sortFolderTree`, `mergeFolderPaths`, `collectFolderKeys`, `toFolderPathKey`, `fromFolderPathKey`, `toDialFileTree`, `validateFolderName`, `getUniqueFolderName`, `getSiblingFolderNames`); the `PUBLISH_PANEL_CLASS` public class-name constant; and all associated types/interfaces (`PublishFolderNode`, `PublishHistoryEntry`, `PublishResourceSummary`, `PublishCalloutKind`, `PublishDerivationInput`, `PublishDerivedState`, `PublishFlowItem`, `UsePublishFlowOptions`, `UsePublishFlowResult`, `PublicationRule`, `PublicationRuleFunction`, `FolderNameValidationMessages`, every `*Labels`, `*Props`, `*Colors`, and `*Styles` interface, including `PublishAccessRulesProps`/`PublishAccessRuleEditorProps` and their labels). Internal-only helpers (e.g. `PublishPanel.tsx`'s unexported `calloutVariant`/`calloutMessage`/`withBoldFolderName`) SHALL NOT be exported from the barrel.

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
- **THEN** both supply an `onPublish` assignable to the five-argument signature `(item, folderPath, rules, author, publishCredentials) => Promise<void>` — a callback declaring only the first four parameters remains assignable — and both read `rules`/`setRules` and `author`/`setAuthor` from the hook's return value to wire into `PublishPanel`'s controlled props

#### Scenario: usePublishFlow's onFetchExistingRules option is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply an `onFetchExistingRules` calling the shared `apps/chat/src/server-api/publish-rules.api.ts` wrapper, and both read `isRulesLoading`/`hasRulesLoadError` from the hook's return value

#### Scenario: usePublishFlow's defaultAuthor option is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply a `defaultAuthor` resolved by the host from the signed-in user's display name, with no session, claims, or context access inside the library

### Requirement: The library has no dependency on catalog domain models
`PublishPanel` and `StandalonePublishPanel` SHALL NOT import `CatalogItem`, `EntityHeader`, or any other symbol from `@epam/ai-dial-catalog`. `PublishPanel` SHALL accept an optional `renderSummary?: () => ReactNode` prop in place of the removed `item?: CatalogItem` prop. The summary row SHALL render through `@epam/ai-dial-chat-shared`'s `ResourceSummary`: when `resource?.type` is set, the typed `ResourceSummary` (type, `resource.title`, `resource.version`, `resource.iconUrl`) renders and `renderSummary` is ignored; otherwise `renderSummary()`'s return value renders inside `ResourceSummary` when provided, and the title-only `resource.title` row renders when it is absent. `StandalonePublishPanel` SHALL forward the same `renderSummary` prop through to `PublishPanel` without inspecting it. `usePublishFlow`'s generic type parameter default SHALL be `<TItem extends PublishFlowItem = PublishFlowItem>`, not `CatalogItem`.

#### Scenario: PublishPanel renders a caller-supplied summary
- **WHEN** a consumer renders `<PublishPanel renderSummary={() => <CustomHeader />} ... />`
- **THEN** `CustomHeader`'s output appears where the entity-header block previously rendered, with no reference to `CatalogItem` inside `PublishPanel` itself

#### Scenario: PublishPanel falls back to the resource summary
- **WHEN** a consumer renders `<PublishPanel resource={{ title: 'Q3 planning notes' }} ... />` without `renderSummary` or `resource.type`
- **THEN** the panel renders the existing title-only summary row, matching current conversation-publish behavior

#### Scenario: Static analysis confirms no catalog import
- **WHEN** `libs/publish-panel/src/**` is searched for imports of `@epam/ai-dial-catalog` or relative paths into `libs/catalog`
- **THEN** no such import exists

### Requirement: The library has no dependency on i18n, server-api, or app-level context
All user-facing strings SHALL be supplied via `labels` (`*Labels`) props with English-language defaults. The library SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/chat-api-client`, or any app-level React Context/provider (matching the library-isolation contract in AGENTS.md §Library isolation).

#### Scenario: No i18n import
- **WHEN** `libs/publish-panel/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed in via props

#### Scenario: No server-api or generated-client import
- **WHEN** `libs/publish-panel/src/**` is searched for imports from `apps/chat/src/server-api` or `@epam/chat-api-client`
- **THEN** none are found

### Requirement: The library builds as an independent Nx/Vite publishable project
`libs/publish-panel` SHALL define a `package.json` (`name: "@epam/ai-dial-publish-panel"`, `private: true`, `nx.tags: ["publishable"]`, `nx.targets.publish` running the shared `tools/publish-lib.mjs`, and a `./styles.css` export of `./dist/index.css`), a `vite.config.mts` (React + `dts()` plugins plus the shared lib-Tailwind and published-styles verification plugins, `build.lib` entry `src/index.ts` with `formats: ['es']`, React, `@epam/ai-dial-ui-kit`, `@tabler/icons-react`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-react-file-manager` externalized via `build.rolldownOptions.external`, and a test-only `test.alias` resolving `@epam/ai-dial-chat-shared` from source), and a `tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` triad. `tsconfig.base.json`'s `compilerOptions.paths` SHALL register `"@epam/ai-dial-publish-panel/*": ["./libs/publish-panel/*"]`. A `README.md` SHALL document the package's purpose, public exports, and the `renderSummary` extension point.

#### Scenario: Library builds standalone
- **WHEN** `npm exec nx build publish-panel` is run
- **THEN** it succeeds and emits declaration files via `dts()`, independent of `libs/catalog`

#### Scenario: Path alias resolves for consumers
- **WHEN** `apps/chat` or `libs/catalog` source imports `@epam/ai-dial-publish-panel`
- **THEN** TypeScript and Vite resolve it via the `tsconfig.base.json` path alias without error

### Requirement: Moving the code preserves RTL and accessibility behavior unchanged
Since this is a structural extraction and not a behavior change, all RTL logical-property usage (`ms-*`/`me-*`, `start-*`/`end-*`) and existing accessibility semantics (dialog roles, `aria-live` regions, list semantics on `PublishHistoryList`, keyboard dismissal) already implemented on the moved components SHALL be preserved; the library SHALL NOT introduce new physical-direction classes or remove any existing ARIA attribute. `StandalonePublishPanel` now renders inside the ui-kit `SideDrawer`, which owns the slide-in edge, the `role="dialog"`, focus trapping, and Escape handling.

#### Scenario: RTL slide-in behavior comes from the kit drawer
- **WHEN** `StandalonePublishPanel` is rendered with `dir="rtl"` on an ancestor
- **THEN** it slides in from the drawer's logical edge as implemented by the ui-kit `SideDrawer`, with no physical-direction class added by the library

#### Scenario: Accessibility attributes survive the move
- **WHEN** the moved components are inspected after relocation
- **THEN** every ARIA role/attribute present before the move (e.g. `PublishHistoryList`'s `<ul>`/`<li>` list semantics, and the submit-error callout's `role="alert"` supplied by the ui-kit `Notification` error variant) is still present, unchanged

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

`PublishPanel` SHALL render a labelled, single-line text input for the publication's display author inside the destination-folder block of the main view: after the destination row and its callout, and before the `PublishAccessRules` wrapper. `StandalonePublishPanel` SHALL forward the same props through to `PublishPanel` without inspecting them.

`PublishPanelProps` and `StandalonePublishPanelProps` SHALL each gain required controlled props `author: string` and `onAuthorChange: (author: string) => void`, mirroring the existing `rules` / `onRulesChange` pair. This is a breaking change for consumers implementing these prop types; both in-repo consumers are updated in the same change.

The field SHALL be rendered with ui-kit 2.0 `Input` (`labelProps`, `placeholder`, `caption`, `maxLength={200}`, `disabled` while `isSubmitting` is true), matching how `PublishAccessRuleEditor` already uses `Input`. It SHALL never block submission: an empty author is a valid state, and no inline error or callout is introduced for it.

`PublishPanelLabels` SHALL gain optional `authorLabel`, `authorPlaceholder`, and `authorHint` entries with English defaults (`'Author'`, `'Author name'`, and `'Shown as the publication’s author. Defaults to you — replace it to credit a team instead.'`), so the library stays free of i18n per AGENTS.md §Library isolation.

Accessibility: the input SHALL be associated with its visible label through `Input`'s `labelProps` (not a bare `aria-label`), SHALL be reachable in the panel's natural tab order between the destination row and the access-rules controls, and SHALL carry its hint as the field's `caption` so it is announced as the field's description. No new live region is required, because the field produces no dynamic feedback.

RTL/direction impact: none beyond what the surrounding panel already provides. The field uses ui-kit `Input` and existing layout utilities with CSS logical properties only; no directional icon is added, so no `rtl:` mirroring applies.

Memoisation: no new `useMemo`/`useCallback` is required. The field is a controlled input whose value and change handler come from `usePublishFlow`, whose `setAuthor` is already stable.

#### Scenario: Field renders between the destination row and the access rules

- **WHEN** the publish panel is open on its main view
- **THEN** the author input appears after the destination row (and its callout, when shown) and before the access-rules section

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

### Requirement: PublishPanel renders an optional, host-driven credentials opt-in

`PublishPanel` SHALL accept an optional credentials section:

- `publishCredentials?: boolean` — the current value;
- `onPublishCredentialsChange?: (value: boolean) => void` — called with the next value on toggle;
- `labels.credentialsLabel?: string` — the checkbox label, defaulting to `'Publish with my credentials'`;
- `labels.credentialsHint?: string` — the caption below it, defaulting to `'Members will use this without signing in themselves. Your credential itself is never shown to them.'`.

The section SHALL render only when `onPublishCredentialsChange` is supplied, so a host that has no use for it (a conversation publish panel, for example) gets exactly the panel it has today. When rendered, it SHALL sit inside the destination block alongside the author field and the access rules, and SHALL be `disabled` while `isSubmitting` is `true`, matching every other field in the panel.

The control SHALL be ui-kit's 2.0 `Checkbox` with `labelProps={{ label }}`, `caption={hint}`, and `isSelected={publishCredentials}`, so the hint is wired as the control's accessible description by the kit rather than by hand-rolled ARIA. The hint SHALL state the consequence of ticking the box, not merely restate the label.

The library SHALL hold no knowledge of what the flag means to any backend. It SHALL NOT reference toolsets, credential levels, authentication types, sign-in status, or DIAL Core; the decision of whether to offer the control, and all of its copy, belong to the host — consistent with the library's existing independence from catalog domain models, i18n, and app context.

#### Scenario: Host supplies the change handler

- **WHEN** `PublishPanel` receives `onPublishCredentialsChange`
- **THEN** the credentials checkbox renders with the supplied (or default) label and caption, reflecting `publishCredentials`

#### Scenario: Host omits the change handler

- **WHEN** `PublishPanel` receives no `onPublishCredentialsChange`
- **THEN** no credentials checkbox is rendered and the panel is identical to its pre-change output

#### Scenario: Toggling reports the next value

- **WHEN** the user toggles the checkbox
- **THEN** `onPublishCredentialsChange` is called with the negation of the current `publishCredentials`, and the panel holds no state of its own for it

#### Scenario: The control is disabled while submitting

- **WHEN** `isSubmitting` is `true`
- **THEN** the credentials checkbox is disabled

#### Scenario: The hint is the control's accessible description

- **WHEN** the credentials checkbox is rendered with a caption
- **THEN** assistive technology reads the caption as the checkbox's description, and the caption states what happens when the box is ticked

### Requirement: usePublishFlow owns the credentials opt-in and always clears it

`usePublishFlow` SHALL own the credentials opt-in as flow state alongside `rules` and `author`:

- `publishCredentials: boolean`, initialised to `false`;
- `setPublishCredentials: (value: boolean) => void`;
- `reset()` SHALL restore it to `false`, together with the folder selection, locally created folders, rules, and submit error it already resets.

The value SHALL NOT be derived from, or pre-filled by, publish history, the selected destination folder, or a previous publication — unlike `rules`, which pre-fill from the destination folder. Selecting it is always a deliberate act, so a folder whose previous publication carried shared credentials SHALL still open with the option cleared.

`onPublish` SHALL receive it as a fifth positional argument: `onPublish(item, folderPath, rules, author, publishCredentials)`. The argument is additive — a host callback that declares only the first four parameters remains assignable and keeps compiling.

`handleSubmit` SHALL pass the current value; a successful publish SHALL NOT clear it on its own, because the flow is closed and `reset()` runs on close.

#### Scenario: The option starts cleared

- **WHEN** `usePublishFlow` initialises
- **THEN** `publishCredentials` is `false`

#### Scenario: reset clears a selected option

- **GIVEN** the user has set `publishCredentials` to `true`
- **WHEN** `reset()` is called
- **THEN** `publishCredentials` is `false` again

#### Scenario: A previous publication with shared credentials does not pre-select it

- **GIVEN** publish history contains an entry for the selected folder whose `publishCredentials` is `true`
- **WHEN** the flow is initialised and that folder is selected
- **THEN** `publishCredentials` is `false`

#### Scenario: The value reaches onPublish

- **GIVEN** `publishCredentials` is `true` and a destination folder is selected
- **WHEN** `handleSubmit()` runs
- **THEN** `onPublish` is called with `true` as its fifth argument

#### Scenario: A four-parameter host callback still works

- **WHEN** a host passes an `onPublish` declaring only `(item, folderPath, rules, author)`
- **THEN** the call type-checks and behaves exactly as before, ignoring the extra argument

### Requirement: PublishHistoryEntry records whether a publication carried shared credentials

`PublishHistoryEntry` SHALL gain `publishCredentials?: boolean`, meaning that publication requested the publisher's credentials be shared. It is optional on the model because an unversioned or host-synthesised entry may not know, and absent SHALL read the same as `false`.

`PublishHistoryList` SHALL mark entries whose `publishCredentials` is `true` with a host-supplied label (`sharedCredentialsLabel`, defaulting to `'Shared credentials'`), rendered as a ui-kit `Tag`. The marker SHALL be text, not an icon alone; any icon rendered beside it SHALL carry `aria-hidden`. Entries without the flag SHALL render exactly as they do today.

The marker reports what a publication **requested**. The library SHALL NOT claim the credential was applied, and SHALL NOT display, echo, or accept any credential value.

#### Scenario: An entry with shared credentials is marked

- **WHEN** `PublishHistoryList` renders an entry whose `publishCredentials` is `true`
- **THEN** that row carries the shared-credentials label as text

#### Scenario: An entry without the flag is unchanged

- **WHEN** `PublishHistoryList` renders an entry whose `publishCredentials` is `false` or absent
- **THEN** that row renders exactly as it did before this change, with no marker

### Requirement: Save-to-folder panel components are exported
`@epam/ai-dial-publish-panel` (`libs/publish-panel/src/index.ts`) SHALL export:

- `SaveToFolderPanel` (body) and `StandaloneSaveToFolderPanel` (`SideDrawer` shell with a pinned Cancel/Save footer);
- the models `SaveToFolderPanelProps`, `SaveToFolderPanelLabels`, `SaveToFolderPanelColors`, `FolderDestination` (`{ rootKey: string; path: string[] }`) and `FolderDestinationRoot` (`{ key: string; label: string; items: PublishFolderNode[]; canCreateFolders?: boolean }`);
- the string enum `SaveVersionMode` (`Keep = 'keep'`, `New = 'new'`).

The components SHALL take every user-visible string from `labels`, with English defaults. Every color SHALL come from `colors`, applied as `var(--publish-panel-x, fallback)` in their `.module.scss`. Typography comes from `*ClassName` props whose defaults are kit `dial-*-text` classes.

The components SHALL know no resource ids, REST paths, i18n, routing or storage. The host supplies:

- the summary `resource`, `roots`, the committed `destination` and `onDestinationChange`;
- `onCreateFolder(rootKey, parentPath, name)`;
- optional version props: `versionMode`, `onVersionModeChange`, `currentVersion`, `newVersion`, `onNewVersionChange`, `newVersionError`;
- `isSubmitting`, `isSubmitDisabled`, `onSubmit` and `onClose`.

The version section renders only when `version` (`SaveToFolderVersionProps`) is provided. `StandaloneSaveToFolderPanel` owns the view state (`SaveToFolderView`: `Main`, `ChangeFolder`) and the pending Change-view destination, and renders the per-view header (the kit `SideDrawer`'s `onBack` in the Change view) and footer (Save, or Select). `SaveToFolderPanel` is the controlled body: it takes `view`, `pendingDestination`, `onPendingDestinationChange` and `onChangeFolderClick`.

The main view shows the committed destination as the kit `FolderName` (the path joined with " / ", `destinationClassName` defaulting to `dial-small-semi-text`, color `destinationText`) followed by a small ghost Change button. When `accessRules` (`SaveToFolderAccessRulesProps`) is passed and the pending destination belongs to a root with `hasAccessRules`, `PublishAccessRules` renders below the tree in the Change view; the shell reports the pending destination through `onPendingDestinationChange`, including the reset to `destination` on entering and leaving that view, so the host can load that folder's rules.

#### Scenario: Unversioned host
- **WHEN** a host renders `SaveToFolderPanel` without `versionMode`
- **THEN** no Version section is rendered

#### Scenario: Change view commits on Select only
- **WHEN** the user selects a folder in the Change view
- **THEN** `onDestinationChange` is not called until Select is pressed, and is never called when Back or Cancel is pressed

#### Scenario: No history or dependencies
- **WHEN** `SaveToFolderPanel` renders
- **THEN** it renders no publish history and no dependencies list

### Requirement: PublishFoldersTree supports multiple roots
`PublishFoldersTree` SHALL accept optional `roots?: FolderDestinationRoot[]`, `destination?: FolderDestination` and `onDestinationChange?: (destination: FolderDestination | undefined) => void`. When `roots` is given:

- the tree renders one always-expanded top-level node per root, in order;
- each root node and every folder under it is selectable;
- search filters all roots, and inline creation targets the root the parent belongs to, using the same validation as the single-root mode;
- arrow-key navigation moves across root boundaries;
- a root with `canCreateFolders: false` offers no create actions.

When `roots` is absent, `items` / `rootLabel` / `selectedPath` / `onSelectedPathChange` SHALL behave exactly as before.

#### Scenario: Selecting a folder under the second root
- **WHEN** the tree has roots `personal` and `organization` and the user clicks `organization › EPAM › Delivery`
- **THEN** `onDestinationChange` receives `{ rootKey: 'organization', path: ['EPAM', 'Delivery'] }`

#### Scenario: Single-root callers are unchanged
- **WHEN** the Catalog Publish panel renders `PublishFoldersTree` with `items` and `rootLabel` only
- **THEN** it renders and selects exactly as before this change

### Requirement: PublishPanel picks the destination through a drill-in folder view
`PublishPanel` SHALL render one of two views, chosen by its `view` prop (`PublishPanelView`, default `Main`), matching the save-to-folder panel. The main view SHALL show the entity summary, a "Publish to folder" heading, and a destination row with the committed path (`rootFolderLabel` followed by `selectedFolderPath`, joined with ` / ` in one truncating `FolderName`), or `noFolderSelectedLabel` when nothing is selected, beside a button labelled `changeFolderLabel` or `chooseFolderLabel` that calls `onChangeFolderClick`. The callout, author field, credentials opt-in and access rules SHALL follow the row. The `ChangeFolder` view SHALL show only the folder search and `PublishFoldersTree`, bound to `pendingFolderPath` and `onPendingFolderPathChange`.

`usePublishFolderView` SHALL hold the view and the pending folder: opening copies the committed folder into the pending one, `selectFolder` commits a defined pending folder through `onSelectedFolderPathChange` and returns to the main view, `backToMain` returns without committing, and every opening of the flow starts on the main view. `PublishFooter` SHALL render Cancel and Select in place of the submit action when `view` is `ChangeFolder`. `StandalonePublishPanel` and the catalog `DetailsPanel` SHALL title the folder view "Change folder" and show a Back button that returns to the main view.

Accessibility: the folder view root SHALL be a named `group` that receives focus when the view opens, and focus SHALL return to the Change button when the main view comes back.

#### Scenario: Choosing a folder commits it only on Select
- **WHEN** the user presses Choose, picks a folder in the tree and presses Select
- **THEN** `onSelectedFolderPathChange` is called with that folder and the main view shows its path in the destination row

#### Scenario: Leaving the folder view discards the pick
- **WHEN** the user picks a folder in the folder view and presses Back or Cancel
- **THEN** the committed folder is unchanged and the main view is shown

### Requirement: PublishPanel lists private dependencies in a read-only section

`PublishPanel` (`libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx`) SHALL accept an optional `dependencies?: PublishDependency[]` prop, and, in the way `accessRulesLabels` and `styles.accessRules` already work, an optional `dependenciesLabels?: PublishDependenciesLabels` field inside `PublishPanelLabels` and an optional `dependencies?: PublishDependenciesStyles` field inside `PublishPanelStyles`. `StandalonePublishPanel` SHALL forward the new `dependencies` prop unchanged, without inspecting it; its existing `labels` and `styles` already reach `PublishPanel`, so no other new prop is added to it, to `libs/catalog` or to a host.

`PublishDependency` is `{ id: string; name: string; version?: string; type: PublishDependencyType; location: string; iconUrl?: string; isFolder?: boolean }`, where `PublishDependencyType` is a string enum with the members `Application`, `Toolset`, `Prompt`, `Skill` and `File`. Both are exported from `libs/publish-panel/src/index.ts`.

When `dependencies` is absent or empty the section SHALL NOT render and SHALL leave no gap, so a host that supplies nothing renders exactly today's panel. When it is non-empty, the section SHALL render in the Main view as its last section, below the destination folder, author and access-rules block, as:

- a heading from `dependenciesLabels.title`;
- a warning `Notification` (ui-kit 2.0 `NotificationType.SectionMessage`, `NotificationVariant.Warning`) whose message is `dependenciesLabels.description`;
- a list with one row per dependency starting with an icon, then the name with `version` appended when present, and a second line with the type label and the location (`dependenciesLabels.rootLocation` when `location` is empty).

The section is informational: rows SHALL NOT be interactive, selectable or removable, and the section SHALL NOT change the submit button's enabled state or the callout derivation.

Accessibility: the section SHALL be a landmark-free `section` named by its heading (`aria-labelledby`), the rows SHALL be `<li>` items of a `<ul>`, and when the section first appears or its count changes the panel SHALL announce `dependenciesLabels.getAnnouncement(count)` through the ui-kit `LiveRegion`, mounted before the text it announces.

RTL: all spacing and alignment SHALL use logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`). The icon is decorative (the name always stands beside it) and is chosen by the entity, never invented per kind: an application, toolset, prompt or skill shows `DeploymentIcon` from `@epam/ai-dial-chat-shared` (the host-resolved `iconUrl`, else the initials of the name, as the panel's own header does), and a `File` shows the UI kit's `FileIcon`, whose glyph is picked from the extension in `name`, or the folder glyph when `isFolder` is `true`.

Memoisation: none required; the host keeps the `dependencies` array identity stable between renders (the `usePublishDependencies` hook returns a module-level empty array).

#### Scenario: Private dependencies are shown
- **WHEN** `PublishPanel` renders with `dependencies` holding one prompt and one toolset
- **THEN** the panel shows the title, the warning, and two rows, each with its type label, name and location

#### Scenario: No dependencies renders today's panel
- **WHEN** `PublishPanel` renders with `dependencies` omitted or `[]`
- **THEN** no dependencies heading, notification or list is present

#### Scenario: Versioned dependency shows its version
- **WHEN** a dependency has `version: '1.0.0'` and `name: 'Search'`
- **THEN** its row shows `Search` with `1.0.0`

#### Scenario: Root-level dependency uses the root label
- **WHEN** a dependency's `location` is `''`
- **THEN** its row shows `dependenciesLabels.rootLocation`

#### Scenario: Section does not affect submit
- **WHEN** the panel has a valid destination and non-empty dependencies
- **THEN** the submit button is enabled exactly as it would be without the section

#### Scenario: Appearance is announced
- **WHEN** dependencies arrive after the panel has opened
- **THEN** the live region announces the count

### Requirement: The dependencies section is themeable and carries only host-supplied text and data

Every user-visible string of the section SHALL come from `PublishDependenciesLabels` (`title`, `description`, `rootLocation`, `typeLabels` keyed by `PublishDependencyType`, and `getAnnouncement: (count: number) => string`, the function form the repo's libs use for count-dependent text) with English defaults. Every colour SHALL come from `PublishDependenciesColors` as `var(--pp-dependencies-*, fallback)` in the component's `.module.scss`, set through `buildCssVars`, and every `dial-*-text` class SHALL come from `*ClassName` props whose defaults are kit classes. The library SHALL NOT import `react-i18next`, a generated client, a server-api module, an app context, or build an endpoint path; it receives the list as data.

`PUBLISH_PANEL_CLASS` SHALL gain stable public class names for the section, its list and its rows, and `libs/publish-panel/README.md` SHALL document the new exports, props, labels, colours and class-name table (`npm run validate:docs` checks both directions).

#### Scenario: Host supplies labels
- **WHEN** a host passes `labels.dependenciesLabels` with translated text
- **THEN** the section renders that text and none of the English defaults

#### Scenario: Library stays host-agnostic
- **WHEN** `libs/publish-panel/src/**` is searched for `react-i18next`, `@epam/ai-dial-chat-api-client`, `server-api` and `/api/`
- **THEN** no such reference is found

#### Scenario: README and class names agree
- **WHEN** `npm run validate:docs` runs after the change
- **THEN** it passes, with the new public class names present in the README table
