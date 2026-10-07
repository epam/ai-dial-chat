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

Requires UI Kit ^0.15.0-dev.39 or later with the public `/editors` entry.
The Markdown loader uses that entry, and library builds keep UI Kit subpaths
external to preserve the editor's dynamic boundary in consuming applications.

```json
{
  "dependencies": {
    "@epam/ai-dial-prompt-editor": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-prompt-editor/styles.css';
```

## Peer Dependencies

- `react` `^19.2.8`
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.39`
- `@epam/ai-dial-chat-shared` `*`

Installed for you as dependencies: `@epam/ai-dial-builder-form`,
`@tabler/icons-react`, and the two `@uiw` stylesheets `LazyMarkdownEditor`
needs (`@uiw/react-markdown-preview`, `@uiw/react-md-editor`).

## Components

### `PromptEditor`

Rendered on the shared `EntityEditor` shell from `@epam/ai-dial-builder-form`
as one centred column without section headings: the shared `MetadataForm`
narrowed to Name and Description, then the Instructions editor, which fills
the height left below them. The primary button reads `labels.createLabel` (default `'Create'`)
in create mode and `labels.saveLabel` (default `'Save'`) in edit mode.

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
      labels={{
        createTitle: t('promptEditor.createTitle'),
        createLabel: t('buttons.create'),
        saveLabel: t('buttons.save'),
      }}
    />
  );
};
```

`initialValues` re-seeds the fields whenever its object identity changes, so a
host that loads asynchronously should memoise it and produce a new object only
once the data has arrived.

The optional `onRefineDescription` callback,
`(value: string, signal: AbortSignal) => Promise<string>`, adds a Refine with
AI action (and Undo) beside the Description label; omit it to hide the action.
`PromptEditorLabels` extends `TextRefinementLabels` from
`@epam/ai-dial-chat-shared`, so the refinement copy (`refineWithAiLabel`,
`refineUndoLabel`, …) is passed through `labels`. Save is disabled while a
request is pending, and a new `initialValues` identity resets Undo.

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

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Two
elements therefore carry a stable public class, exported as
`PROMPT_EDITOR_CLASS`.

| Key           | Class                             | Element                                                    |
| ------------- | --------------------------------- | ---------------------------------------------------------- |
| `form`        | `dial-prompt-editor-form`         | The form column holding Name, Description and Instructions |
| `folderField` | `dial-prompt-editor-folder-field` | The folder picker row rendered by `PromptFolderField`      |

The classes carry no declarations of their own: nothing in `styles.css` selects
on them, so they change nothing until a host writes a rule. Renaming one, or
moving it to a different element, is a breaking change. The convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

```tsx
import { PROMPT_EDITOR_CLASS } from '@epam/ai-dial-prompt-editor';

PROMPT_EDITOR_CLASS.form; // 'dial-prompt-editor-form'
```

```css
.dial-prompt-editor-form {
  max-width: 960px;
}
```

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
