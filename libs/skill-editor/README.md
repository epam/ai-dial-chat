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

```json
{
  "dependencies": {
    "@epam/ai-dial-skill-editor": "*"
  }
}
```

## Peer Dependencies

- `react` `^19.0.0`
- `@epam/ai-dial-ui-kit` `*`
- `@epam/ai-dial-react-file-manager` `^0.2.0-dev.9`
- `@epam/ai-dial-chat-shared` `*`
- `@epam/ai-dial-editor-builder` `*`
- `@tabler/icons-react` `^3.0.0`
- `@uiw/react-markdown-preview` — CSS only, required by `LazyMarkdownEditor`
- `@uiw/react-md-editor` — CSS only, required by `LazyMarkdownEditor`

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

The header is rendered by `EditorLayout` (from `@epam/ai-dial-editor-builder`).
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
