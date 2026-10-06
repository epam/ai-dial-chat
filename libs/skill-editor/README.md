# @epam/ai-dial-skill-editor

Form UI for authoring a DIAL Skill — its name, description, and Markdown
instructions — together with a file tree for the skill's supporting files and
folders, always anchored by a mandatory, non-removable root `SKILL.md` node.

The lib is deliberately passive about everything a skill's storage implies. It
holds the field values, the file tree's selection/expansion state, and the
in-progress add/remove sub-form's own state, and nothing else: it never calls
an API, never reads a route, never serializes YAML frontmatter or a ZIP
archive, never validates against DIAL's naming contract, and never resolves a
translation. Validation messages arrive as strings through `errors`, every
staged file is validated and committed through `fileActions.validateBatch` /
`fileActions.commitBatch`, archives and file-system picks are resolved by the
host through `fileActions.extractArchive` / `fileActions.pickFromFileSystem`,
and the host decides what "created" means when `onSubmit` fires. That keeps the same form
usable by any host whose skill storage differs from DIAL Core's.

The form renders on the shared `EntityEditor` shell from
`@epam/ai-dial-builder-form`, the same one every entity editor uses: the
Files pane on the left, and on the right the selected file. For `SKILL.md`
that is Name and Description (the shared `MetadataForm`) followed by the
Instructions editor, which fills the height left below them; for a supporting
file it is its preview.

## Installation

Requires UI Kit ^0.15.0-dev.20 or later with the public `/editors` entry.
The Markdown loader uses that entry, and library builds keep UI Kit subpaths
external to preserve the editor's dynamic boundary in consuming applications.

```json
{
  "dependencies": {
    "@epam/ai-dial-skill-editor": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-skill-editor/styles.css';
```

## Peer Dependencies

