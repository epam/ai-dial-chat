## Context

Three editors currently share the same header pattern (back arrow, title, Cancel + Save actions) but each implements it from scratch:

- `libs/skill-editor` — `SkillEditor` component owns a full two-column layout: files-tree sidebar (left, 360 px) and manifest-form pane (right); header is a `hidden…desktop:flex` row at the top.
- `apps/chat/src/pages/ToolsetEditor` — a two-step wizard (`ToolsetEditorHeader` + `ToolsetEditorView`) with step-tracking URL params, a "Next" create-on-advance pattern, and a footer. The redesign removes all of this.
- `libs/prompt-editor` — `PromptEditor` delegates its header/layout chrome to `BuilderFormContainer` from `@epam/ai-dial-builder-form`, a separate package.

The approved redesign for the toolset editor makes it identical in structure to the skill editor: same header chrome, no wizard, two static panels side-by-side (stacked on mobile).

## Goals / Non-Goals

**Goals:**
- Ship `@epam/ai-dial-editor-builder` with an `EditorLayout` component encapsulating the shared header + two-column responsive body
- Ship an `EditorSection` visual wrapper used inside each panel
- Migrate `ToolsetEditor` page to the new layout (Metadata left, Setup right)
- Migrate `libs/skill-editor`'s `SkillEditor` to use `EditorLayout`'s header and body frame
- Migrate `libs/prompt-editor`'s `PromptEditor` to use `EditorLayout`; remove the `@epam/ai-dial-builder-form` dependency from the lib
- Remove `ToolsetEditorHeader`, `ToolsetEditorView`, `ToolsetEditorSteps`, and the `step` URL param from the toolset editor

**Non-Goals:**
- Field-level shared components — Avatar, Name, Version, etc. remain in the app
- Any new backend API changes
- Changing the SkillEditor's files-tree behaviour or the PromptEditor's validation logic
- A shared "Section accordion" for mobile — `EditorLayout` stacks sections on mobile; skill editor's existing mobile accordion stays inside `libs/skill-editor`

## Decisions

### D1 — New Nx lib `libs/editor-builder`, package `@epam/ai-dial-editor-builder`

Rationale: Three consumers already justify extraction. The lib is `type:ui`, depends only on `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@tabler/icons-react` (all shared peer deps). It follows the same scaffold as `libs/skill-editor` and `libs/prompt-editor`.

Alternative considered: extend `libs/skill-editor` to also export the layout — rejected because it would give ToolsetEditor and PromptEditor an unrelated peer dependency tree.

### D2 — `EditorLayout` is the primary export

`EditorLayout` accepts:
- `onBack` + `backAriaLabel` — back-arrow button (calls host-provided handler; host owns navigation)
- `title: string` — h1/h2 heading in the header
- `leftContent: ReactNode` — occupies the left panel (360 px on desktop)
- `rightContent?: ReactNode` — occupies the right panel (flex-1 on desktop); when absent, `leftContent` expands to full width
- `actions: ReactNode` — Cancel + Save buttons slot in the header toolbar (host supplies the actual `GhostButton` and `PrimaryButton` instances so the host controls state, disabled state, and labels)
- `isSaving?: boolean` — when true, renders a `role="status"` aria-live polite "Saving…" SR-only announcement
- `labels: EditorLayoutLabels` — `{ savingStatusLabel?: string }` (English default `'Saving'`)
- `styles?: EditorLayoutStyles` — optional theming overrides

Rationale: The host supplies `actions` as a slot rather than individual button props because Cancel and Save have divergent states (Save may carry a spinner, Cancel may be conditionally disabled) that differ per consumer. Keeping the slot open avoids a combinatorial props explosion.

### D3 — `EditorSection` is a presentational wrapper only

`EditorSection` accepts:
- `title?: string` — optional section heading
- `children: ReactNode`
- `styles?: EditorSectionStyles` — optional color/typography overrides

It renders a bordered/card visual region. No state, no logic.

### D4 — Desktop two-column, mobile stacked

Desktop (≥ `desktop` breakpoint): left panel 360 px fixed, right panel `flex-1`, `gap-0` with a `border-e` divider.  
Mobile: both panels render in a single column, top-to-bottom, with consistent padding. No accordion in `EditorLayout` itself.

This means `libs/skill-editor`'s existing mobile accordion (wrapping the file-tree in a collapsible `Accordion`) continues to live inside the `leftContent` it passes to `EditorLayout`. `EditorLayout` neither knows about it nor controls it.

### D5 — SkillEditor header + frame migrated; files sidebar stays in `leftContent`

