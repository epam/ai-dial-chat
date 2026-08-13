## ADDED Requirements

### Requirement: `CatalogContentFile` is an entity-agnostic file option model

`libs/catalog/src/models/item-details-data.ts` SHALL add:

```ts
export interface CatalogContentFile {
  /** Opaque id passed back to `onLoadContentFile`. Never parsed by the panel. */
  id: string;
  /** File name shown in the picker. */
  name: string;
}
```

and two optional fields on `CatalogItemPromptContent`:

- `files?: CatalogContentFile[]` — the files the Content tab can switch between.
- `selectedFileId?: string` — the id of the file `content` was resolved from.

The lib SHALL treat `id` as opaque: it SHALL NOT split it, decode it, or derive anything from its shape. It SHALL NOT learn what a skill, a bucket, or a resource URL is through this model — it receives resolved names and returns an id.

Both fields SHALL be exported from `libs/catalog/src/index.ts` so a host can name the type it builds.

#### Scenario: Ids round-trip unchanged

- **WHEN** a file option carries the id `'scripts/run.py'` and the user picks it
- **THEN** `onLoadContentFile` receives exactly `'scripts/run.py'`

---

### Requirement: The picker appears only when there is a choice to make

`ContentTab` SHALL render the file picker **only** when `files` holds two or more entries. Zero files, one file, or an absent `files` array SHALL render the body alone, exactly as the tab does today — a picker offering a single option is noise, since that file is already the body.

When rendered, the picker SHALL be an `InlineSelect` from `@epam/ai-dial-ui-kit` — the same borderless control the Connect tab already uses for its endpoint selector — opened on `selectedFileId`, with a file-count text beside it.

The Content tab SHALL keep its existing structure otherwise: the picker sits above the description summary, which sits above the body.

#### Scenario: Several files

- **WHEN** the Content tab renders with two file options
- **THEN** a picker and the file-count text are shown, and the picker's trigger names the selected file

#### Scenario: One file

- **WHEN** the Content tab renders with exactly one file option
- **THEN** no picker and no file count are rendered

#### Scenario: No files

- **WHEN** `promptContent.files` is absent
- **THEN** the tab renders exactly as it did before this capability existed

---

### Requirement: Picking a file loads its content through the host

`DetailsPanelProps` and `CatalogProps` SHALL each gain `onLoadContentFile?: (fileId: string) => Promise<string | undefined>`, and `Catalog` SHALL forward it to `DetailsPanel`.

On picking a file other than the one named by `selectedFileId`, the panel SHALL call `onLoadContentFile` with that file's id, show a loading state while it is pending, and render the resolved text as the body.

Reselecting the file named by `selectedFileId` SHALL restore the original `promptContent.content` **without** issuing a request — that text is already in hand.

A rejection, or a resolved `undefined`, SHALL render `texts.contentFileErrorLabel` as the body. The panel SHALL NOT throw, and SHALL NOT surface an error of its own beyond that text — the host owns notifications.

A picked file SHALL be discarded whenever the panel switches to another item or `selectedFileId` changes, so a re-fetched body is never shown under a stale filename.

#### Scenario: Picking another file

- **WHEN** the user picks a file other than the selected one and the host resolves its text
- **THEN** the body renders that text and the picker shows the newly picked file

#### Scenario: Reselecting the base file costs no request

- **WHEN** the user picks another file and then reselects the one named by `selectedFileId`
- **THEN** the original body is restored and `onLoadContentFile` has been called exactly once

#### Scenario: Load failure

- **WHEN** `onLoadContentFile` rejects
- **THEN** the body renders `texts.contentFileErrorLabel` and nothing throws

#### Scenario: Load resolves undefined

- **WHEN** `onLoadContentFile` resolves `undefined`
- **THEN** the body renders `texts.contentFileErrorLabel`

#### Scenario: Switching items drops the picked file

- **WHEN** a file is picked and the panel then renders a different item
- **THEN** the picker reopens on the new item's `selectedFileId` and its base body is shown

---

### Requirement: i18n, RTL, accessibility, and library-isolation contract for the picker

- **i18n**: every user-visible string SHALL be a prop with an English default — `texts.contentFileSelectorAriaLabel` (`'Select file'`), `texts.contentFileCountLabel` (`(count) => \`${count} files\``), `texts.contentFileLoadingLabel` (`'Loading file'`), `texts.contentFileErrorLabel` (`'Failed to load this file.'`). The count label is a **function** of the count, not a template string, so a host can apply its own plural rule. `libs/catalog` SHALL NOT call `useTranslation`.
- **Accessibility**: the picker SHALL carry an accessible name from `contentFileSelectorAriaLabel`. While a picked file loads, the tab SHALL render an `aria-live` status region announcing `contentFileLoadingLabel`, and that region SHALL be absent once loading settles.
- **RTL**: the picker row SHALL use logical Tailwind utilities only; `InlineSelect` inherits direction from the `dir` attribute on the document.
- **Typography and color**: the file-count text SHALL read its class from `ItemDetailsTypography.contentFileCountClassName`, defaulting to `'dial-tiny-text'`, and its color from `--cat-details-file-count-text` with a `--text-secondary` fallback, overridable through `ItemDetailsColors.contentFileCountText`.

#### Scenario: No hardcoded English beyond defaults

- **WHEN** the Content tab source is inspected
- **THEN** it contains no `useTranslation` call and every user-visible string reads from a prop with an English default

#### Scenario: Loading is announced

- **WHEN** a picked file's content is loading
- **THEN** a `role="status"` region carries the loading label

#### Scenario: Nothing is announced once loaded

- **WHEN** the picked file's content has resolved
- **THEN** no status region is present
