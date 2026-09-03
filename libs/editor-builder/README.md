# @epam/ai-dial-editor-builder

## Overview

Shared two-column editor layout and bordered section wrapper for DIAL authoring UIs (Skills, Prompts, Toolsets, and similar single-page editors). The package provides `EditorLayout` — a full-height shell with a header row (back button, title, action buttons) and a responsive two-column body — `EditorSection` — a bordered card wrapper for named groups of form fields — and `AddAvatar` — an icon-upload preview control. Section content is always supplied by the host; this lib owns only the structural chrome. `AddAvatar` does not open a file picker itself — the host wires `onAddAvatarClick` to its own file manager/upload flow and passes the resulting URL back in as `avatarUrl`.

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

Full-height editor shell with a header and a responsive two-column body. On desktop, `actions` render at the end of the header row. On mobile/tablet, `actions` instead render in a bordered bar pinned to the bottom of the page, outside the scrollable body, so they never overlap `leftContent`/`rightContent`; each button grows to share the bar's width equally, and the primary action (the last child, e.g. Save/Create) is placed on the inline-start side with Cancel on the inline-end side — the reverse of the header's order.

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
| `actions` | `ReactNode` | | — | Cancel + Save buttons. Rendered inline-end in the header on desktop, or in a pinned bottom bar on mobile/tablet. |
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

### `AddAvatar`

Avatar preview box with an "Add avatar" button and a format/size caption. Opening a file picker and validating the chosen file (type, size) is the host's responsibility — this component only renders the current state and reports clicks.

```tsx
import { AddAvatar } from '@epam/ai-dial-editor-builder';

<AddAvatar
  label="Avatar"
  avatarUrl={iconUrl}
  addAvatarLabel="Add avatar"
  captionText="PNG, JPG or SVG (max 1 MB)"
  onAddAvatarClick={handleOpenAvatarPicker}
/>
```

**Props**

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `label` | `string` | ✓ | — | Field label rendered above the preview box and button. |
| `avatarUrl` | `string` | | — | URL of the currently selected avatar image. When set, it fills the 64x64 preview box instead of the placeholder icon. |
| `avatarAlt` | `string` | | `''` | Alt text for the avatar image. |
| `addAvatarLabel` | `string` | | `'Add avatar'` | Label for the "Add avatar" button. |
| `captionText` | `string` | | `'PNG, JPG or SVG (max 1 MB)'` | Caption describing the accepted formats and max size. |
| `onAddAvatarClick` | `() => void` | ✓ | — | Called when the "Add avatar" button is clicked. The host opens its own file picker/manager and passes the resulting URL back in as `avatarUrl`. |
| `styles` | `AddAvatarStyles` | | — | CSS custom property overrides. |
| `className` | `string` | | — | Additional CSS class applied to the root element. |
