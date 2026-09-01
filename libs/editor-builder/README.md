# @epam/ai-dial-editor-builder

## Overview

Shared two-column editor layout and bordered section wrapper for DIAL authoring UIs (Skills, Prompts, Toolsets, and similar single-page editors). The package provides `EditorLayout` — a full-height shell with a sticky header row (back button, title, action buttons) and a responsive two-column body — and `EditorSection` — a bordered card wrapper for named groups of form fields. Section content is always supplied by the host; this lib owns only the structural chrome.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-editor-builder": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.0.0
- `@epam/ai-dial-ui-kit` `*`
- `@epam/ai-dial-chat-shared` `*`
- `@tabler/icons-react` ^3.0.0

## Components

### `EditorLayout`

Full-height editor shell with a sticky header and a responsive two-column body.

```tsx
import { EditorLayout } from '@epam/ai-dial-editor-builder';
import { GhostButton, PrimaryButton } from '@epam/ai-dial-ui-kit';

<EditorLayout
  title="New Toolset"
  onBack={handleBack}
  backAriaLabel="Back to toolsets"
  actions={
    <>
      <GhostButton label="Cancel" onClick={handleCancel} />
      <PrimaryButton label="Save" onClick={handleSave} />
    </>
  }
  isSaving={isSubmitting}
  labels={{ savingStatusLabel: 'Saving' }}
  leftContent={<MetadataSection />}
  rightContent={<SetupSection />}
/>
```

**Props**

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | ✓ | — | Heading text rendered as `<h1>` in the header row. |
| `onBack` | `() => void` | ✓ | — | Called when the back-arrow button is clicked. |
| `backAriaLabel` | `string` | | `'Back'` | Accessible label for the back-arrow button. |
| `actions` | `ReactNode` | | — | Inline-end header slot — typically Cancel + Save buttons. |
| `leftContent` | `ReactNode` | | — | Left column (Metadata). |
| `rightContent` | `ReactNode` | | — | Right column (Setup). When absent, left content fills full width. |
| `isSaving` | `boolean` | | `false` | When `true`, announces `savingStatusLabel` via `aria-live`. |
| `labels` | `EditorLayoutLabels` | | — | Text overrides with English defaults. |
| `styles` | `EditorLayoutStyles` | | — | CSS custom property overrides. |
| `dir` | `'ltr' \| 'rtl'` | | — | Explicit direction override forwarded to the root element. |

When `rightContent` is omitted, `leftContent` expands to full width at all viewport sizes.

### `EditorSection`

Bordered card wrapper for a named group of form fields.

```tsx
import { EditorSection } from '@epam/ai-dial-editor-builder';

<EditorSection title="Metadata">
  <NameField />
  <DescriptionField />
</EditorSection>
```

**Props**

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | | — | Optional heading rendered above the section body. |
| `children` | `ReactNode` | | — | Section body content. |
| `styles` | `EditorSectionStyles` | | — | CSS custom property overrides. |
| `className` | `string` | | — | Additional CSS class applied to the root element. |
