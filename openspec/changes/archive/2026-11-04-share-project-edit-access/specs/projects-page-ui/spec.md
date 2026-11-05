## MODIFIED Requirements

### Requirement: Projects UI strings flow through react-i18next

Every user-visible string SHALL be resolved in `ProjectsPage` with `useTranslation().t()` and passed to the lib as a plain string. The keys live in a new `projects` namespace in `apps/chat/src/i18n/locales/en.json` and are referenced through a `ProjectsI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`:

- `projects.page.title` ("Projects")
- `projects.toolbar.searchPlaceholder`
- `projects.toolbar.searchAriaLabel`
- `projects.toolbar.sortNewest`
- `projects.toolbar.sortOldest`
- `projects.toolbar.sortNameAsc`
- `projects.emptyState.label`
- `projects.emptyState.description`
- `projects.noResults.label`
- `projects.error.label`
- `projects.incomplete.label`
- `projects.status.resultCount` (with `{{count}}` plural forms)
- `projects.source.personal`
- `projects.source.shared`
- `projects.source.organization`
- `projects.card.folderPath` ("Project location", the folder path's accessible name)

The sort control label reuses `ButtonsI18nKeys.Sort`, the retry label reuses `ButtonsI18nKeys.Retry`, and the clear-search label reuses `BasicI18nKeys.ClearSearch`, instead of new `projects.*` keys. The nav label key `navigation.projects` is specified in `navigation-routing`. The former `projects.card.updatedAt` key stays removed: the card's relative time comes from `Intl.RelativeTimeFormat`, not a translation. The former `projects.page.subtitle` key is removed; the design shows no page description, so `ProjectsPage` passes no `labels.subtitle`.

#### Scenario: Keys exist in en.json

- **WHEN** the change is applied
- **THEN** every `projects.*` key listed above exists in `en.json` and in `ProjectsI18nKeys`
- **AND** the keys `projects.page.subtitle`, `projects.toolbar.sortLabel`, `projects.toolbar.clearSearchLabel`, `projects.error.retry` and `projects.card.updatedAt` SHALL NOT exist

#### Scenario: The page title matches its navigation entry

- **WHEN** `ProjectsPage` renders in English
- **THEN** its `<h1>` reads "Projects", the same text as the `navigation.projects` entry that opens the page
