## Why

Every catalog entity the user creates should open in one editor layout: a header row (back arrow, `<h1>` title, Cancel + Create/Save on the inline end), a 360 px left **Metadata** column and a right **Setup** column holding the type-specific fields. Today only the toolset editor renders that layout (`libs/toolset-editor/src/components/ToolsetEditor/ToolsetEditor.tsx:345`). Prompts and skills share its shell but not its left panel, and custom apps and quick apps still use a two-step wizard with a different, app-only header (`apps/chat/src/components/EditorHeader/EditorHeader.tsx:79`). Every new application type currently means another bespoke page, which is how three copies of the avatar-picker wiring came to exist (`apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx:319`, `apps/chat/src/pages/ToolsetEditor/CustomAppEditorView.tsx:103`, `apps/chat/src/pages/AppsEditor/GeneralForm.tsx:162`).

## Audit — do skills, prompts and toolsets use the same components? (request item 1)

Partly. All three use `EditorLayout` from `@epam/ai-dial-builder-form` for the header and the two-column frame. Below the header they diverge:

| | Toolset | Prompt | Skill |
|---|---|---|---|
| Shell | `EditorLayout` | `EditorLayout` | `EditorLayout` |
| Header (back + title + Cancel/primary) | yes | yes | yes |
| Primary label | Create / Save by mode | always **Save** (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx:245`) | Create / Save by mode |
| Left panel | `EditorSection` "Metadata" → `GeneralForm` → `DeploymentCreationForm` | **no split** — everything in `leftContent`, full width (`libs/prompt-editor/src/components/PromptEditor/PromptEditor.tsx:214`) | Files tree, not Metadata (`libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:422`) |
| Right panel | `EditorSection` "Setup" → `SettingsForm` | none | manifest form with its own `<h2>` file name, no `EditorSection` |
| Name / Description fields | `DeploymentCreationForm` | own `Input` / `Textarea` | own `Input` / `Textarea` |

Conclusion: the header matches, but the left panel does not. Prompt and skill must adopt the shared Metadata panel, rendered with the same `EditorSection` and field components as the toolset. Only Name and Description apply to them, because DIAL Core stores no avatar, version or tags for prompts or skills.

## What Changes

- **Generic editor shell (lib).** `@epam/ai-dial-builder-form` gains:
  - `EntityEditor`: the screenshot layout as one component. It composes `EditorLayout`, a "Metadata" `EditorSection`, a "Setup" `EditorSection`, and Cancel plus a Create/Save primary action. It adds an optional extra-actions slot (used for Preview) and an inline error/conflict region.
  - `MetadataForm`: the toolset lib's `GeneralForm` moved into builder-form. It adds a `fields` option so an entity type can render only the fields it has (Avatar, Name, Version, Description, Locales, Tags).
  - `useMetadataForm`: a headless hook that owns metadata values, touched state and `validateDeploymentCreationFields` errors. It surfaces errors only for fields the user has touched, and all of them on a submit attempt.
- **Generic application editor (app, request item 3).** A new `apps/chat/src/pages/ApplicationEditor/` holds one `ApplicationEditorPage`, driven by an `ApplicationEditorDefinition` registry keyed by a string enum `ApplicationEditorKind` (`Toolset`, `CustomApp`, `QuickApp`).
  - The page owns everything the three app editors share:
    - loading the edited deployment
    - avatar-picker wiring and labels (built once)
    - icon resolution
    - metadata validation
    - create/update through `apps/chat/src/server-api`
    - success notifications
    - `returnUrl` navigation
    - the saving overlay
  - A definition supplies only the rest: its Setup component, setup validation, payload mappers, i18n title keys, validation options and create strategy.
  - Adding a new application type means writing one definition and one Setup component.
- **Custom apps move to the layout (request item 2).** The General/Settings wizard becomes one page:
  - Metadata on the left.
  - `CustomAppSettingsForm` in Setup on the right (Features data, Attachment types, Max attachments, Completion URL).
  - The existing save confirmation popup stays.
- **Quick apps move to the layout (request item 2).** The two-step flow and the General-step Card preview are removed.
  - Metadata is on the left and the schema's external editor iframe fills Setup.
  - The iframe needs an existing application id. In create mode, Setup therefore shows a placeholder until **Create** saves the metadata. The page then switches in place to edit mode (`appId` in the URL) and loads the iframe.
  - Preview / Exit preview moves into the header's extra-actions slot. It swaps the Setup column for `AppPreviewChat`, as today.
- **Prompts and skills adopt the shared left panel.**
  - Prompt: Metadata (Name, Description) on the left, Setup (Instructions) on the right. The primary label becomes Create/Save by mode, like the other editors.
  - Skill: Metadata (Name, Description) plus the Files tree on the left. Setup on the right holds the Instructions of `SKILL.md`, or the selected supporting file's preview.
- **Removed.**
  - The app-only `EditorHeader` stepper component.
  - `CustomAppEditorView`.
  - The quick app's duplicate `pages/AppsEditor/GeneralForm.tsx`.
  - The three duplicated avatar-picker label objects.
- **Unchanged on purpose.**
  - Routes and query parameters: `/toolset-editor`, `/custom-app-editor`, `/apps-editor?schema&appId&returnUrl`, `/prompt-editor`, `/skill-editor`. Existing catalog links and deep links keep working. The quick app's `?step=` param is accepted and ignored.
  - The Locales field stays in Metadata.
  - Per-type validation rules stay as they are today (toolset keeps its loose version pattern; quick app keeps its name pattern and semver).

## Non-goals

- Adding avatar, version or tags to prompts or skills. There is no DIAL Core storage for them.
- A Setup form generated automatically from the application-type JSON schema. Quick-app Setup stays the schema's `editorUrl` iframe.
- Changing validation rules, API payloads, backend endpoints or the OpenAPI client.
- Changing the scheduled-task editor (`BuilderFormContainer`).

## Alternatives considered

1. **Baseline: restyle each page by hand.** Custom apps and quick apps would be rebuilt with `EditorLayout` + `EditorSection`, without a shared abstraction. It is the cheapest option, but it keeps five bespoke pages and three avatar-picker copies, and the next app type repeats the work. Rejected: it does not satisfy item 3.
2. **Generic shell in the lib, generic application page in the app (picked).** The layout and metadata state are host-agnostic, so they belong in builder-form. Load/persist, avatar storage, i18n and navigation are host concerns, so they belong in an app-level page driven by per-kind definitions. This follows the existing split between `libs/toolset-editor` and `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`.
3. **One fully generic lib `ApplicationEditor` including persistence.** Rejected. It would pull server-api calls, bucket resolution and notifications into a lib, which violates AGENTS.md §Library isolation.
4. **Schema-driven Setup (auto form from the JSON schema).** Deferred; the user chose the Setup-slot approach. It can be added later as another `ApplicationEditorDefinition` without touching the shell.

## Capabilities

### New Capabilities
- `application-editor-registry`: the generic app-level `ApplicationEditorPage` and the `ApplicationEditorDefinition` contract (Setup slot, setup validation, payload mappers, create strategy). It covers toolsets, custom apps, quick apps, and how a new application type is registered.

### Modified Capabilities
- `builder-form`: adds `EntityEditor`, `MetadataForm` (with `fields` visibility) and `useMetadataForm`.
- `toolset-editor-library`: `ToolsetEditor` composes `EntityEditor`/`useMetadataForm`, and `GeneralForm` becomes a re-export alias of builder-form's `MetadataForm`.
- `custom-app-editor`: the two-step wizard is replaced by the single Metadata | Setup page, and the duplicated name-required check is removed.
- `app-editor-flow`: the quick-app two-step flow, the stepper `EditorHeader` and the General-step Card preview are removed. Single-page Metadata | Setup with in-place create→edit and Preview in the header.
- `quick-app-authoring`: the requirements worded around "General step", "Settings step" and "Save & Exit" are reworded for the single-page flow (metadata-first create, Save persists metadata + iframe config).
- `prompt-editor`: Metadata/Setup split, and the primary label is Create/Save by mode.
- `skill-editor-library`: the left panel is Metadata + Files and the right panel is Setup.
- `skill-authoring`: the responsive-layout requirement is updated for the new panel contents.

## Impact

- **Libs (scope creep — shared libs touched):**
  - `libs/builder-form` gets new public exports.
  - `libs/toolset-editor`, `libs/prompt-editor` and `libs/skill-editor` change internal composition.
  - All four packages are `"private": true`, so there are no external consumers.
  - Isolation: the libs keep receiving the file-manager modal, bucket, `resolveIconUrl`, locale options, labels and persist callbacks as props. No lib learns REST paths, i18n, routing or storage. Those stay in `ApplicationEditorPage` and the per-kind definitions under `apps/chat/src/pages/ApplicationEditor/`.
- **App:**
  - `apps/chat/src/pages/AppsEditor/*` and `apps/chat/src/pages/ToolsetEditor/*` are rewritten or removed.
  - `apps/chat/src/components/EditorHeader/` is removed.
  - Routes in `apps/chat/src/app/app.tsx` point to `ApplicationEditorPage` with a kind.
- **i18n.** New keys:
  - `applicationEditor.setupPendingCreate` (the quick-app Setup placeholder before creation).
  - `customApp.createTitle` / `customApp.editTitle`, and `appsEditor.createTitle` / `appsEditor.editTitle` / `appsEditor.defaultTypeName` (titles interpolate the schema display name).
  - `editor.stepGeneral`, `editor.nextButton`, `editor.saveButton` ("Save & Exit"), `editor.stepsNavAriaLabel`, `editor.stepOfTotal` and `editor.moreActionsLabel` become unused and are removed from every locale.
  - The tags placeholder unifies on "Add tags, comma separated".
- **Docs:**
  - `docs/architecture.md` (route/page map, the removed `EditorHeader`).
  - `libs/builder-form/README.md` and `libs/toolset-editor/README.md` (new exports, alias).
  - Prompt/skill README layout notes.
- **Tests:**
  - New specs for `EntityEditor`, `MetadataForm`, `useMetadataForm` and `ApplicationEditorPage` per kind.
  - Removed specs for `EditorHeader` and the quick-app `GeneralForm`.
  - There is no E2E project in this repo (`apps/` holds `chat`, `chat-api`, `chat-overlay-sandbox` and `mcp-app-sandbox`), so the flows that click "Next" are covered only by the Vitest specs rewritten here.

## Acceptance criteria

- Toolset, custom app and quick app create/edit pages all render: back arrow + `<h1>` title, Cancel + Create/Save in the header, a "Metadata" section on the left (Avatar, Name*, Version, Description, Locales, Tags) and a "Setup" section on the right. There is no stepper and no footer bar on desktop.
- Prompt and skill render the same header and the same Metadata section component (Name, Description only) on the left.
- A single `ApplicationEditorPage` renders all three application kinds. Registering a new kind needs only a definition and a Setup component (proven by the unit test that registers a fake kind).
- Quick app create: Setup shows a placeholder, Create saves metadata and the iframe loads in place, then Save persists and exits. Preview works from the header.
- No duplicate avatar-picker label objects or `GeneralForm` copies remain, and `EditorHeader` is deleted.
- Mobile: sections stack (Metadata first) and actions move to the bottom bar via `EditorLayout`. RTL and a11y behaviour is unchanged.
- `npm run verify:full` and `npm run validate:docs` pass.

## Rollback / backward compatibility

This is not breaking for users or APIs. Routes, query params, payloads and validation rules are unchanged. The lib API changes are additive (`GeneralForm` stays as an alias of `MetadataForm`). Rollback is a revert of the change's commits. Each editor migrates in its own slice, so a single editor can be reverted independently.
