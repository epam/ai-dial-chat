## MODIFIED Requirements

### Requirement: Public package surface
`libs/skill-editor/src/index.ts` SHALL export a `SkillEditor` React component plus every TypeScript type reachable through its props (form values, labels/texts, file-tree node types, callback signatures, error/status enums, edit-mode/conflict-state types). Internal-only helpers SHALL NOT be exported from the barrel. The package `libs/skill-editor/package.json` SHALL declare `name: "@epam/ai-dial-skill-editor"`, an `exports` map matching `libs/prompt-editor/package.json`'s shape (source/types/import/default for `.`, plus `./package.json`), and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-editor-builder`, and `@tabler/icons-react`.

The `headerContent?: ReactNode` prop IS REMOVED from `SkillEditorProps`. It is replaced by:
- `onBack: () => void` — called when the back button is clicked
- `backAriaLabel?: string` — accessible label for the back button (English default `'Back'`)
- `title: string` — heading text shown in the header

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` writes `import { SkillEditor, SkillEditorValues, SkillEditorLabels, SkillFileTreeNode, SkillEditorConflict } from '@epam/ai-dial-skill-editor'`
- **THEN** the import resolves successfully and every named type is defined

#### Scenario: headerContent prop is removed
- **WHEN** a consumer passes `headerContent={<>...</>}` to `SkillEditor`
- **THEN** the TypeScript compiler reports an error — `headerContent` is no longer a valid prop

#### Scenario: Back button delegates to onBack
- **WHEN** a user clicks the back-arrow button in the skill editor header
- **THEN** `onBack` is called exactly once

### Requirement: EditorLayout delegates header and body frame
`SkillEditor` SHALL use `EditorLayout` from `@epam/ai-dial-editor-builder` as its outer shell. `EditorLayout` SHALL receive:
- `onBack` forwarded from `SkillEditorProps`
- `backAriaLabel` forwarded from `SkillEditorProps`
- `title` forwarded from `SkillEditorProps`
- `leftContent` = the files-tree pane (sidebar)
- `rightContent` = the manifest-form / supporting-file pane
- `actions` = Cancel + Save buttons
- `isSaving` = `isSubmitting` prop value

The existing mobile accordion for the files pane (wrapping the file-tree in a collapsible section) SHALL remain inside the `leftContent` slot — `EditorLayout` does not own it.

#### Scenario: Header row rendered by EditorLayout
- **WHEN** `SkillEditor` renders
- **THEN** the header row (back arrow, title, Cancel, Save) is rendered by `EditorLayout`, not by a `div` local to `SkillEditor`

#### Scenario: Desktop two-column layout
- **WHEN** `SkillEditor` renders at desktop width
- **THEN** the files sidebar occupies the left 360 px panel and the manifest form occupies the right panel, with a vertical divider between them, exactly as before

#### Scenario: Mobile accordion stays in leftContent
- **WHEN** `SkillEditor` renders at mobile width
- **THEN** the files-tree accordion (collapsible "Editing file" summary) renders inside the left panel content — `EditorLayout` stacks the panels, and the accordion is contained within the left panel
