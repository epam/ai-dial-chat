## Why

The toolsets editor uses a bespoke two-step wizard layout that diverges from the single-page SkillEditor and PromptEditor screens. All three editors share the same header pattern (back arrow + title + Cancel/Save actions) and need a consistent two-column body (metadata left, configuration right; stacked on mobile), but each currently reimplements that chrome independently. Extracting shared layout into a new `editor-builder` lib eliminates duplication, unifies visual behaviour, and makes the toolset editor match the approved redesign.

## What Changes

- **NEW** `libs/editor-builder` — a new host-agnostic lib (`@epam/ai-dial-editor-builder`) that exports:
  - `EditorLayout` — two-column layout component (left panel + right panel, stacked on mobile) with a header row (back button, title, Cancel/Save actions)
  - `EditorSection` — visual section wrapper (card / bordered region) for grouping fields within a panel
  - Supporting types: `EditorLayoutLabels`, `EditorLayoutStyles`, `EditorLayoutProps`, `EditorSectionProps`
- **BREAKING** `libs/skill-editor` — `SkillEditor` migrates its header + body frame to `EditorLayout`; the files sidebar and manifest form remain owned by the lib, section chrome is delegated
- **BREAKING** `libs/prompt-editor` — `PromptEditor` migrates its `BuilderFormContainer` header + body frame to `EditorLayout`
- `apps/chat` — `ToolsetEditor` page is redesigned: wizard steps removed, layout replaced with `EditorLayout` (Metadata section left, Setup section right); all field content remains in the app
- `apps/chat` — `ToolsetEditorHeader`, `ToolsetEditorView`, and step-related constants/types cleaned up after the redesign

## Capabilities

### New Capabilities

- `editor-builder-library`: `libs/editor-builder` public surface — `EditorLayout`, `EditorSection`, props, labels, styles types; host-isolation contract; two-column/mobile-stack responsive layout; header with back button, title, and action slots; accessibility

### Modified Capabilities

- `toolset-authoring`: Two-step wizard requirement is removed; the editor becomes a single flat screen with a Metadata panel and a Setup panel matching the new `EditorLayout` structure
- `skill-editor-library`: `SkillEditor` delegates header and body-frame chrome to `EditorLayout` from `@epam/ai-dial-editor-builder`; public prop surface is unchanged except for any layout-only props that move to `EditorLayout`
- `prompt-editor`: `PromptEditor` delegates header and body-frame chrome to `EditorLayout`; `BuilderFormContainer` dependency is removed from the lib

## Impact

- New library: `libs/editor-builder/` (new Nx project, `@epam/ai-dial-editor-builder`)
- Modified libraries: `libs/skill-editor`, `libs/prompt-editor` (peer dep added, header/layout delegated)
- Modified app pages: `apps/chat/src/pages/ToolsetEditor/` (major redesign), `apps/chat/src/pages/SkillEditor/` (minor wiring update), `apps/chat/src/pages/PromptEditor/` (minor wiring update)
- Deleted components: `ToolsetEditorHeader.tsx`, `ToolsetEditorView.tsx` (or repurposed as thin wrappers)
- Deleted constants: `ToolsetEditorSteps` enum, step-related query params
- No backend changes; no API surface changes
- `@epam/ai-dial-builder-form` dependency may be removed from `libs/prompt-editor` once `EditorLayout` covers its use case
