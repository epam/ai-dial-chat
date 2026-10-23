# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
