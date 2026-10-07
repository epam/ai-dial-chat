## Purpose

Define the shared, host-agnostic "Allow access if all match" rule editor rendered inside `libs/publish-panel`'s `PublishPanel`, used identically by the conversation and catalog (application/toolset) publish flows: adding, removing, and clearing rules; per-rule validation for `EQUAL`/`CONTAIN`/`REGEX`; chip rendering; and mobile/desktop/RTL/accessibility behavior.

## Requirements

### Requirement: Domain model for a publication access rule

`libs/publish-panel/src/models/publish.ts` SHALL export:

```ts
export enum PublicationRuleFunction {
  Equal = 'EQUAL',
  Contain = 'CONTAIN',
  Regex = 'REGEX',
}

export interface PublicationRule {
  source: string;
  function: PublicationRuleFunction;
  targets: string[];
}
```

`PublicationRule.targets` SHALL be combined with OR when evaluating a single rule; separate rules in a `PublicationRule[]` array SHALL be combined with AND. An empty `PublicationRule[]` array SHALL mean "no additional access rules," identical to today's behavior.

#### Scenario: Enum values match the DIAL Core contract
- **WHEN** `PublicationRuleFunction` is inspected
- **THEN** its members are exactly `Equal = 'EQUAL'`, `Contain = 'CONTAIN'`, `Regex = 'REGEX'` — matching the string values DIAL Core's `createPublication` schema expects

### Requirement: Rules section renders in the Publish sidebar for all three publishable types

`PublishPanel` (`libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx`) SHALL render the access-rules section inside the destination-folder block, after the callout, the author field and the credentials checkbox, as the last element of the same scrollable body — never inside the pinned `PublishFooter`. This section SHALL render identically regardless of which host supplies it — `PublishConversationPanelContainer` (through the `StandalonePublishPanel` wrapper, which forwards the same rule props) or `DetailsPanel` (rendering `PublishPanel` directly) — since both wire the same controlled props.

`PublishPanelProps` (declared in `PublishPanel.tsx`) SHALL carry three required props:
```ts
rules: PublicationRule[];
onRulesChange: (rules: PublicationRule[]) => void;
ruleSourceOptions: string[];
```
plus optional `isRulesLoading?: boolean` and `hasRulesLoadError?: boolean` (both default `false`), and an optional `PublishPanelLabels.accessRulesLabels?: PublishAccessRulesLabels` carrying the section heading, folder-scope hints, chip separator/remove/clear labels, function labels, live-region announcements, and a nested `editorLabels?: PublishAccessRuleEditorLabels` for the rule editor's field labels, placeholders, and validation error strings.

#### Scenario: Section appears identically for a conversation, an application, and a toolset
- **WHEN** the Publish sidebar opens for a conversation, an application, or a toolset
- **THEN** the same "Allow access if all match" section renders in the same position (after the folder picker, callout, author field, and optional credentials checkbox, as the last element of the scrollable body) with the same controls in all three cases

#### Scenario: Section renders below the folder-selection callout
- **WHEN** a replace-warning or no-access callout is shown below the folder picker
- **THEN** the access-rules section still renders below that callout and above the footer

### Requirement: Users can add, remove, and clear rules

The rules section (`PublishAccessRules`) SHALL render each entry in `rules` as a removable list row ("chip") showing its `source`, a translated label for `function` followed by `:`, and its `targets` joined with a localized "Or" separator (`orSeparatorLabel`, default `'Or'`). An "Add rule" trigger SHALL open the single-rule editor (see next requirement). A "Clear all" control SHALL be rendered only when `rules.length > 0` and SHALL call `onRulesChange([])` when activated. Removing one chip SHALL call `onRulesChange` with `rules` filtered to exclude that entry, by array index (rules have no independent identity/order-persistence requirement beyond insertion order).

#### Scenario: Adding a rule appends it to the list
- **GIVEN** the rules section shows zero or more existing chips
- **WHEN** the user completes and saves a new rule in the editor
- **THEN** `onRulesChange` is called with the previous `rules` array plus the new rule appended, and a new chip appears

#### Scenario: Removing one rule keeps the others
- **GIVEN** three rules are present
- **WHEN** the user removes the second rule's chip
- **THEN** `onRulesChange` is called with an array containing only the first and third rules, in their original order

#### Scenario: Clear all removes every rule
- **GIVEN** one or more rules are present
- **WHEN** the user activates "Clear all"
- **THEN** `onRulesChange([])` is called and no chips remain

#### Scenario: Clear all is not shown with zero rules
- **GIVEN** no rules are present
- **WHEN** the rules section renders
- **THEN** no "Clear all" control is rendered

