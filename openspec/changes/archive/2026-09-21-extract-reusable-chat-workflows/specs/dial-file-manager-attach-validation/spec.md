## MODIFIED Requirements

### Requirement: Hidden-path rows are not selectable

`DialFileManagerModal` SHALL prevent selection of any grid row whose `path` contains a hidden path segment. A segment is hidden when it starts with `.` (for example `.env`, `.hidden`, or the file-manager placeholder `.dial_folder`). This includes files inside hidden folders. The `isRowSelectable` predicate SHALL return `false` for such rows.

The canonical `isHiddenPath(path: string): boolean` SHALL be owned by `@epam/ai-dial-chat-shared` and evaluate path segments rather than relying on a single marker string. The reusable attachment picker and shared modal SHALL consume this helper without an app-local duplicate.

i18n: tooltip key `DialFileManager.AttachingHiddenFilesNotAllowed`
RTL: none (tooltip text only)
Feature flag: none
Memoisation: the reusable picker SHALL expose a memoized `isRowSelectable` predicate that updates when its constraints change.

#### Scenario: Dot-prefixed hidden file is not selectable

- **WHEN** a row with `path` containing a dot-prefixed segment such as `/My files/.env` is rendered in the grid
- **THEN** `isRowSelectable` returns `false` for that row and the checkbox is not rendered / is disabled

#### Scenario: File inside a hidden folder is not selectable

- **WHEN** a file row has a `path` like `/My files/.hidden/child.txt`
- **THEN** `isRowSelectable` returns `false` for that row

#### Scenario: Normal file is still selectable

- **WHEN** a file row has a `path` with no dot-prefixed segments
- **THEN** `isRowSelectable` returns `true` for that row (subject to MIME and size rules)

---

### Requirement: MIME-type filtering in grid selection

When `allowedTypes` is provided and non-empty, `DialFileManagerModal` SHALL prevent selection of file rows whose `contentType` does not match any entry in `allowedTypes`.

Matching SHALL use the canonical `isMimeTypeAllowed(contentType, allowedTypes)` from `@epam/ai-dial-attachment-input`, consumed directly by the reusable attachment picker. Wildcard (`image/*`, `*/*`) matching MUST be supported.

When `allowedTypes` is empty or absent, all MIME types are allowed (no restriction).

MIME filtering applies to `DialFileNodeType.ITEM` rows only; `FOLDER` rows are unaffected by this rule.

RTL: none
Feature flag: none
Memoisation: the reusable picker SHALL expose a memoized `isRowSelectable` predicate that updates when its constraints change.

#### Scenario: File with disallowed MIME type is not selectable

- **WHEN** `allowedTypes` is `['image/*']` and a row has `contentType: 'application/pdf'`
- **THEN** `isRowSelectable` returns `false` for that row

#### Scenario: File with allowed MIME type is selectable

- **WHEN** `allowedTypes` is `['image/*']` and a row has `contentType: 'image/jpeg'`
- **THEN** `isRowSelectable` returns `true` (subject to hidden and size rules)

#### Scenario: No restriction when allowedTypes is empty

- **WHEN** `allowedTypes` is `[]` or not provided
- **THEN** all file rows are selectable regardless of content type

#### Scenario: Wildcard allows all subtypes

- **WHEN** `allowedTypes` is `['*/*']` and a row has any `contentType`
- **THEN** `isRowSelectable` returns `true`

---

