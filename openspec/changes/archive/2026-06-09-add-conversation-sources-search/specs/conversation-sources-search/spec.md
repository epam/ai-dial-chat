## ADDED Requirements

### Requirement: ConversationSourcesPanel renders a SearchInput in its header
The `ConversationSourcesPanel` SHALL render a `SearchInput` component (from `libs/sidebar/src/components/SearchInput`) in the panel header. The input SHALL be visible at all times when the panel is open, including when both attachment arrays are empty. The placeholder text SHALL be a translated string.

#### Scenario: Search input is present when panel is open with content
- **WHEN** the `ConversationSourcesPanel` is open and there are uploaded or generated attachments
- **THEN** a text input with a search placeholder SHALL be rendered in the header

#### Scenario: Search input is present when panel is open with no content
- **WHEN** the `ConversationSourcesPanel` is open and both `uploaded` and `generated` arrays are empty
- **THEN** the `SearchInput` SHALL still be rendered in the header

---

### Requirement: Search filters both uploaded and generated attachments by name
When a search query is entered, the panel SHALL filter both the `uploaded` and `generated` attachment arrays to only those whose display name contains the query string (case-insensitive substring match). The matching SHALL be performed against the `title` field of each `DisplayAttachment`, falling back to the `name` field when `title` is absent.

#### Scenario: Query matches attachments in both sections
- **WHEN** a non-empty query is typed and some attachments in both `uploaded` and `generated` contain the query substring (case-insensitive)
- **THEN** only matching attachments SHALL be shown in their respective sections

#### Scenario: Query matches attachments in one section only
- **WHEN** a non-empty query is typed and matching attachments exist only in `uploaded`
- **THEN** the `uploaded` section SHALL show matching items and the `generated` section SHALL be hidden

#### Scenario: Query is case-insensitive
- **WHEN** a query of `"report"` is typed and an attachment is titled `"Annual Report.pdf"`
- **THEN** that attachment SHALL be shown in the filtered results

#### Scenario: Empty query shows all attachments
- **WHEN** the search input is empty
- **THEN** all `uploaded` and `generated` attachments SHALL be displayed without filtering

---

### Requirement: ConversationSourcesPanel shows "No results found" when search yields no matches
When a non-empty search query is active and the filtered result for both `uploaded` and `generated` is empty, the panel SHALL display an `IconSearchOff` icon (from `@tabler/icons-react`) followed by a translated "No results found" message instead of the two empty sections.

#### Scenario: No attachments match the query
- **WHEN** a query is entered that does not match any attachment name in either `uploaded` or `generated`
- **THEN** an `IconSearchOff` icon and a "No results found" label SHALL be displayed and no `FilesSection` components SHALL be rendered

#### Scenario: Partial match restores sections
- **WHEN** a query that previously returned no results is modified to match at least one attachment
- **THEN** the matching `FilesSection`(s) SHALL appear and the "No results found" message SHALL disappear

---

### Requirement: Search query is reset when the panel closes
The `ConversationSourcesPanel` SHALL clear the search query whenever the panel transitions from open to closed, so that re-opening the panel starts with an empty search.

#### Scenario: Query is cleared on close
- **WHEN** the panel is open with a non-empty search query and `handleClose` is triggered
- **THEN** the search input SHALL be empty the next time the panel is opened

---

### Requirement: SearchInput and "No results found" text use translated strings
The search input placeholder and the "No results found" label in `ConversationSourcesPanel` SHALL use the app's i18n translation system (`useTranslation`). The following keys SHALL be defined in the English locale file (`en.json`):
- `conversationSourcesPanel.searchPlaceholder` → `"Search files…"`
- `conversationSourcesPanel.noResults` → `"No results found"`

#### Scenario: Translation keys are present in en.json
- **WHEN** the English locale file is loaded
- **THEN** `conversationSourcesPanel.searchPlaceholder` and `conversationSourcesPanel.noResults` SHALL resolve to non-empty strings
