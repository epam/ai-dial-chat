# @epam/ai-dial-skill-editor

Form UI for authoring a DIAL Skill — its name, description, and Markdown
instructions — together with a file tree for the skill's supporting files and
folders, always anchored by a mandatory, non-removable root `SKILL.md` node.

The lib is deliberately passive about everything a skill's storage implies. It
holds the field values, the file tree's selection/expansion state, and the
in-progress add/remove sub-form's own state, and nothing else: it never calls
an API, never reads a route, never serializes YAML frontmatter or a ZIP
archive, never validates against DIAL's naming contract, and never resolves a
translation. Validation messages arrive as strings through `errors`, path
safety checks are delegated through `fileActions.validatePath`, and the host
decides what "created" means when `onSubmit` fires. That keeps the same form
usable by any host whose skill storage differs from DIAL Core's.

## Installation

Requires UI Kit ^0.15.0-dev.19 or later with the public `/editors` entry.
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
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.19`
- `@epam/ai-dial-react-file-manager` `^0.3.0-dev.7`
- `@epam/ai-dial-chat-shared` `*`

## Components

### `SkillEditor`

```tsx
import { SkillEditor } from '@epam/ai-dial-skill-editor';
import type {
  SkillEditorValues,
  SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';

const CreateSkillPage = () => {
  const [files, setFiles] = useState<SkillFileTreeNode[]>([]);

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
      fileActions={{
        validatePath: (path) => validateSkillRelativePath(path),
        onUploadFile: async (file, path) => {
          const blob = await file.arrayBuffer();
          setSupportingFileContent(path, blob);
          setFiles((prev) => [
            ...prev,
            { path, name: file.name, kind: SkillFileNodeKind.File },
          ]);
        },
        onRemoveNode: (path) =>
          setFiles((prev) => prev.filter((node) => node.path !== path)),
      }}
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

`fileActions.validatePath` runs before a device upload is accepted —
returning a message blocks it and shows the message inline. Removing any
other node requires the user to confirm a popup before
`fileActions.onRemoveNode` is called. The library currently offers only
"Upload from device" as an Add action; it does not support creating an empty
file or folder.

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

The header is rendered by `EditorLayout` (from `@epam/ai-dial-builder-form`).
Pass `onBack` (called when the back arrow is activated), `title` (the page
heading), and optionally `backAriaLabel` (accessible label for the arrow,
defaults to `'Back'`). The header, including the back arrow, Cancel/Create
actions, and saving status, appears on all viewports — no separate mobile
header is needed from the host.

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
  SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { SkillFileNodeKind } from '@epam/ai-dial-skill-editor';
```

`styles.colors` (`SkillEditorColors`) overrides the section-heading, Instructions-label, and border colors as CSS custom properties, falling back to this app's theme tokens (`--text-primary`, `--text-secondary`, `--stroke-tertiary`) and then to a hard-coded hex when no theme is present:

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

`styles.colors.refineActionText` and `refineErrorText` set `--se-refine-action-text` and `--se-refine-error-text`; defaults use `--text-primary` / `--text-error` with standalone fallbacks `#161b2d` / `#8b2020`. `refineActionText` colors the status feedback; the Refine and Undo buttons are kit `GhostButton`s and keep the kit's styling. `styles.typography.refineFeedbackClassName` defaults to `dial-small-text`. Direction is inherited; label rows wrap, and feedback uses live regions.

| Public class key | Class                               | Element        |
| ---------------- | ----------------------------------- | -------------- |
| `refineFeedback` | `dial-skill-editor-refine-feedback` | Field feedback |