### Requirement: Single-rule editor validates EQUAL and CONTAIN rules

The single-rule editor (`PublishAccessRuleEditor`) SHALL offer a source control (populated from `ruleSourceOptions`), a function control (`EQUAL` / `CONTAIN` / `REGEX`), and, for `EQUAL`/`CONTAIN`, a free-entry tag input for `targets`. The source picker SHALL enable the `Select`'s built-in `searchable` mode once `sourceOptions.length` exceeds 8. The Save/Add action SHALL remain enabled regardless of validation state — it is disabled only while the host disables the section (see the submission-disabling requirement below). Activating Save while a source is missing, a function is missing, or zero targets have been entered SHALL NOT call `onSave`; instead it SHALL mark the editor as having attempted a save and show a localized inline "required" error under each incomplete field (source/function picker, or the targets input), associated with that field via its `invalid`/error-message props. Each target SHALL be trimmed as it is entered (`handleTargetsChange`), empty tags dropped, and an exact-duplicate (post-trim, case-sensitive) target SHALL be rejected rather than added as a second identical tag; the list is capped at `maxTargets` (default 20).

Changing the source control SHALL NEVER clear `targets` or the in-progress pattern — the source and targets/pattern fields are independent state. Switching the function control between `EQUAL` and `CONTAIN` SHALL also preserve any already-entered `targets`, since both functions share the same multi-tag input; only a transition across the `EQUAL`/`CONTAIN` ↔ `REGEX` boundary clears the targets/pattern state (see the following requirement).

#### Scenario: Selecting a source preserves already-entered targets
- **GIVEN** the user has entered one or more targets before selecting a source
- **WHEN** the user selects a source from the source dropdown
- **THEN** the previously entered targets remain in the targets field, unchanged

#### Scenario: Switching between EQUAL and CONTAIN preserves entered targets
- **GIVEN** the user has selected `EQUAL` and entered one or more targets
- **WHEN** the user changes the function to `CONTAIN`
- **THEN** the previously entered targets remain in the targets field, unchanged

#### Scenario: Save stays enabled with no source selected
- **GIVEN** the editor is open with a function and at least one target entered but no source selected
- **WHEN** the user views the Save control
- **THEN** it is enabled

#### Scenario: An invalid Save click shows a required-field error instead of saving
- **GIVEN** the editor is open with a function and at least one target entered but no source selected
- **WHEN** the user clicks Save
- **THEN** `onSave` is not called and a "required field" inline error appears under the source control

#### Scenario: Save stays enabled with zero targets
- **GIVEN** a source and function are selected but no target has been entered
- **WHEN** the user views the Save control
- **THEN** it is enabled

#### Scenario: Clicking Save with zero targets shows a targets error instead of saving
- **GIVEN** a source and function are selected but no target has been entered
- **WHEN** the user clicks Save
- **THEN** `onSave` is not called and a "add at least one target" inline error appears under the targets input

#### Scenario: Targets are trimmed on save
- **GIVEN** the user enters a target value with leading/trailing whitespace
- **WHEN** the rule is saved
- **THEN** the stored `targets` entry has the whitespace trimmed

#### Scenario: Exact-duplicate target within one rule is rejected
- **GIVEN** the user has already added the target `engineering` to the current rule
- **WHEN** the user attempts to add `engineering` again (after trimming)
- **THEN** the duplicate is not added and the existing single tag remains

#### Scenario: Multiple distinct targets are allowed and combined with OR
- **GIVEN** the user adds `engineering` and `support` as targets under `CONTAIN`
- **WHEN** the rule is saved
- **THEN** the saved rule's `targets` is `['engineering', 'support']`, displayed with an "Or" separator between them

### Requirement: Single-rule editor validates REGEX rules

When `function` is `REGEX`, the editor SHALL offer exactly one text input (not a multi-tag input) for the pattern. Validation (`isValidRegex` in `libs/publish-panel/src/components/PublishAccessRuleEditor/PublishAccessRuleEditor.tsx`) SHALL operate on the trimmed pattern (`pattern.trim()`): a trimmed pattern longer than 200 characters (`MAX_RULE_VALUE_LENGTH`) SHALL be treated as invalid before attempting to construct a `RegExp`, matching the backend target-length limit and bounding synchronous parsing work on the browser's main thread. For patterns within the limit, validity SHALL be checked by attempting `new RegExp(trimmedPattern)` inside a try/catch; an empty (post-trim) pattern SHALL also be treated as invalid. An invalid pattern SHALL show a localized inline error, associated with the input via `aria-describedby`, once the field has non-empty content or the user has attempted a save; the error display SHALL NOT disable the Save action, but activating Save while the pattern is invalid SHALL NOT call `onSave`. On save, `handleSave` SHALL store the trimmed pattern as the single entry of `targets` (`targets: [pattern.trim()]`, so `targets.length === 1`). Saving the trimmed value keeps the stored rule identical to the string `isValidRegex` validated and length-checked, and matches the per-tag trimming applied to `EQUAL`/`CONTAIN` targets; the consequence is that a regex cannot carry meaningful leading or trailing whitespace — a pattern that needs it must express it inside the pattern (for example `\s` or `[ ]`).

