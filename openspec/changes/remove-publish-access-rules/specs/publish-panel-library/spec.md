## MODIFIED Requirements

### Requirement: Public package surface exports the shared publish UI and state
`libs/publish-panel/src/index.ts` SHALL be the only public entry for the publish UI (`libs/catalog/src/index.ts` no longer re-exports any publish symbol; it only imports `@epam/ai-dial-publish-panel/styles.css`) and SHALL export: components `PublishPanel`, `StandalonePublishPanel`, `PublishFooter`, `PublishFoldersTree`, `PublishHistoryList`; the `usePublishFlow` hook (its `UsePublishFlowOptions.onPublish` signature now `(item: TItem, folderPath: string[], author: string, publishCredentials: boolean) => Promise<void>`, `UsePublishFlowOptions` now also accepting an optional `defaultAuthor?: string`, and `UsePublishFlowResult` now including `author: string`, `setAuthor: (author: string) => void`, `publishCredentials: boolean`, and `setPublishCredentials: (value: boolean) => void`); the pure functions `derivePublishState`, `formatPublishedDate`, and the `publish-folder-tree` helpers (`filterFolderTree`, `sortFolderTree`, `mergeFolderPaths`, `collectFolderKeys`, `toFolderPathKey`, `fromFolderPathKey`, `toDialFileTree`, `validateFolderName`, `getUniqueFolderName`, `getSiblingFolderNames`); the `PUBLISH_PANEL_CLASS` public class-name constant; and all associated types/interfaces (`PublishFolderNode`, `PublishHistoryEntry`, `PublishResourceSummary`, `PublishCalloutKind`, `PublishDerivationInput`, `PublishDerivedState`, `PublishFlowItem`, `UsePublishFlowOptions`, `UsePublishFlowResult`, `FolderNameValidationMessages`, every `*Labels`, `*Props`, `*Colors`, and `*Styles` interface). The barrel SHALL NOT export `PublishAccessRules`, `PublishAccessRuleEditor`, `PublicationRule`, `PublicationRuleFunction`, `SaveToFolderAccessRulesProps` or any `PublishAccessRule*`/`PublishAccessRules*` type. Internal-only helpers (e.g. `PublishPanel.tsx`'s unexported `calloutVariant`/`calloutMessage`/`withBoldFolderName`) SHALL NOT be exported from the barrel.

#### Scenario: Consumer imports the publish panel from the new package
- **WHEN** `apps/chat` or `libs/catalog` code writes `import { StandalonePublishPanel, usePublishFlow } from '@epam/ai-dial-publish-panel'`
- **THEN** the import resolves successfully and yields the same component/hook behavior as before the move

#### Scenario: Internal helper is not part of the public surface
- **WHEN** code outside `libs/publish-panel` attempts to import `calloutVariant` (or any other unexported internal helper) from `@epam/ai-dial-publish-panel`
- **THEN** the import fails to resolve, since the barrel does not re-export it

#### Scenario: Access-rules symbols are not part of the public surface
- **WHEN** `apps/chat` code writes `import { PublicationRule, PublishAccessRules } from '@epam/ai-dial-publish-panel'`
- **THEN** type-checking fails, since the barrel exports neither

#### Scenario: usePublishFlow's extended onPublish signature is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply an `onPublish` assignable to the four-argument signature `(item, folderPath, author, publishCredentials) => Promise<void>` — a callback declaring only the first three parameters remains assignable — and both read `author`/`setAuthor` from the hook's return value to wire into `PublishPanel`'s controlled props

#### Scenario: usePublishFlow's defaultAuthor option is exercised by both consumers
- **WHEN** `PublishConversationPanelContainer` and `DetailsPanel` each call `usePublishFlow`
- **THEN** both supply a `defaultAuthor` resolved by the host from the signed-in user's display name, with no session, claims, or context access inside the library

### Requirement: usePublishFlow owns the publication's display author

`usePublishFlow` SHALL own the display-author value for the publish flow, exactly as it already owns folder selection.

`UsePublishFlowOptions` SHALL gain an optional `defaultAuthor?: string`, defaulting to `''`. `UsePublishFlowResult` SHALL gain `author: string` and `setAuthor: (author: string) => void`.

The hook SHALL seed `author` from `defaultAuthor` and SHALL keep an internal "edited" flag, initially false. While that flag is false, a subsequent change to `defaultAuthor` SHALL replace the current `author`; once `setAuthor` has been called, later `defaultAuthor` changes SHALL be ignored. This exists because the host resolves the display name asynchronously — it can arrive after the panel first renders, and it changes when a different user's session loads — so neither a one-shot `useState` seed nor an unconditional sync is correct on its own.

`handleSubmit` SHALL pass the current `author`, trimmed, as `onPublish`'s third argument. `reset()` SHALL restore `author` to the current `defaultAuthor` and clear the edited flag, alongside the folder and submit-error state it already resets.

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

`PublishPanel` SHALL render, only when `onAuthorChange` is supplied, a labelled, single-line text input for the publication's display author inside the destination-folder block of the main view: after the destination row and its callout. `StandalonePublishPanel` SHALL forward the same props through to `PublishPanel` without inspecting them.

`PublishPanelProps` and `StandalonePublishPanelProps` SHALL each carry controlled props `author?: string` (default `''`) and `onAuthorChange?: (author: string) => void`, following the controlled-prop pattern of `onPublishCredentialsChange`. Supplying `onAuthorChange` is what renders the field, the same way `onPublishCredentialsChange` renders the credentials opt-in: a host that collects the author elsewhere omits it and gets a panel without the field, with no other layout change.

The field SHALL be rendered with ui-kit 2.0 `Input` (`labelProps`, `placeholder`, `caption`, `maxLength={200}`, `disabled` while `isSubmitting` is true), matching the panel's other kit 2.0 fields. It SHALL never block submission: an empty author is a valid state, and no inline error or callout is introduced for it.

`PublishPanelLabels` SHALL gain optional `authorLabel`, `authorPlaceholder`, and `authorHint` entries with English defaults (`'Author'`, `'Author name'`, and `'Shown as the publication’s author. Defaults to you — replace it to credit a team instead.'`), so the library stays free of i18n per AGENTS.md §Library isolation.

Accessibility: the input SHALL be associated with its visible label through `Input`'s `labelProps` (not a bare `aria-label`), SHALL be reachable in the panel's natural tab order directly after the destination row, and SHALL carry its hint as the field's `caption` so it is announced as the field's description. No new live region is required, because the field produces no dynamic feedback.

RTL/direction impact: none beyond what the surrounding panel already provides. The field uses ui-kit `Input` and existing layout utilities with CSS logical properties only; no directional icon is added, so no `rtl:` mirroring applies.

Memoisation: no new `useMemo`/`useCallback` is required. The field is a controlled input whose value and change handler come from `usePublishFlow`, whose `setAuthor` is already stable.

#### Scenario: Field renders after the destination row

- **WHEN** the publish panel is open on its main view
- **THEN** the author input appears after the destination row (and its callout, when shown)

#### Scenario: Field is omitted without onAuthorChange

- **WHEN** the publish panel renders on its main view without `onAuthorChange`
- **THEN** no author input is rendered, and the destination row and credentials opt-in are unaffected

#### Scenario: Editing the field calls onAuthorChange

- **WHEN** the user types in the author input
- **THEN** `onAuthorChange` is called with the input's next value, and the rendered value comes from the `author` prop

#### Scenario: Field is disabled while a publish request is in flight

- **GIVEN** `isSubmitting` is true
- **THEN** the author input is disabled, alongside the folder tree

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

The section SHALL render only when `onPublishCredentialsChange` is supplied, so a host that has no use for it (a conversation publish panel, for example) gets exactly the panel it has today. When rendered, it SHALL sit inside the destination block alongside the author field, and SHALL be `disabled` while `isSubmitting` is `true`, matching every other field in the panel.

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

`usePublishFlow` SHALL own the credentials opt-in as flow state alongside `author`:

- `publishCredentials: boolean`, initialised to `false`;
- `setPublishCredentials: (value: boolean) => void`;
- `reset()` SHALL restore it to `false`, together with the folder selection, locally created folders, and submit error it already resets.

The value SHALL NOT be derived from, or pre-filled by, publish history, the selected destination folder, or a previous publication. Selecting it is always a deliberate act, so a folder whose previous publication carried shared credentials SHALL still open with the option cleared.

`onPublish` SHALL receive it as a fourth positional argument: `onPublish(item, folderPath, author, publishCredentials)`. A host callback that declares only the first three parameters remains assignable and keeps compiling.

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
- **THEN** `onPublish` is called with `true` as its fourth argument

#### Scenario: A three-parameter host callback still works

- **WHEN** a host passes an `onPublish` declaring only `(item, folderPath, author)`
- **THEN** the call type-checks and behaves exactly as before, ignoring the extra argument

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

The main view shows the committed destination as the kit `FolderName` (the path joined with " / ", `destinationClassName` defaulting to `dial-small-semi-text`, color `destinationText`) followed by a small ghost Change button. `StandaloneSaveToFolderPanel` SHALL NOT render an access-rules section and SHALL NOT accept an `accessRules` prop; `FolderDestinationRoot` SHALL NOT carry `hasAccessRules`. The shell reports the pending destination through `onPendingDestinationChange`, including the reset to `destination` on entering and leaving that view, so the host can react to the folder the user is browsing.

#### Scenario: Unversioned host
- **WHEN** a host renders `SaveToFolderPanel` without `versionMode`
- **THEN** no Version section is rendered

#### Scenario: Change view commits on Select only
- **WHEN** the user selects a folder in the Change view
- **THEN** `onDestinationChange` is not called until Select is pressed, and is never called when Back or Cancel is pressed

#### Scenario: No history or dependencies
- **WHEN** `SaveToFolderPanel` renders without `versionHistory` and `dependencies`
- **THEN** it renders no publish history and no dependencies list

### Requirement: PublishPanel lists private dependencies in a read-only section

`PublishPanel` (`libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx`) SHALL accept an optional `dependencies?: PublishDependency[]` prop, and, in the way `PublishPanelLabels` and `PublishPanelStyles` already nest per-section fields, an optional `dependenciesLabels?: PublishDependenciesLabels` field inside `PublishPanelLabels` and an optional `dependencies?: PublishDependenciesStyles` field inside `PublishPanelStyles`. `StandalonePublishPanel` SHALL forward the new `dependencies` prop unchanged, without inspecting it; its existing `labels` and `styles` already reach `PublishPanel`, so no other new prop is added to it, to `libs/catalog` or to a host.

`PublishDependency` is `{ id: string; name: string; version?: string; type: PublishDependencyType; location: string; iconUrl?: string; isFolder?: boolean }`, where `PublishDependencyType` is a string enum with the members `Application`, `Toolset`, `Prompt`, `Skill` and `File`. Both are exported from `libs/publish-panel/src/index.ts`.

When `dependencies` is absent or empty the section SHALL NOT render and SHALL leave no gap, so a host that supplies nothing renders exactly today's panel. When it is non-empty, the section SHALL render in the Main view as its last section, below the destination folder and author block, as:

- a heading from `dependenciesLabels.title`;
- the description `dependenciesLabels.description`, presented according to `dependenciesLabels.appearance`, a member of the exported string enum `PublishDependenciesAppearance` (`Warning`, `Published`). When the host passes nothing the appearance SHALL be `Warning` and the title, description and announcement defaults SHALL be today's, so a host that supplies nothing renders exactly today's section;
- in the `Warning` appearance the description is a warning `Notification` (ui-kit 2.0 `NotificationType.SectionMessage`) and each row is an icon, then the name with `version` appended when present, and a second line with the type label and the location, which is omitted together with its separator when `location` is empty;
- in the `Published` appearance the description is a plain muted caption directly under the heading, with no notification and no warning, and each row is a 40px icon with 12px rounded corners, 12px before the text, the type label above the name (the type label upper-cased and in the accent color), the `version` appended to the name when present, the `location` after the type label when not empty, and a thin divider between rows.

The section is informational: rows SHALL NOT be interactive, selectable or removable, and the section SHALL NOT change the submit button's enabled state or the callout derivation.

The library SHALL NOT know why a host picks an appearance. A host that publishes the listed dependencies together with the item passes `Published` with text saying so; a host that only warns passes nothing. Every color of the `Published` appearance (`captionText`, `typeText`, `divider`) SHALL come from `PublishDependenciesColors` as a `--pp-dependencies-*` CSS variable with a token fallback, and its typography from `captionClassName` and `typeClassName` props defaulted to kit classes.

Accessibility: the section SHALL be a landmark-free `section` named by its heading (`aria-labelledby`), the rows SHALL be `<li>` items of a `<ul>`, and when the section first appears or its count changes the panel SHALL announce `dependenciesLabels.getAnnouncement(count)` through the ui-kit `LiveRegion`, mounted before the text it announces.

RTL: all spacing and alignment SHALL use logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`). The icon is decorative (the name always stands beside it) and is chosen by the entity, never invented per kind: an application, toolset, prompt or skill shows `DeploymentIcon` from `@epam/ai-dial-chat-shared` (the host-resolved `iconUrl`, else the initials of the name, as the panel's own header does), and a `File` shows the UI kit's `FileIcon`, whose glyph is picked from the extension in `name`, or the folder glyph when `isFolder` is `true`.

Memoisation: none required; the host keeps the `dependencies` array identity stable between renders (the `usePublishDependencies` hook returns a module-level empty array).

The app host's strings for the **application** panel SHALL be new i18n keys (`publish.dependenciesPublishedTitle` whose English text is `Dependencies`, `publish.dependenciesPublishedDescription` with the `{{entity}}` placeholder, `publish.dependenciesPublishedAnnouncement_one` and `publish.dependenciesPublishedAnnouncement_other`) added to `apps/chat/src/i18n/locales/en.json`; the existing `publish.dependenciesTitle`, `publish.dependenciesDescription` and announcement keys SHALL stay unchanged and keep serving the conversation and project panels.

#### Scenario: Private dependencies are shown
- **WHEN** `PublishPanel` renders with `dependencies` holding one prompt and one toolset and no `dependenciesLabels`
- **THEN** the panel shows today's title, a warning, and two rows, each with its type label, name and location

#### Scenario: Host publishes the dependencies with the item
- **WHEN** a host passes `dependenciesLabels` with `title: 'Dependencies'`, text saying the artifacts are published with the item and `appearance: PublishDependenciesAppearance.Published`
- **THEN** the section shows that title and text as a plain caption, with no notification and no warning, and each row shows the type label above the name

#### Scenario: Default appearance is a warning
- **WHEN** `dependenciesLabels.appearance` is omitted
- **THEN** the description is a warning notification and the rows keep their compact layout

#### Scenario: No dependencies renders today's panel
- **WHEN** `PublishPanel` renders with `dependencies` omitted or `[]`
- **THEN** no dependencies heading, notification or list is present

#### Scenario: Versioned dependency shows its version
- **WHEN** a dependency has `version: '1.0.0'` and `name: 'Search'`
- **THEN** its row shows `Search` with `1.0.0`

#### Scenario: Root-level dependency shows no location
- **WHEN** a dependency's `location` is `''`
- **THEN** its second line shows only the type label, with no separator

#### Scenario: Section does not affect submit
- **WHEN** the panel has a valid destination and non-empty dependencies
- **THEN** the submit button is enabled exactly as it would be without the section

#### Scenario: Appearance is announced
- **WHEN** dependencies arrive after the panel has opened
- **THEN** the live region announces the count

#### Scenario: Conversation and project panels are unchanged
- **WHEN** the conversation or project publish panel renders with dependencies
- **THEN** it shows the same title, warning and announcement as before this change

### Requirement: usePublishFlow can submit through a direct write
`UsePublishFlowOptions` SHALL gain two optional options: `canPublishDirectlyTo?: (folderPath: string[]) => boolean` and `onPublishDirectly?: (item: TItem, folderPath: string[]) => Promise<void>`. `UsePublishFlowResult` SHALL gain `isDirectWrite: boolean`, `true` when a folder is selected and both options are supplied and `canPublishDirectlyTo` holds for it. While `isDirectWrite` is `true`, `handleSubmit` SHALL call `onPublishDirectly` instead of `onPublish`, with the same success, error and taken-target handling (`onPublishSuccess`, `onPublishError`, `isTargetTakenError`, `hasSubmitError`), and SHALL NOT send author or credentials. `onPublishSuccess` receives `isDirectWrite` as an additive third argument, so a host can word a save into the folder differently from a filed request; a callback declaring two parameters stays assignable. A host that supplies neither option sees no change. The library SHALL learn nothing about endpoints, rights data or the `publications` namespace: the predicate and the callback arrive from the host.

#### Scenario: Direct folder
- **WHEN** `canPublishDirectlyTo` returns `true` for the selected folder and the user submits
- **THEN** `onPublishDirectly` is called, `onPublish` is not, and `onPublishSuccess` runs on resolve

#### Scenario: Request folder
- **WHEN** `canPublishDirectlyTo` returns `false`
- **THEN** `onPublish` is called as before

#### Scenario: Options omitted
- **WHEN** the host passes neither option
- **THEN** `isDirectWrite` is `false` and behaviour is unchanged

#### Scenario: Taken target on a direct write
- **WHEN** `onPublishDirectly` rejects and `isTargetTakenError` recognises the error
- **THEN** the selected folder is marked taken instead of setting `hasSubmitError`

### Requirement: PublishPanel renders a direct destination
`PublishPanel` SHALL also accept an optional host-supplied `directUnavailableNote?: string` (default none), a finished sentence rendered as an information callout when the direct path is unavailable for a reason the host names; the library decides nothing about it. `PublishPanel` SHALL accept optional `isDirectWrite?: boolean` (default `false`) and, for `true`, SHALL NOT render the author field or the credentials checkbox, SHALL render `labels.directWriteNote` (optional, default none: rendered only when the host supplies it) in the credentials section's place. The panel takes no decision of its own: the host passes the flow's `isDirectWrite`.

#### Scenario: Direct destination
- **WHEN** `isDirectWrite` is `true`
- **THEN** none of the three publication-only sections is rendered and the note is shown when `labels.directWriteNote` is supplied

#### Scenario: Direct path unavailable because of dependencies
- **WHEN** the host supplies `directUnavailableNote` and `isDirectWrite` is `false`
- **THEN** the sentence is shown as an information callout and submit files a request as usual

#### Scenario: Default
- **WHEN** `isDirectWrite` is omitted
- **THEN** the panel renders exactly as before

### Requirement: PublishPanel picks the destination through a drill-in folder view
`PublishPanel` SHALL render one of two views, chosen by its `view` prop (`PublishPanelView`, default `Main`), matching the save-to-folder panel. The main view SHALL show the entity summary, a "Publish to folder" heading, and a destination row with the committed path (`rootFolderLabel` followed by `selectedFolderPath`, joined with ` / ` in one truncating `FolderName`), or `noFolderSelectedLabel` when nothing is selected, beside a button labelled `changeFolderLabel` or `chooseFolderLabel` that calls `onChangeFolderClick`. The callout, author field and credentials opt-in SHALL follow the row. The `ChangeFolder` view SHALL show only the folder search and `PublishFoldersTree`, bound to `pendingFolderPath` and `onPendingFolderPathChange`.

`usePublishFolderView` SHALL hold the view and the pending folder: opening copies the committed folder into the pending one, `selectFolder` commits a defined pending folder through `onSelectedFolderPathChange` and returns to the main view, `backToMain` returns without committing, and every opening of the flow starts on the main view. `PublishFooter` SHALL render Cancel and Select in place of the submit action when `view` is `ChangeFolder`. `StandalonePublishPanel` and the catalog `DetailsPanel` SHALL title the folder view "Change folder" and show a Back button that returns to the main view.

Accessibility: the folder view root SHALL be a named `group` that receives focus when the view opens, and focus SHALL return to the Change button when the main view comes back.

#### Scenario: Choosing a folder commits it only on Select
- **WHEN** the user presses Choose, picks a folder in the tree and presses Select
- **THEN** `onSelectedFolderPathChange` is called with that folder and the main view shows its path in the destination row

#### Scenario: Leaving the folder view discards the pick
- **WHEN** the user picks a folder in the folder view and presses Back or Cancel
- **THEN** the committed folder is unchanged and the main view is shown
