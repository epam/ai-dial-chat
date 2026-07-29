## MODIFIED Requirements

### Requirement: Navigation is driven by NAVIGATION_CONFIG

The `<Navigation>` component SHALL NOT hard-code route paths or icon components. It MUST iterate over the exported `NAVIGATION_CONFIG` constant from `apps/chat/src/constants/navigation.ts` to render buttons. Adding a new entry to `NAVIGATION_CONFIG` MUST automatically render a new button in the sidebar with no changes to `Navigation.tsx`, unless the entry declares an optional `featureFlag` key.

Each `NavigationItem` MAY declare an optional `featureFlag: string` field naming a short `useFeatureFlag` key. `<Navigation>` SHALL filter `NAVIGATION_CONFIG` before rendering: an item with no `featureFlag` always renders; an item with a `featureFlag` renders only when `useFeatureFlag(item.featureFlag)` resolves to `true` for the current session. Filtering MUST be evaluated on every render (it MUST react to a flag value becoming available/changing after initial mount, not just at first render).

#### Scenario: Config drives rendered buttons

- **WHEN** `NAVIGATION_CONFIG` contains two entries (home, catalog), neither with a `featureFlag`
- **THEN** exactly two icon buttons are rendered in the top `<div>` of `<nav>`

#### Scenario: Flag-gated item hidden when flag is off

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and `useFeatureFlag('scheduledTasksEnabled')` returns `false`
- **THEN** no button for that entry is rendered in `<nav>`

#### Scenario: Flag-gated item shown when flag is on

- **WHEN** `NAVIGATION_CONFIG` contains an entry with `featureFlag: 'scheduledTasksEnabled'` and `useFeatureFlag('scheduledTasksEnabled')` returns `true`
- **THEN** a button for that entry is rendered in `<nav>`, with the same `aria-label`/tooltip/active-state behavior as ungated entries

#### Scenario: Ungated entries are unaffected

- **WHEN** `NAVIGATION_CONFIG` mixes gated and ungated entries
- **THEN** every ungated entry renders regardless of any flag's value
