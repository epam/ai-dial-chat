# Spec Delta

## Purpose

Defines the Preview row action of the standalone file manager page: which files it is offered for, how a chosen file opens in the attachment canvas, and where it is deliberately absent. Rendering of the content itself belongs to the `canvas` capability.

## ADDED Requirements

### Requirement: The standalone page offers Preview for files with a previewable extension

`DialFileManagerPage` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`) SHALL pass `previewLabel` (the translated `basic.preview` string), `onPreview` and `previewExtensions` to `DialFileManagerShell`, using the values returned by `useDialFilePreview` (`apps/chat/src/hooks/files/useDialFilePreview.ts`). The shell SHALL add `DialFileManagerActions.Preview` to the grid action labels only when `previewLabel` is provided, and SHALL NOT add it to the tree or bulk-actions labels. The installed `@epam/ai-dial-react-file-manager` then offers the row action only for file rows whose name ends in one of `previewExtensions`; folders never show it.

`previewExtensions` SHALL be a fixed list of dotted, lowercase extensions maintained in `apps/chat`, and every entry SHALL be a format the attachment canvas renders: text and data (`.txt`, `.md`, `.markdown`, `.json`, `.csv`, `.tsv`, `.xml`, `.yaml`, `.yml`, `.log`), HTML (`.html`, `.htm`), `.pdf`, Office (`.docx`, `.xlsx`, `.pptx`), and images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`). The list is not derived from the canvas at runtime.

#### Scenario: A Markdown file shows Preview

- **WHEN** the user opens the row menu of `notes.md` on `/files`
- **THEN** the menu contains a "Preview" item

#### Scenario: A folder or an unlisted extension does not

- **WHEN** the user opens the row menu of a folder, or of `archive.zip`
- **THEN** the menu contains no "Preview" item

#### Scenario: The label is grid-only

- **WHEN** the shell is rendered with a `previewLabel`
- **THEN** the grid action labels include Preview, and the tree and bulk-actions labels do not

#### Scenario: No label, no action

- **WHEN** the shell is rendered without `previewLabel`
- **THEN** no Preview action is offered, whatever `onPreview` and `previewExtensions` hold

### Requirement: Choosing Preview opens the file in the attachment canvas

`useDialFilePreview` SHALL, given the virtual path of the chosen row, look the file up in the loaded folder tree (`controller.items`, nested folders included), convert it with `dialFileToAttachment` for the user's bucket, and open it through `useOpenAttachmentCanvas` with the app's `useAttachmentCanvasResolvers`. Content SHALL therefore resolve exactly as it does for a conversation attachment: the same renderers, the same unsupported, load-error and forbidden states, and the same DIAL URL resolution and credentials. The hook SHALL do nothing when the path is missing, is not in the loaded tree, or belongs to a folder.

#### Scenario: A nested file opens in the canvas

- **WHEN** the user chooses Preview on `My files/docs/readme.md`, which sits two folders deep in the loaded tree
- **THEN** the canvas opens with an attachment named `readme.md`, whose URL is the file's DIAL URL for the user's bucket

#### Scenario: An unknown path or a folder does nothing

- **WHEN** `onPreview` is called with `undefined`, with a path that is not in the loaded tree, or with a folder's path
- **THEN** the canvas is not opened

#### Scenario: A file the canvas cannot render shows the canvas's own state

- **WHEN** the user previews a listed file whose content the canvas rejects
- **THEN** the panel shows the canvas's unsupported or error state, with its download button where the canvas offers one

### Requirement: Preview is not gated by the AttachmentsManager feature

Preview SHALL be available wherever the `/files` page is available, which already follows `OverlayFeature.FileManager`. It SHALL NOT depend on `OverlayFeature.AttachmentsManager` and SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. The canvas container is mounted on the `/files` route independently of that feature (see the `canvas` capability).

#### Scenario: Preview works with AttachmentsManager disabled

- **GIVEN** `OverlayFeature.AttachmentsManager` is disabled and `OverlayFeature.FileManager` is enabled
- **WHEN** the user chooses Preview on `/files`
- **THEN** the canvas panel opens

### Requirement: Other file-manager hosts show no Preview

The attach modal, the avatar picker, the skill file-system modal and the Copy/Move destination picker SHALL NOT receive `previewLabel` or `onPreview`, so none of them shows a Preview action. `@epam/ai-dial-react-file-manager` SHALL NOT be changed to support preview: the package keeps only its existing `onPreview` / `previewExtensions` hook, and the host decides what a preview looks like.

#### Scenario: The attach modal has no Preview

- **WHEN** the user opens the row menu of a Markdown file in the attach modal
- **THEN** there is no "Preview" item

### Requirement: Preview adds no new strings and no new directional UI

The action label SHALL reuse the existing `basic.preview` key in `apps/chat/src/i18n/locales/en.json` and every other locale file that carries it. The action is a row menu item rendered by the File Manager package, and the panel is the existing canvas (physically on the right in every direction), so the change adds no logical-property, icon-mirroring or ARIA requirements of its own.

#### Scenario: The label comes from the existing key

- **WHEN** the active language changes
- **THEN** the Preview item is labelled by `basic.preview` in that language