- `react` `^19.2.8`
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.39`
- `@epam/ai-dial-react-file-manager` `^0.3.0-dev.25`
- `@epam/ai-dial-chat-shared` `*`

## Components

### `SkillEditor`

```tsx
import {
  SkillEditor,
  SkillFileCandidateKind,
  SkillFileNodeKind,
  SkillFileValidationStatus,
} from '@epam/ai-dial-skill-editor';
import type {
  SkillEditorFileActions,
  SkillEditorValues,
  SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';

const CreateSkillPage = () => {
  const [files, setFiles] = useState<SkillFileTreeNode[]>([]);

  const fileActions: SkillEditorFileActions = {
    validateBatch: async (candidates) => ({
      results: candidates.map((candidate) => ({
        candidateId: candidate.id,
        status: isSafePath(candidate.path)
          ? SkillFileValidationStatus.Valid
          : SkillFileValidationStatus.Invalid,
        kind: SkillFileCandidateKind.SupportingFile,
        error: isSafePath(candidate.path) ? undefined : 'Invalid path',
      })),
      batchErrors: [],
    }),
    commitBatch: async (candidates) => {
      await storeContents(candidates);
      setFiles((prev) => [
        ...prev,
        ...candidates.map((candidate) => ({
          path: candidate.path,
          name: candidate.file.name,
          kind: SkillFileNodeKind.File,
        })),
      ]);
      return {};
    },
    onRemoveNode: (path) =>
      setFiles((prev) =>
        prev.filter(
          (node) => node.path !== path && !node.path.startsWith(`${path}/`),
        ),
      ),
    // Optional — each one enables its Add-menu entry.
    onCreateFolder: (path) =>
      setFiles((prev) => [
        ...prev,
        {
          path,
          name: path.split('/').pop() ?? path,
          kind: SkillFileNodeKind.Folder,
        },
      ]),
    extractArchive: (archive) => unzipToEntries(archive),
    pickFromFileSystem: () => openHostFilePicker(),
  };

  const handleSubmit = (values: SkillEditorValues) => {
    const message = validate(values);
    if (message) {
      setErrors(message);
      return;
    }
    void createSkill(values, files);
  };

  return (
    <SkillEditor
      files={files}
      isSubmitting={isSubmitting}
      submitError={submitError}
      errors={errors}
      onSubmit={handleSubmit}
      onCancel={goBack}
      onBack={goBack}
      backAriaLabel="Back to catalog"
      title={isEditMode ? 'Edit skill' : 'Create skill'}
      fileActions={fileActions}
      labels={{ nameLabel: t('skillEditor.nameLabel') }}
    />
  );
};
```

`initialValues` re-seeds the fields whenever its object identity changes, so a
host that loads asynchronously should memoise it and produce a new object only
once the data has arrived. The root `SKILL.md` node is synthesised internally
and is always present, first, and selected by default — it never appears in
the `files` prop and never exposes a rename/move/delete affordance.

### Adding files and folders

The Files pane header renders an **Add** dropdown (ui-kit `ButtonDropdown`), and
every node except `SKILL.md` has a context menu of **Add child** (folders
only), **Add sibling** and **Delete**. Add child and Add sibling are submenus
holding the same entries as the Add dropdown. An entry appears only when its
host capability is supplied:

| Entry                      | Requires                         | Behaviour                                                                                                             |
| -------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Create folder              | `fileActions.onCreateFolder`     | Inline-named draft folder; confirmed names reach `onCreateFolder(path)`                                               |
| Upload files from device   | —                                | Opens the upload dialog (`SkillFileUploadMode.Files`)                                                                 |
| Upload archive from device | `fileActions.extractArchive`     | Opens the upload dialog in `SkillFileUploadMode.Archive`; each `.zip` is expanded by the host and staged              |
| Open DIAL file system      | `fileActions.pickFromFileSystem` | Awaits the host picker; resolved `SkillFileSourceEntry[]` open the upload dialog pre-staged (`undefined` = cancelled) |

Every add action targets a folder: from the header, the selected folder (or
the root when a file or `SKILL.md` is selected); from Add child, that folder;
from Add sibling, the node's parent. Staged paths are prefixed with it. Files
from every source go through `fileActions.validateBatch` and
`fileActions.commitBatch`, so per-file errors look the same whatever the source.

An inline folder name is rejected when it is empty, contains `/` or `\`, is
`.`/`..`, or matches a sibling (or `SKILL.md` at the root); after that,
`fileActions.validateFolderPath` may reject it with a host message. The library
treats a folder as a plain node in `files` whether or not anything is under it;
persisting it is the host's concern. The DIAL Chat host keeps an empty folder
across Save and reload through a storage marker the library never sees.

**Delete** removes the node (a folder with everything under it) immediately,
with no confirmation, and calls `fileActions.onRemoveNode(path)`. The library
never offers creating an empty file.

`onValuesChange` reports the complete current `SkillEditorValues` whenever the
user edits `name`, `description`, or `instructions` — including a paste into
the Instructions editor. It is not called for file-tree changes (those arrive
through `fileActions` and `onDirtyChange`) and not called while the form seeds
from `initialValues`, since seeding is not a user edit. Use it to validate a
field's content as it changes and feed the result back through `errors`; the
component derives no meaning from the values it reports:

```tsx
<SkillEditor
  // ...
  onValuesChange={(values) =>
    setErrors(
      isFrontmatter(values.instructions)
        ? { instructions: t('skillEditor.error.instructionsFrontmatter') }
        : {},
    )
  }
/>
```

The header is rendered by `EntityEditor` (from `@epam/ai-dial-builder-form`).
Pass `onBack` (called when the back arrow is activated), `title` (the page
heading), and optionally `backAriaLabel` (accessible label for the arrow,
defaults to `'Back'`). The header, including the back arrow, Cancel/Create
actions, and saving status, appears on all viewports; on mobile the actions
move to a fixed bottom bar. The primary button reads `labels.createLabel`
(default `'Create'`), so a host editing an existing skill passes its own Save
label there.

On mobile the column stacks the Files pane as a collapsed "Editing file"
accordion, then the selected file. Its heading is `SKILL.md` for the manifest,
or `labels.selectedFileHeading(name)` for a supporting file; Name and
Description show only while `SKILL.md` is selected. `submitError` and
`conflict` (with its "Reload latest" action) render in a `role="alert"` region
above the selected file.

## Types

```tsx
import type {
  SkillEditorColors,
  SkillEditorErrors,
  SkillEditorFileActions,
  SkillEditorLabels,
  SkillEditorProps,
  SkillEditorStyles,
  SkillEditorTypography,
  SkillEditorValues,
  SkillFileSourceEntry,
  SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import {
  SkillFileNodeKind,
  SkillFileUploadMode,
} from '@epam/ai-dial-skill-editor';
```

`SkillFileSourceEntry` is `{ path, file }` — a file a host source supplies,
with `path` relative to the folder being added to. `SkillFileUploadMode`
(`Files` / `Archive`) names the upload dialog's two modes.

`labels` (`SkillEditorLabels`) gives every string an English default. The
file-tree entries are `addLabel`, `createFolderLabel`, `uploadFilesLabel`,
`uploadArchiveLabel`, `openFileSystemLabel`, `addChildLabel`,
`addSiblingLabel`, `deleteLabel`, `newFolderDefaultName`,
`folderNameRequiredError`, `folderNameInvalidError`,
`folderNameDuplicateError`, and the archive dialog's
`uploadArchiveDialogTitle`, `uploadArchiveDropZoneLabel`,
`uploadArchiveDropZoneMobileLabel`, `uploadArchiveErrorMessage`,
`uploadArchiveEmptyMessage` and `uploadArchiveExtractingAriaLabel`.
`styles.typography.menuIconClassName`
colors the Add-menu icons (`'text-secondary'` by default);
the Delete entry renders as a danger (red) item, and `removeIconClassName`
overrides its icon color.

`styles.colors` (`SkillEditorColors`) overrides the heading, Instructions-label, and border colors as CSS custom properties, falling back to this app's theme tokens (`--text-primary`, `--text-secondary`, `--stroke-tertiary`) and then to a hard-coded hex when no theme is present:

```tsx
<SkillEditor
  // ...
  styles={{
    colors: { title: '#161b2d', helperText: '#57647a', border: '#e0e6f0' },
    typography: { titleClassName: 'dial-body-semi-text' },
  }}
/>
```

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. The root
surface therefore carries a stable public class, exported as
`SKILL_EDITOR_CLASS`.

| Key    | Class                    | Element                                                     |
| ------ | ------------------------ | ----------------------------------------------------------- |
| `root` | `dial-skill-editor-root` | The editor's root surface, which is also the file drop zone |

The class carries no declarations of its own: nothing in `styles.css` selects on
it, so it changes nothing until a host writes a rule. Renaming it, or moving it
to a different element, is a breaking change. The convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

```tsx
import { SKILL_EDITOR_CLASS } from '@epam/ai-dial-skill-editor';

SKILL_EDITOR_CLASS.root; // 'dial-skill-editor-root'
```

```css
.dial-skill-editor-root {
  background: var(--bg-layer-base);
}
```

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.

## AI text refinement

The form accepts optional `onRefineDescription` and `onRefineInstructions` callbacks, each `(value: string, signal: AbortSignal) => Promise<string>`. Each callback independently opts its field into refinement; omit it to hide the action. The host owns transport, availability, purpose selection, and translations. Success and Undo call `onValuesChange` and participate in dirty tracking. Changing `initialValues` identity cancels requests and resets Undo, even for equal text.

Both fields stay editable while pending. Editing the active field (including Markdown toolbar edits) aborts and invalidates its request. Both Refine actions and Save are disabled during a request; Cancel/Back abort before invoking the host. Late responses are ignored even if the callback ignores its signal. Repeated refinement retains the original baseline; Undo restores it exactly. Manual/external edits, callback removal, submission, and leaving the editor clear the baseline. Errors preserve text and allow retry. Identical output announces no change without writing the value.

Optional label overrides (English defaults):

| Label                      | Default                                       |
| -------------------------- | --------------------------------------------- |
| `refineWithAiLabel`        | Refine with AI                                |
| `refineUndoLabel`          | Undo                                          |
| `refineErrorLabel`         | Could not refine this text. Please try again. |
| `refinePendingAriaLabel`   | Refining text                                 |
| `refineSuccessAriaLabel`   | Text refined. Undo is available.              |
| `refineUndoAriaLabel`      | Original text restored.                       |
| `refineUnchangedAriaLabel` | No changes were needed.                       |

`styles.colors.refineActionText` and `refineErrorText` set `--se-refine-action-text` and `--se-refine-error-text`; `refineErrorText` defaults to `--text-error` with standalone fallback `#ae2f2f`. `refineActionText` colors the status feedback; unset, the status keeps the kit `CaptionText` styling (`dial-tiny-text`, `--text-secondary`), the same as input captions. The Refine and Undo buttons are kit `GhostButton`s and keep the kit's styling. `styles.typography.refineFeedbackClassName` has no default; the kit caption class applies when it is unset. Direction is inherited; label rows wrap, and feedback uses live regions.

| Public class key | Class                               | Element        |
| ---------------- | ----------------------------------- | -------------- |
| `refineFeedback` | `dial-skill-editor-refine-feedback` | Field feedback |
