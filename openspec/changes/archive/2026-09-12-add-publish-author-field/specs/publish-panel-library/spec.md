## MODIFIED Requirements

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

## ADDED Requirements

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
