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
- `@epam/ai-dial-ui-kit` `^0.13.0-dev.26`
- `@epam/ai-dial-react-file-manager` `^0.1.0-dev.17`
- `@epam/ai-dial-chat-shared` `*`
- `@tabler/icons-react` `^3.0.0`

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
      headerContent={
        <>
          <BackButton onClick={goBack} />
          <h1>{isEditMode ? 'Edit skill' : 'Create skill'}</h1>
        </>
      }
      fileActions={{
        validatePath: (path) => validateSkillRelativePath(path),
        onUploadFile: async (file, path) => {
          const blob = await file.arrayBuffer();
          setSupportingFileContent(path, blob);
          setFiles((prev) => [...prev, { path, name: file.name, kind: SkillFileNodeKind.File }]);
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

`headerContent` is rendered verbatim at the start of the desktop header row,
before the Cancel/Create actions — typically a back button and page title
supplied by the host, since the library has no navigation or i18n knowledge
of its own. It is only shown at the `desktop` breakpoint; on narrower
viewports the host is expected to render its own equivalent header above the
`SkillEditor` component.

## Types

```tsx
import type {
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
