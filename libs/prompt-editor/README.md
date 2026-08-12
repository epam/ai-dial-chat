# @epam/ai-dial-prompt-editor

Form UI for authoring a reusable prompt — its name, description, body, and the
folder it lives in — together with the inline folder picker that can create,
rename, and delete folders.

The lib is deliberately passive about everything a prompt's storage implies. It
holds the field values and the folder sub-form's own state, and nothing else:
it never calls an API, never reads a route, never validates against a storage
contract, and never resolves a translation. Validation messages arrive as
strings through `errors`, folder mutations are delegated through
`folderActions`, and the host decides what "saved" means when `onSubmit` fires.
That keeps the same form usable by any host whose prompt storage differs from
DIAL's.

Reach for it when you need the full prompt-authoring surface. If you only need
the folder picker — inside a different form, say — `PromptFolderField` is
exported on its own.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-prompt-editor": "*"
  }
}
```

## Peer Dependencies

- `react` `^19.0.0`
- `@epam/ai-dial-ui-kit` `^0.13.0-dev.26`
- `@epam/ai-dial-chat-shared` `*`
- `@tabler/icons-react` `^3.0.0`

## Components

### `PromptEditor`

```tsx
import { PromptEditor } from '@epam/ai-dial-prompt-editor';
import type { PromptEditorValues } from '@epam/ai-dial-prompt-editor';

const EditPromptPage = () => {
  const initialValues = useMemo(
    () => (prompt ? { ...prompt } : undefined),
    [prompt],
  );

  const handleSubmit = (values: PromptEditorValues) => {
    const message = validate(values);
    if (message) {
      setErrors(message);
      return;
    }
    void save(values);
  };

  return (
    <PromptEditor
      isEditMode
      initialValues={initialValues}
      folders={folders}
      isLoading={isLoading}
      hasLoadError={loadError != null}
      isSaving={isSaving}
      errors={errors}
      onSubmit={handleSubmit}
      onCancel={goBack}
      onRetry={reload}
      folderActions={{
        onCreateFolder: (name, parentId) => createFolder({ name, parentId }),
        onRenameFolder: (folderId, name) => renameFolder(folderId, { name }),
        onDeleteFolder: (folderId) => deleteFolder(folderId),
        onValidateFolderName: validateFolderName,
      }}
      labels={{ createTitle: t('promptEditor.createTitle') }}
    />
  );
};
```

`initialValues` re-seeds the fields whenever its object identity changes, so a
host that loads asynchronously should memoise it and produce a new object only
once the data has arrived.

`onCreateFolder` and `onRenameFolder` may resolve with the resulting folder
path; when they do, the picker selects it. `onValidateFolderName` runs before
any mutation is dispatched — returning a message blocks it and shows the
message inline.

### `PromptFolderField`

```tsx
import { PromptFolderField } from '@epam/ai-dial-prompt-editor';

<PromptFolderField
  value={folderId}
  folders={folders}
  error={errors.folder}
  actions={folderActions}
  onChange={setFolderId}
/>;
```

The empty string is the root folder. Omitting `actions` renders the picker
alone, without the create / rename / delete controls.

## Types

```tsx
import type {
  PromptEditorErrors,
  PromptEditorFolder,
  PromptEditorLabels,
  PromptEditorProps,
  PromptEditorStyles,
  PromptEditorTypography,
  PromptEditorValues,
  PromptFolderActions,
  PromptFolderFieldProps,
} from '@epam/ai-dial-prompt-editor';
import { FolderFormMode } from '@epam/ai-dial-prompt-editor';
```
