# file-manager-preview Specification

## Purpose
Defines the Preview row action of the standalone file manager page: which files it is offered for, how a chosen file opens in the attachment canvas, and where it is deliberately absent. Rendering of the content itself belongs to the `canvas` capability.

## Requirements

### Requirement: The standalone page offers Preview for files with a previewable extension

`DialFileManagerPage` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) SHALL set `labels.previewLabel` (the translated `basic.preview` string) and pass `onPreview` and `previewExtensions` to `DialFileManagerShell`, using the values returned by `useDialFilePreview` (`apps/chat/src/hooks/files/useDialFilePreview.ts`). The shell SHALL add `DialFileManagerActions.Preview` to the grid action labels only when `labels.previewLabel` is provided, and SHALL NOT add it to the tree or bulk-actions labels. The installed `@epam/ai-dial-react-file-manager` then offers the row action only for file rows whose name ends in one of `previewExtensions`; folders never show it.

`previewExtensions` SHALL be a fixed list of dotted extensions maintained in `apps/chat`, and every format in it SHALL be one the attachment canvas renders: text and data (`.txt`, `.md`, `.markdown`, `.json`, `.csv`, `.tsv`, `.xml`, `.yaml`, `.yml`, `.log`), HTML (`.html`, `.htm`), `.pdf`, Office (`.docx`, `.xlsx`, `.pptx`), and images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`). The installed `@epam/ai-dial-react-file-manager` compares a file's extension with this list exactly as written, without changing case, so each format SHALL be listed in lower case, UPPER case and Capitalized case (for example `.jpg`, `.JPG`, `.Jpg`). The list is not derived from the canvas at runtime.

#### Scenario: A Markdown file shows Preview

- **WHEN** the user opens the row menu of `notes.md` on `/files`
- **THEN** the menu contains a "Preview" item

#### Scenario: Upper-case and capitalized extensions qualify

- **WHEN** the user opens the row menu of `IMG_1234.JPG`, `Report.PDF` or `Notes.Md`
- **THEN** the menu contains a "Preview" item

#### Scenario: A folder or an unlisted extension does not

- **WHEN** the user opens the row menu of a folder, or of `archive.zip`
- **THEN** the menu contains no "Preview" item

#### Scenario: The label is grid-only

- **WHEN** the shell is rendered with a `labels.previewLabel`
- **THEN** the grid action labels include Preview, and the tree and bulk-actions labels do not

#### Scenario: No label, no action

- **WHEN** the shell is rendered without `labels.previewLabel`
- **THEN** no Preview action is offered, whatever `onPreview` and `previewExtensions` hold

### Requirement: Choosing Preview opens the file in the attachment canvas

`useDialFilePreview` SHALL, given the virtual path of the chosen row, look the file up in the loaded folder tree (`controller.items`, nested folders included) or, when the grid lists search hits, among the search results, convert it with `dialFileToAttachment` for the user's bucket, and open it through `useOpenAttachmentCanvas` with the app's `useAttachmentCanvasResolvers`. Content SHALL therefore resolve exactly as it does for a conversation attachment: the same renderers, the same unsupported, load-error and forbidden states, and the same DIAL URL resolution and credentials. The hook SHALL do nothing when the path is missing, is not in the loaded tree, or belongs to a folder. When the canvas reports that it could not open the file, or the file has no DIAL URL to open, the hook SHALL open the canvas in its unsupported state, with the file's name and, when the file has a URL, a download link, so choosing Preview never ends without a visible result.

#### Scenario: A nested file opens in the canvas

- **WHEN** the user chooses Preview on `My files/docs/readme.md`, which sits two folders deep in the loaded tree
- **THEN** the canvas opens with an attachment named `readme.md`, whose URL is the file's DIAL URL for the user's bucket

#### Scenario: A search hit outside the loaded tree opens

- **GIVEN** the grid lists `report.pdf` from a folder that was never loaded as a search hit
- **WHEN** the user previews that hit
- **THEN** the canvas opens with an attachment named `report.pdf`

#### Scenario: An unknown path or a folder does nothing

- **WHEN** `onPreview` is called with `undefined`, with a path that is in neither the loaded tree nor the search results, or with a folder's path
- **THEN** the canvas is not opened

#### Scenario: A file the canvas cannot open shows the unsupported state

- **WHEN** the user previews a listed file and the canvas resolves without opening it
- **THEN** the panel opens in its unsupported state, titled with the file's name, with a download button when the file has a URL

#### Scenario: A file without a URL shows the unsupported state

- **WHEN** the user previews a file that has neither a URL nor an id
- **THEN** the panel opens in its unsupported state without a download button

### Requirement: Preview is not gated by the AttachmentsManager feature

Preview SHALL be available wherever the `/files` page is available, which already follows `OverlayFeature.FileManager`. It SHALL NOT depend on `OverlayFeature.AttachmentsManager` and SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. The canvas container is mounted on the `/files` route independently of that feature (see the `canvas` capability).

#### Scenario: Preview works with AttachmentsManager disabled

- **GIVEN** `OverlayFeature.AttachmentsManager` is disabled and `OverlayFeature.FileManager` is enabled
- **WHEN** the user chooses Preview on `/files`
- **THEN** the canvas panel opens

### Requirement: Other file-manager hosts show no Preview

The attach modal, the avatar picker, the skill file-system modal and the Copy/Move destination picker SHALL NOT set `labels.previewLabel` or receive `onPreview`, so none of them shows a Preview action. `@epam/ai-dial-react-file-manager` SHALL NOT be changed to support preview: the package keeps only its existing `onPreview` / `previewExtensions` hook, and the host decides what a preview looks like.

#### Scenario: The attach modal has no Preview

- **WHEN** the user opens the row menu of a Markdown file in the attach modal
- **THEN** there is no "Preview" item

### Requirement: Preview adds no new strings and no new directional UI

The action label SHALL reuse the existing `basic.preview` key in `apps/chat/src/i18n/locales/en.json` and every other locale file that carries it. The action is a row menu item rendered by the File Manager package, and the panel is the existing canvas (physically on the right in every direction), so the change adds no logical-property, icon-mirroring or ARIA requirements of its own.

#### Scenario: The label comes from the existing key

- **WHEN** the active language changes
- **THEN** the Preview item is labelled by `basic.preview` in that language

### Requirement: Clicking a file on the standalone page opens its preview

On the standalone page, a click on a file row SHALL open that file in the attachment canvas exactly as the Preview row action does, whatever the file's extension and wherever the click lands on the row except the selection checkbox, the row menu and a row being renamed (the File Manager does not report those clicks). A file whose format the canvas cannot render SHALL open the canvas in its unsupported state, with a download button when the file has a URL, as an unsupported attachment does in a conversation. A click on a folder row SHALL keep opening the folder. The same applies to rows of a search listing. The attach, avatar and skill file-manager modals SHALL NOT open a preview on click.

#### Scenario: Clicking a Markdown file opens the panel

- **WHEN** the user clicks the row of `notes.md` on `/files`
- **THEN** the canvas opens with that file

#### Scenario: Clicking a file the canvas cannot render shows the unsupported state

- **WHEN** the user clicks the row of `backup.zip`
- **THEN** the panel opens in its unsupported state, with a download button

#### Scenario: Clicking a search hit opens it

- **WHEN** the grid lists search hits and the user clicks one that lies in a folder that was never loaded
- **THEN** the canvas opens with that file

#### Scenario: Clicking a folder still opens the folder

- **WHEN** the user clicks a folder row
- **THEN** the grid navigates into the folder and no preview opens

#### Scenario: Clicking the checkbox or the row menu does not open a preview

- **WHEN** the user clicks the selection checkbox or the row menu button of a file
- **THEN** no preview opens

#### Scenario: Modals do not open a preview on click

- **WHEN** the user clicks a file row in the attach modal
- **THEN** no preview opens

### Requirement: A superseded or orphaned preview does not open the canvas

A preview SHALL open the canvas only while it is the latest one the page requested and the page is still shown. A preview that a later preview supersedes, or whose content arrives after the user left the page, SHALL write nothing to the canvas, and SHALL NOT show the unsupported state either. The callbacks the page hands to the file manager (`onPreview`, `onFileClick`) SHALL keep their identity across listing refreshes, while reading the current listing.

#### Scenario: Only the last of two quick previews opens

- **WHEN** the user clicks a large file and, before it has loaded, clicks a second file
- **THEN** the canvas shows the second file, even if the first one finishes loading later

#### Scenario: A preview finishing after leaving the page opens nothing

- **WHEN** the user clicks a file and navigates away before it has loaded
- **THEN** the canvas is not opened when the content arrives

#### Scenario: A listing refresh keeps the callbacks and the latest listing

- **WHEN** the listing refreshes with new items
- **THEN** `onPreview` and `onFileClick` are the same functions as before, and previewing a file that only the new listing holds opens it