#### Scenario: Valid regex is accepted
- **GIVEN** `function` is `REGEX` and the user enters `^eng-.*$`
- **WHEN** the user saves the rule
- **THEN** the rule is added with `targets: ['^eng-.*$']` and no error is shown

#### Scenario: Regex pattern is saved trimmed
- **GIVEN** `function` is `REGEX` and the user enters `  ^eng-.*$  ` (with leading and trailing spaces)
- **WHEN** the user saves the rule
- **THEN** validity is checked against `^eng-.*$`, and `onSave` receives `targets: ['^eng-.*$']` with the surrounding whitespace removed

#### Scenario: Invalid regex shows an inline error and a Save click does not save
- **GIVEN** `function` is `REGEX` and the user enters an unbalanced pattern such as `(unclosed`
- **WHEN** validity is checked
- **THEN** a localized inline error is shown, associated with the input via `aria-describedby`, and the Save control remains enabled
- **WHEN** the user then clicks Save
- **THEN** `onSave` is not called

#### Scenario: Empty regex is treated as invalid
- **GIVEN** `function` is `REGEX` and the pattern field is empty or whitespace-only
- **WHEN** the user clicks Save
- **THEN** the field is treated as invalid, an inline error is shown, and `onSave` is not called

#### Scenario: Oversized regex is rejected before parsing

- **GIVEN** `function` is `REGEX` and the pattern contains more than 200 characters
- **WHEN** validity is checked
- **THEN** the field is treated as invalid without constructing a `RegExp`, and a Save click does not call `onSave`

#### Scenario: Switching from REGEX to CONTAIN clears the single-pattern state
- **GIVEN** the user has entered a pattern under `REGEX`
- **WHEN** the user switches `function` to `CONTAIN`
- **THEN** the editor shows the multi-target tag input instead, starting empty, and does not carry the regex text over as a pre-filled tag

#### Scenario: Switching from EQUAL or CONTAIN to REGEX clears the targets state
- **GIVEN** the user has entered one or more targets under `EQUAL` or `CONTAIN`
- **WHEN** the user switches `function` to `REGEX`
- **THEN** the editor shows the single pattern input instead, starting empty, and does not carry any previously entered target over as a pre-filled pattern

### Requirement: Rules editor is disabled during submission and rules are limited to safe counts

