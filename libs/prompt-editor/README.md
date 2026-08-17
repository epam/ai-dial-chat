# @epam/ai-dial-prompt-editor

Form UI for authoring a reusable prompt — its name, description, and body —
together with a standalone folder picker (`PromptFolderField`) that a host can
compose in separately, with inline controls to create, rename, and delete
folders.

The lib is deliberately passive about everything a prompt's storage implies. It
holds the field values and nothing else: it never calls an API, never reads a
route, never validates against a storage contract, and never resolves a
translation. Validation messages arrive as strings through `errors`, and the
host decides what "saved" means when `onSubmit` fires. That keeps the same
form usable by any host whose prompt storage differs from DIAL's.

`PromptEditor` doesn't render a folder picker — compose `PromptFolderField` in
alongside it (in the host's own layout) when the host needs one; it holds the
folder sub-form's own state and delegates mutations through `folderActions`.

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
- `@epam/ai-dial-builder-form` `*`
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
      isLoading={isLoading}
      hasLoadError={loadError != null}
      isSaving={isSaving}
      errors={errors}
      onSubmit={handleSubmit}
      onBack={goBack}
      onCancel={goBack}
      onRetry={reload}
      labels={{ createTitle: t('promptEditor.createTitle') }}
    />
  );
};
```

`initialValues` re-seeds the fields whenever its object identity changes, so a
host that loads asynchronously should memoise it and produce a new object only
once the data has arrived.

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
  PromptEditorColors,
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