`libs/skill-editor`'s `SkillEditor` currently renders its own header `div` (with `hidden … desktop:flex`) and its own sidebar / content split `div`. After migration:
- The outer shell uses `EditorLayout` (`leftContent={filesPaneContent}`, `rightContent={mainPaneContent}`, `actions={actions}`, `headerContent` slot → `onBack`/`title`).
- The `headerContent` prop that the host currently passes into `SkillEditor` (the back button + h1 heading) is replaced by `onBack` + `backAriaLabel` + `title` on `EditorLayout`; `EditorLayout` builds the header row itself.
- The existing `headerContent` prop on `SkillEditorProps` is REMOVED; hosts pass `onBack`, `backAriaLabel`, and `title` directly.

Peer dependency `@epam/ai-dial-editor-builder` is added to `libs/skill-editor/package.json`.

### D6 — PromptEditor header + frame migrated; single-column body

`libs/prompt-editor`'s `PromptEditor` currently uses `BuilderFormContainer`. After migration:
- `BuilderFormContainer` is replaced by `EditorLayout` with `rightContent` absent (single-column mode).
- `@epam/ai-dial-builder-form` is removed from `libs/prompt-editor`'s dependencies.
- `EditorLayout` peer dep added.

### D7 — ToolsetEditor page: flat form, two sections, no step state

`apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` is rewritten to:
1. Remove `ToolsetEditorSteps`, `step` URL param, `handleNext`, `persistFormIfChanged`, `draftToolsetId`
2. Remove `ToolsetEditorHeader` and `ToolsetEditorView` components entirely
3. Wrap the page in `EditorLayout` with Metadata `leftContent` and Setup `rightContent`
4. Validation and saving logic is simplified — single `handleSave` on the one Save button in the header actions slot

The "draft create on Next" pattern is removed along with the wizard. The toolset is only created on final Save (the existing `handleSave` path). This simplification is safe because the draft-on-Next pattern only existed to allow the Settings step to have a real toolset id for the Connect section and for login — in the flat layout the toolset id is always available at save time.

The `ToolsetEditorQuery.Step` param is deleted. The `ToolsetEditorQuery.Id` and `ToolsetEditorQuery.ReturnUrl` params are unchanged.

### D8 — `EditorSection` inside ToolsetEditor sections

Metadata and Setup panels inside `ToolsetEditor` are each wrapped in `EditorSection` with a `title` prop. The section card style is provided by the lib.

### D9 — No shared field-level components

Avatar, Name, Version, etc. are all app-level fields. No field-level components are added to `editor-builder`. The separation is strictly layout.

## Risks / Trade-offs

- **`SkillEditorProps.headerContent` removal is breaking** → Mitigation: single known consumer (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`) is updated in the same change; the lib's README is updated to document `onBack`/`title` as replacements.
- **`PromptEditorProps` changes** → `BuilderFormContainer`-specific props (e.g. `backButtonLabel`) need to map to `EditorLayout` equivalents; check `libs/prompt-editor`'s full prop surface before finalising the migration.
- **Mobile stacking vs. accordion** → The skill editor's mobile accordion remains inside `leftContent`; this means SkillEditor on mobile looks slightly different (accordion header visible) from ToolsetEditor (plain stacked sections). This is intentional: the file tree requires a collapse affordance on small screens, whereas form sections do not.
- **ToolsetEditor "draft on Next" removal** → The Connect toolset section previously appeared only after `Next` created the draft. In the flat layout the Connect section can appear only after Save, when the toolset has a real id. This is an acceptable UX tradeoff for the simplified flow.

## Migration Plan

1. Scaffold `libs/editor-builder` (Nx lib, package.json, tsconfig, src/index.ts)
2. Implement `EditorSection` (simple)
3. Implement `EditorLayout` (header + two-column + mobile stack)
4. Migrate `libs/prompt-editor` (`BuilderFormContainer` → `EditorLayout`)
5. Migrate `libs/skill-editor` (`headerContent` → `onBack`/`title`, outer shell → `EditorLayout`)
6. Rewrite `ToolsetEditor` page (flat form, `EditorLayout`, two `EditorSection`s)
7. Remove `ToolsetEditorHeader`, `ToolsetEditorView`, `ToolsetEditorSteps`
8. Update docs (`docs/architecture.md`, `libs/editor-builder/README.md`, `libs/skill-editor/README.md`, `libs/prompt-editor/README.md`)

Rollback: each step is independently revertible; no database migrations are involved.

## Open Questions

- Should `EditorSection` support a `description` subtitle below the title? (Nice-to-have; not required for the toolset redesign)
- Does PromptEditor need a `rightContent` slot in the future (e.g. a prompt preview pane)? If likely, pass `undefined` now so it is easy to wire later.