The entire access-rules section (chips' remove controls, "Add rule", "Clear all", and the single-rule editor if open) SHALL be disabled whenever the host's `isSubmitting` is `true`, matching the existing folder-picker's `disabled={isSubmitting}` behavior (`PublishFoldersTree` in `PublishPanel.tsx`): `PublishPanel` passes `disabled={isSubmitting}` to `PublishAccessRules`, which disables each control and adds `pointer-events-none opacity-60` to the section. The UI SHALL block adding a rule once `rules.length` reaches `maxRules` (default 20) — the "Add rule" trigger is disabled and a `maxRulesReachedLabel` hint is shown — and block adding a target to a rule once that rule's `targets.length` reaches `maxTargetsPerRule` (default 20) (no upstream contract documents a limit, so these are explicit, symmetric frontend/backend caps).

#### Scenario: Rules section is disabled while a publish request is in flight
- **GIVEN** the user has clicked Publish and a request is in flight
- **WHEN** the rules section renders
- **THEN** every control in it (add, remove, clear, and any open rule editor) is disabled

#### Scenario: Adding a 21st rule is blocked in the UI
- **GIVEN** 20 rules are already present
- **WHEN** the user attempts to open the "Add rule" editor or save a new rule
- **THEN** the action is blocked (control disabled or save rejected) before any request is made

### Requirement: Rules reset when the publish panel closes

`usePublishFlow`'s `rules` state SHALL reset to `[]` whenever `reset()` is called, exactly as `selectedFolderPath` already resets — both `PublishConversationPanelContainer` (which calls `publishFlow.reset()` in its close handler) and `DetailsPanel`'s equivalent close handling (which also calls `publishFlow.reset()`) therefore clear rules automatically, with no additional wiring in either container. Reopening the panel for a new publish attempt SHALL start with `rules: []`, never rehydrated from a prior publication's rules (reading existing/inherited rules is out of scope for this change).

#### Scenario: Closing the panel discards unsaved rules
- **GIVEN** the user has added one or more rules but not yet submitted
- **WHEN** the panel is closed via Cancel, the header Close button, Escape, or the backdrop
- **THEN** reopening the panel for the same or a different item shows zero rules

#### Scenario: A successful publish does not carry rules into the next open
- **GIVEN** the user published successfully with two rules set
- **WHEN** the panel is reopened for another publish attempt
- **THEN** the rules section starts empty, not pre-filled with the previous submission's rules

#### Scenario: A failed publish preserves rules for retry within the same open panel
- **GIVEN** the user has entered rules and folder selection, and submission fails
- **WHEN** the submit-error callout is shown
- **THEN** the previously entered rules and folder selection remain visible and unchanged, available for the user to retry Publish without re-entering them

### Requirement: Selecting a folder pre-fills the editor with that folder's existing rules

Whenever `selectedFolderPath` changes to a defined folder, `usePublishFlow` SHALL call the host-supplied `onFetchExistingRules(folderPath: string[])` (if provided) and, on success, replace the current `rules` state entirely with the result — a full overwrite, not a merge or append. This includes discarding any rules the user had already added by hand for a previously selected folder. While the fetch is in flight, `isRulesLoading` SHALL be `true`; on failure, `hasRulesLoadError` SHALL be `true` and the current `rules` value SHALL be left unchanged (not cleared, not replaced with a partial/error result). When `selectedFolderPath` becomes `undefined` (the folder selection is cleared), `rules` SHALL reset to `[]` and `hasRulesLoadError` to `false`.

`PublishAccessRules` SHALL show a brief, non-blocking loading indicator (a `Spinner` plus `loadingLabel`) while `isRulesLoading` is `true`, and a non-blocking inline warning `Notification` (`loadErrorLabel`) when `hasRulesLoadError` is `true` — neither state disables the "Add rule" control or blocks folder reselection; the user may continue adding rules manually regardless of lookup success or failure.

#### Scenario: Selecting a folder with existing rules populates the editor
- **GIVEN** the destination folder `Organization/Data Science` has a previously configured rule (`source: 'role'`, `function: 'CONTAIN'`, `targets: ['engineering']`)
- **WHEN** the user selects that folder
- **THEN** the rules editor shows exactly that one rule as a chip, without the user having added it manually

#### Scenario: Selecting a folder with no existing rules shows an empty editor
- **GIVEN** the destination folder has never had rules configured
- **WHEN** the user selects that folder
- **THEN** the rules editor shows zero chips

#### Scenario: Changing the folder replaces previously fetched or manually entered rules
- **GIVEN** the user has selected folder A (pre-filled with one existing rule, or with a rule the user added by hand) and then selects folder B instead
- **WHEN** folder B's lookup resolves
- **THEN** the rules editor's contents are fully replaced with folder B's existing rules (or emptied, if folder B has none) — folder A's rules, whether fetched or manually added, no longer appear

#### Scenario: Deselecting the folder clears the rules editor
- **GIVEN** a folder is selected and the rules editor shows one or more chips
- **WHEN** the user deselects the folder (selection becomes cleared)
- **THEN** the rules editor shows zero chips

#### Scenario: A lookup failure shows a non-blocking notice and does not clear existing rules
- **GIVEN** the user has manually added a rule for the currently selected folder
- **WHEN** a subsequent rules-lookup fetch for that folder fails
- **THEN** a non-blocking inline notice appears, the manually added rule remains visible and unchanged, and the user can still add more rules or submit

#### Scenario: Lookup in flight does not block manual rule entry
- **WHEN** `isRulesLoading` is `true`
- **THEN** the "Add rule" trigger remains enabled and usable

### Requirement: Accessibility — keyboard, ARIA associations, and live-region announcements

Every chip's remove control SHALL be a real, keyboard-reachable button (a `GhostIconButton` with an `aria-hidden` `IconTrashX`) with an accessible name that identifies the rule being removed (`removeRuleAriaLabelTemplate`, default `'Remove rule for {source}: {targets}'`), not a bare icon with no label. The "Add rule" and "Clear all" controls SHALL each have accessible names. The single-rule editor's source/function controls SHALL have associated labels; the target input(s) SHALL have an associated label, and any validation error SHALL be linked to its field via `aria-describedby`. Adding a rule, removing a rule, and clearing all rules SHALL each be announced through a shared `aria-live="polite"` `role="status"` region local to the rules section (distinct from any individual button's own stable accessible name, per the project's a11y status-feedback pattern), rather than relying on the visual chip-list change alone. Pressing Escape while the single-rule editor is open (but not yet saved) SHALL cancel only that in-progress rule, without dismissing the entire Publish panel.

#### Scenario: Removing a rule is announced
- **WHEN** the user removes a rule's chip
- **THEN** the shared live region announces that the rule was removed, in addition to the chip disappearing visually

#### Scenario: Adding a rule is announced
- **WHEN** the user saves a new rule
- **THEN** the shared live region announces that a rule was added, in addition to the new chip appearing

#### Scenario: Invalid regex error is reachable by assistive technology
- **WHEN** an invalid regex error is shown under the pattern input
- **THEN** the input's `aria-describedby` references the error text's id, so a screen reader announces the error when the input receives focus

#### Scenario: Escape cancels only the in-progress rule
- **GIVEN** the single-rule editor is open with an unsaved, in-progress rule
- **WHEN** the user presses Escape
- **THEN** the editor closes without adding the rule, and the rest of the Publish panel remains open

#### Scenario: Every chip remove control is keyboard-operable
- **WHEN** the user tabs to a rule chip's remove control and presses Enter or Space
- **THEN** that rule is removed, identical to a mouse click

#### Scenario: Rules pre-filled from a folder selection are announced
- **WHEN** selecting a folder causes `usePublishFlow` to replace `rules` with a non-empty fetched result
- **THEN** the shared live region announces that existing rules were loaded for the selected folder, so a screen-reader user is not left unaware that the chip list changed out from under a folder-selection action

### Requirement: Responsive rendering without a desktop-only layout on mobile, and RTL-correct behavior

The single-rule editor SHALL render inline within the section on desktop (`desktop:static`) and as a full-screen step (`fixed inset-0 z-[60]`) within the existing full-screen mobile Publish panel — matching the project's mobile-first, CSS-driven responsive convention (named `mobile`/`desktop` Tailwind breakpoints, no JS `window.innerWidth` checks). Because `libs/publish-panel` is a host-agnostic library, it SHALL implement this purely with responsive Tailwind classes (no import of `apps/chat/src/hooks/breakpoint/useBreakpoint`, which is an app-owned hook a lib may not import) — never opening a desktop-styled modal on a mobile viewport. All new elements SHALL use logical Tailwind properties (`ms-*`/`me-*`, `text-start`/`text-end`, etc.) with no new physical-direction classes; the chip-remove icon and any directional icon introduced SHALL be mirrored in RTL via `rtl:scale-x-[-1]` only if it conveys direction — the "Or" separator and source/function selects are direction-agnostic and SHALL NOT be mirrored.

#### Scenario: Mobile editor never renders the desktop inline layout
- **WHEN** the "Add rule" editor opens on a mobile viewport
- **THEN** it renders as a full-screen step consistent with the rest of the mobile Publish panel, not the desktop inline row layout

#### Scenario: RTL renders the section with logical properties
- **WHEN** `dir="rtl"` is set on an ancestor and the rules section renders
- **THEN** spacing and alignment follow logical properties and flip correctly, with no hardcoded `left-*`/`right-*`/`ml-*`/`mr-*` class introduced by this section

#### Scenario: Symmetric icons are not mirrored
- **WHEN** the section renders in RTL
- **THEN** the chip remove (`IconTrashX`) icon is not flipped, since it is a symmetric, non-directional icon

### Requirement: Source options support search with shared highlighting

When `ruleSourceOptions` exceeds a length where a plain dropdown becomes hard to scan, (more than 8 options) the source control SHALL enable its built-in search (matching the existing `Select`'s `searchable` mode). Matched text in filtered source options SHALL be rendered using the shared `Highlight` component exported from `@epam/ai-dial-ui-kit`, per the project's search-result-highlighting convention — never a bespoke regex/`<mark>` highlighter. The editor SHALL track the query through the `Select`'s `onSearchQueryChange` callback and pass each option a `labelNode` of `<Highlight text={option} query={query} maxLines={1} />` while the query is non-blank, keeping the plain-string `label` as the option's filter key and accessible name.

#### Scenario: Typing in the source search highlights matched text
- **GIVEN** `ruleSourceOptions` includes `dial_roles` and the user types `role` in the source search field
- **THEN** the matching options are shown with the matched substring rendered via `Highlight`

#### Scenario: An empty search query renders plain option labels
- **GIVEN** the source dropdown is open and the search field is empty (or the dropdown has just reopened, which resets the query to `''`)
- **THEN** every source option renders its plain label with no highlight mark
