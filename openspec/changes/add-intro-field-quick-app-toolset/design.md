## Context

Quick App creation (`POST /api/v1/applications`) and Toolset creation (`POST /api/v1/toolsets`)
both accept `name`, `description`, `iconUrl`, `version`, and `topics`, validated with
`class-validator` DTOs in `apps/chat-api/src` and forwarded to DIAL Core via
`@epam/ai-dial-typescript-sdk` (`saveCustomApplication` / `saveToolSet`). Neither the DIAL
Core `Application` nor `ToolSet` schema (`node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`)
has a dedicated `intro` field. Both schemas do expose a generic string-keyed property bag:
`application_properties` (`MapStringObject`) on `Application`, and `defaults`
(`MapStringObject`) on `ToolSet`.

On the frontend, `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` and
`apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx` render the same field set
(name, description, icon URL, version, topics) with the same `@epam/ai-dial-ui-kit` inputs
(`DialInput`, `DialTextarea`, `DialTagInput`), but with different ownership shapes:

- `AppsEditor/GeneralForm.tsx` is **self-contained**: it owns `useState` for every field and
  every error, validates inline inside `handleSubmit` (`NAME_PATTERN`/`VERSION_PATTERN`
  regexes, required-name check), calls `createApplication` itself, and additionally renders a
  live catalog-style `Card` preview (`@epam/ai-dial-catalog`) in a second column — a feature
  Toolset creation has no equivalent of.
- `ToolsetEditor/EditorForm/GeneralForm.tsx` is a **pure controlled view**: it receives
  `form: ToolsetFormData`, `errors: ToolsetFormErrors`, and `onChange` from its parent
  `ToolsetEditor.tsx`, which owns all state, the `validate()` function, and the submit call.

Both forms validate with plain manual `if`/regex checks and local error state — there is no
shared schema-validation library (no zod/yup) in these flows, and, until this change, no
shared component either.

There is no separate Catalog application in this repo: `apps/` contains only `chat` and
`chat-api`. "Catalog" is a view inside the Chat app
(`apps/chat/src/components/CatalogView/CatalogView.tsx`), which is what currently navigates
into both `AppsEditor` and `ToolsetEditor`. Both existing `GeneralForm.tsx` files are
therefore consumed from exactly one visual context today.

`libs/ai-dial-kit` already wraps a handful of `@epam/ai-dial-ui-kit` primitives
(`Button`, `SearchBar`, `TabRow`, `GhostIconButton`) at the app level, per the
"Component-First Development" convention in `.claude/rules/all-tsx.md`; `DialInput` /
`DialTextarea` / `DialTagInput` are not in that wrapped set and both existing forms already
import them directly from `@epam/ai-dial-ui-kit`.

`libs/catalog/src/models/catalog-styles.ts` establishes a precedent for letting an app re-skin
a shared lib component without forking it: a `styles` prop (`CatalogColors`/
`CatalogTypography`) applied as CSS custom properties with theme-var fallbacks. The archived
change `openspec/changes/archive/2026-05-16-add-input-component` used the same approach for
`libs/conversation-input`'s `Input` component (`InputColors`/`InputTypography` → `--ci-*` CSS
variables).

## Goals / Non-Goals

**Goals:**
- Let authors set a short `intro` (≤ 90 chars) when creating a Quick App or a Toolset.
- Reject `intro` over 90 characters with a clear error on both the frontend (before submit)
  and the backend (400 on the create endpoint), mirroring the existing `@MaxLength` pattern
  used in `apps/chat-api/src/conversations/dto/create-conversation.dto.ts`.
- Forward `intro` to DIAL Core as part of the create request body.
- Keep `libs/chat-api-client` as a generated artifact — no hand edits.
- Extract the field set shared by both "General step" forms into one library
  (`libs/deployment-creation-form`) so `intro` — and any future shared field — is implemented
  once, not twice, and so the two forms cannot silently drift out of sync on shared fields.
- Keep the extracted lib strictly isolated per the repo's library-isolation rule: no routes,
  no `apps/chat/src/server-api` imports, no generated `@epam/chat-api-client` types, no i18n,
  no knowledge of DIAL Core or REST paths.

**Non-Goals:**
- Editing/pre-filling `intro` on the update flow or displaying it back after creation
  (`GET`/edit-mode round-trip) — the task scope is creation only. See **Open Questions** for
  the follow-up this implies.
- Rendering `intro` anywhere in the catalog UI (card, preview) — no catalog-display
  requirement was requested.
- Changing the DIAL Core schema itself.
- Building a new design-token/theming system for the extracted lib beyond the
  CSS-custom-property override pattern already established by `libs/catalog` and the archived
  `add-input-component` change.
- Extracting the Quick App live preview panel (`Card` from `@epam/ai-dial-catalog`) or either
  form's surrounding page layout/navigation — neither is shared with Toolset creation.
- Migrating other existing `DialInput`/`DialTextarea`/`DialTagInput` call sites in the app
  (e.g. Toolset's `SettingsForm.tsx`/`AuthSection.tsx`) to the new `libs/ai-dial-kit`
  `Input`/`Textarea`/`TagInput` wrappers (see Decision 8) — only `deployment-creation-form`'s own
  usage is migrated here.

## Decisions

### 1. Where `intro` lives in the DIAL Core request body

**Decision**: send `intro` inside the existing generic property bag on each schema —
`application_properties.intro` for `saveCustomApplication`, and `defaults.intro` for
`saveToolSet` — rather than as a top-level field (which the Core SDK type does not declare
and would fail TypeScript compilation), and rather than overloading `descriptionKeywords`.

**Alternatives considered**:
- *Top-level field on `DialApplication`/Toolset request body*: not possible without a Core
  schema change; the SDK types are generated from Core's own OpenAPI contract.
- *Encode into `descriptionKeywords`*: would corrupt the existing topics/keywords semantics
  and complicate parsing back out.
- *Store only in chat-api's own layer (not forwarded to Core)*: rejected — the requirement
  explicitly asks for `intro` to be forwarded to Core, and chat-api has no independent
  persistence layer for application/toolset metadata.

**Risk this decision carries**: `application_properties` / `defaults` are generic maps
historically used for schema-specific configuration values, not simple display metadata, and
it is **not confirmed** that DIAL Core preserves arbitrary keys under these maps for custom
application/toolset schemas across writes and reads. This must be verified against a real
DIAL Core instance during implementation (or confirmed with the Core team) before treating
this as final. If Core drops or rejects unrecognized keys in these maps, the fallback is to
request a native `intro` field addition on the Core side; this proposal's frontend/backend
validation logic does not change either way.

### 2. Shape of the extracted `libs/deployment-creation-form` component

**Decision**: the shared component follows `ToolsetEditor/EditorForm/GeneralForm.tsx`'s
already-controlled shape, not `AppsEditor/GeneralForm.tsx`'s self-contained shape:

```ts
interface DeploymentCreationFormValues {
  name: string;
  description: string;
  iconUrl: string;
  version: string;
  topics: string[];
  intro: string;
}

interface DeploymentCreationFormErrors {
  name?: string;
  version?: string;
  intro?: string;
}

interface DeploymentCreationFormProps {
  values: DeploymentCreationFormValues;
  errors: DeploymentCreationFormErrors;
  onChange: (patch: Partial<DeploymentCreationFormValues>) => void;
  labels: DeploymentCreationFormLabels; // pre-translated strings/placeholders, passed by the app
  classNames?: DeploymentCreationFormClassNames; // optional per-slot className overrides
}
```

alongside a pure, framework-agnostic validator:

```ts
function validateDeploymentCreationFields(
  values: DeploymentCreationFormValues,
): DeploymentCreationFormErrors;
```

`AppsEditor/GeneralForm.tsx` is refactored to hold its existing `useState` values in the new
shape, call `validateDeploymentCreationFields` inside `handleSubmit` before its existing
`createApplication` call, and render `<DeploymentCreationForm>` in place of its inline
`DialInput`/`DialTextarea`/`DialTagInput` block — it keeps its own two-pane layout, the `Card`
preview, and the Cancel/Next buttons around the shared component.
`ToolsetEditor/EditorForm/GeneralForm.tsx` becomes a thin pass-through of
`form`/`errors`/`onChange` into `<DeploymentCreationForm>`, kept as a separate file for
consistency with its sibling section files (`SettingsForm.tsx`, `AuthSection.tsx`);
`ToolsetEditor.tsx`'s `validate()` calls the same shared `validateDeploymentCreationFields`
alongside its existing endpoint/auth-specific checks.

**Alternative considered**: making the lib own submission timing/flow (e.g., an
`onSubmit`/`isSubmitting` prop) to also absorb `AppsEditor`'s self-contained behavior —
rejected because Quick App's submit is a single-step create call while Toolset's "General"
section is one part of a multi-section save; forcing one submission-flow shape into the lib
would leak app-specific flow control into a component that should only know about field
values and validation.

### 3. Field-level i18n and props, not app strings, inside the lib

**Decision**: per the library-isolation rule, `libs/deployment-creation-form` does not import
`react-i18next` or read the app's i18n config. Each app-level caller passes already-translated
labels/placeholders/aria-labels through a `labels` prop (e.g.
`{ name: { label, placeholder, required }, intro: { label, placeholder }, ... }`), built from
its own `useTranslation()` call and `constants/translation-keys.ts` enum
(`AppsEditorI18nKeys`, `ToolsetEditorI18nKeys`), matching the existing convention documented in
`.claude/rules/all-tsx.md` for aria-labels in libs.

### 4. Visual adaptation across contexts without duplicating logic

**Decision**: the lib renders only the field list (labels, inputs, inline errors) with
neutral default Tailwind layout classes (a `flex flex-col gap-4`-style stack, matching what
`ToolsetEditor/EditorForm/GeneralForm.tsx` already uses) and accepts an optional `classNames`
prop for per-slot overrides (root container, individual field wrappers), following the
`CatalogColors`/`CatalogTypography`-style override pattern from `libs/catalog` and the
`InputColors`/`InputTypography` pattern from the archived `add-input-component` change. All
layout that currently differs between the two call sites — Quick App's two-column
form-plus-preview layout vs. Toolset's stacked single-column layout inside a multi-section
editor — stays in the app-level wrapper components, which already differ today and continue
to render their own containers around the shared field stack. No form-logic fork is needed to
support this: the visual difference is a placement/layout concern, entirely outside the
extracted component.

**Open point**: the request also asks the shared form to work in a "Catalog" and a "Chat"
visual context. Today both existing forms are reachable only through the Catalog view inside
the single Chat app (`apps/chat/src/components/CatalogView/CatalogView.tsx`); there is no
second, non-Catalog consumer in the current codebase. See **Open Questions**.

**Follow-up applied after visual review**: comparing the shipped `AppsEditor`/`ToolsetEditor`
pages against `libs/catalog`'s own pages showed a real, fixable divergence — page/panel
dividers used the strong `border-*-primary` token (`--stroke-primary`) while `libs/catalog`
(`Catalog.module.scss`, `DetailsPanel.module.scss`) consistently uses the much lighter
`border-*-tertiary` (`--stroke-tertiary`) for the same purpose. Fixed in
`AppsEditor.tsx`, `AppsEditor/GeneralForm.tsx`, `ToolsetEditorHeader.tsx`, and
`ToolsetEditorView.tsx` by switching those dividers to `-tertiary`, and bumped the inner form
padding from `p-4` to `p-6` to sit closer to Catalog's spacing scale. The chat-history-panel
collapsing to an icon rail on these routes (and on Catalog/File Manager) is separate,
pre-existing, intentional app-shell behavior (`apps/chat/src/app/app.tsx`'s
`isHistoryPanelOpen` effect, collapsing outside `/`/`/conversations/*`) — not a regression
from this change, and out of scope here. See Decision 8 for the input/textarea/tag-input
shape follow-up.

### 5. Frontend validation approach

**Decision**: extend the existing manual validation style (no new schema-validation library
introduced) but centralize it in `validateDeploymentCreationFields` inside
`libs/deployment-creation-form`, consistent with how `name`/`version`/`endpoint` are validated
today:
- `AppsEditor/GeneralForm.tsx`: call the shared validator inside `handleSubmit` in place of
  its inline `NAME_PATTERN`/`VERSION_PATTERN`/required checks; keep its own
  `submitError`/`isSubmitting` state for the network-call outcome, which is out of the shared
  validator's scope.
- `ToolsetEditor.tsx` `validate()`: call the shared validator for the general fields
  (`name`, `version`, `intro`) alongside its existing `endpoint`/auth-specific checks;
  `ToolsetFormErrors` (`apps/chat/src/types/toolsets.ts`) gains `intro?: string` and `version?: string` (existing) is now populated from the shared validator too.

**Alternative considered**: introducing a schema-validation library (zod) for these forms —
rejected as out of scope; it would touch unrelated existing fields and is a larger refactor
than this change warrants.

### 6. Backend validation approach

**Decision**: `@IsString() @IsOptional() @MaxLength(90)` on `intro` in both
`CreateApplicationBodyDto` and `ToolsetBodyDto`, with `@ApiPropertyOptional({ example: '...',
maxLength: 90 })` for Swagger, matching the `firstMessage`/`deploymentId` pattern in
`apps/chat-api/src/conversations/dto/create-conversation.dto.ts`. The global `ValidationPipe`
(`whitelist: true, forbidNonWhitelisted: true, transform: true`, per
`apps/chat-api/AGENTS.md`) already turns a `class-validator` failure into a 400 response with
no extra controller code needed.

### 7. Generated client regeneration

**Decision**: after updating the two backend DTOs, regenerate `libs/chat-api-client` from the
chat-api OpenAPI spec using the repository's existing `openapi` / `openapi:check` npm scripts
(source of truth: `apps/chat-api/src/openapi-spec.ts` → `libs/chat-api-client/openapi.json` →
`openapi-generator-cli`). Do not hand-edit `libs/chat-api-client/src/generated/**`. The new
`libs/deployment-creation-form` lib never imports `@epam/chat-api-client` — request-body mapping
(`CreateApplicationBodyDto`/`ToolsetBodyDto`) stays in the app-level containers
(`AppsEditor/GeneralForm.tsx`, `apps/chat/src/utils/toolsets.ts`), per library isolation.

### 8. `Input`/`Textarea`/`TagInput` wrappers added to `libs/ai-dial-kit` (reverses an earlier decision)

**Decision**: add thin `Input`, `Textarea`, and `TagInput` wrappers to `libs/ai-dial-kit`
(`libs/ai-dial-kit/src/components/{Input,Textarea,TagInput}/`), following the exact structure
of the existing `PrimaryButton`/`NeutralButton`/`GhostButton` wrappers in
`libs/ai-dial-kit/src/components/Button/Buttons.tsx`: a `ComponentPropsWithoutRef`-typed prop
alias, a pass-through `FC`, and (for `Input`/`Textarea`) a `className` override merged via
`mergeClasses` that bumps the field's corner radius to `!rounded-xl` (12px, matching
`SearchBar`'s own rounded field treatment already in this lib) on top of `DialInput`'s/
`DialTextarea`'s built-in 4px radius (`.dial-input { border-radius: 4px; ... }` in
`@epam/ai-dial-ui-kit`'s stylesheet). `Input.tsx` also imports a new `Input.scss` (reused by
`Textarea.tsx`, since `DialTextarea` renders with the same `.dial-input` class) that lightens
the field's **resting** border color from `--stroke-primary` (`#696e7c`) to `--stroke-tertiary`
(`#e0e6f0`), matching `libs/catalog`'s own divider convention (Decision 4's follow-up) —
per user review, the field border itself, not just page-level dividers, read as mismatched
against Catalog. The override explicitly restores the hover (`--stroke-accent-primary`),
focus (`--stroke-focus`), and error (`--stroke-error`) state colors with their own
`!important` rules, since overriding the base `.dial-input` rule with `!important` would
otherwise block the ui-kit's own non-`!important` state rules for those pseudo-classes.
`TagInput` is a pure pass-through for now — no stable CSS class hook for its outer field
border was found in the shipped ui-kit bundle to safely target. `libs/deployment-creation-form`
now imports `Input`/`Textarea`/`TagInput` from
`@epam/ai-dial-kit` instead of the primitives directly from `@epam/ai-dial-ui-kit`
(`libs/deployment-creation-form`'s `package.json`/`vite.config.mts` no longer list
`@epam/ai-dial-ui-kit` at all, since it is now only a transitive dependency through
`ai-dial-kit`). `.claude/rules/all-tsx.md` gained a "Text fields" entry alongside the existing
Button/SearchBar/Spinner/TabRow rules, banning direct `DialInput`/`DialTextarea`/`DialTagInput`
imports app-wide going forward.

**This reverses this proposal's original Decision (see the removed "No new UI-kit primitive"
bullet in `proposal.md`)**, which held that `DialInput`/`DialTextarea`/`DialTagInput` were
already the correct shared destination. That was correct as far as it went — the primitives
*are* the shared destination for behavior (label, error, validation states) — but it didn't
account for needing a single seam to *restyle* them consistently once a real visual-parity gap
against `libs/catalog` was identified (see Decision 4's follow-up and the border-color fix).
Without this wrapper, restyling only inside `deployment-creation-form` would have made its fields
diverge from every other `DialInput` usage in the app (Toolset's `SettingsForm.tsx`,
`AuthSection.tsx`, etc.) rather than converge with Catalog.

**Alternatives considered**:
- *Restyle only inside `libs/deployment-creation-form`* (e.g. a local `className` override just
  on this lib's own `DialInput` usages): rejected — would make this form's fields look
  different from every other text field in the app, the opposite of the stated goal.
- *Rebuild a fully custom input from raw HTML*, the way `SearchBar` does (custom `<input>` +
  `.module.scss` with CSS-var theming): rejected for `Input`/`Textarea` — `DialInput`/
  `DialTextarea` already implement label, required/optional indicator, error/invalid state,
  and caption text correctly; reimplementing that from scratch to change one CSS property
  would duplicate significant, already-correct behavior for no benefit. `SearchBar`'s
  from-scratch approach makes sense there because `DialSearch` is a narrow, single-purpose
  component being replaced with a differently-scoped one, not a general-purpose field.

**Scope note**: only `libs/deployment-creation-form`'s own field usage is migrated to the new
wrappers in this change. Other existing `DialInput`/`DialTextarea`/`DialTagInput` call sites
in the app are not touched here (see Non-Goals) — migrating them is a natural, low-risk
follow-up now that the wrapper exists, but is a separate, broader change.

## Risks / Trade-offs

- **[Risk]** DIAL Core may not persist unrecognized keys under `application_properties` /
  `defaults` for custom schemas. → **Mitigation**: verify against a real Core instance during
  implementation; if it fails, treat this as a Core-side follow-up and keep the
  frontend/backend validation work (which is independently valuable) while deferring the
  Core-forwarding piece.
- **[Risk]** Without a GET-side mapping, `intro` set at creation cannot currently be
  retrieved back through chat-api's existing read endpoints/DTOs. → **Mitigation**: explicitly
  scoped as a non-goal in this change (see Open Questions); does not block shipping creation
  support.
- **[Trade-off]** No shared frontend validation schema library is introduced, keeping the
  diff small but continuing the existing pattern of ad hoc manual validation, now centralized
  in one lib function instead of two copies.
- **[Risk]** Extracting a new lib mid-flight (rather than only adding a field) touches both
  forms' rendering, not just their state; regressions would affect both Quick App and Toolset
  creation at once. → **Mitigation**: per-slice verification (extract lib + migrate one form +
  test, before migrating the second) and component tests asserting both forms still render
  identically for the pre-existing fields, before `intro` is added.
- **[Trade-off]** The "Catalog vs. Chat visual context" requirement is satisfied by keeping
  layout app-owned and giving the lib a `classNames` escape hatch, rather than building a
  dedicated theming API, since no second (non-Catalog) consumer exists yet to validate a
  heavier API against. See Open Questions.

## Open Questions

1. Should a follow-up change add `intro` to the GET/list response DTOs
   (`apps/chat-api/src/applications/dto/application.dto.ts`,
   `apps/chat-api/src/toolsets/dto/get-toolset.dto.ts`) and to the edit-mode pre-fill in both
   forms, so an author can see/edit the `intro` they set at creation? This was out of scope
   for the current request but is a natural next step.
2. Should `intro` also be forwarded on **update** (`updateApplication`/`updateToolset`), not
   just create? The current request is scoped to creation only; if `intro` cannot be changed
   after creation, that should be communicated as a known limitation to authors.
3. Confirm with the DIAL Core team whether `application_properties.intro` / `defaults.intro`
   is an acceptable interim placement, or whether a native Core field is preferred before this
   ships broadly.
4. What concretely is the "Chat" visual context distinct from "Catalog"? Both existing forms
   today are only reachable through the Catalog view inside the single Chat app. If a second
   consumer (e.g. a non-Catalog entry point for creating a Quick App/Toolset from elsewhere in
   Chat) is planned, it should be named so `classNames`/style-override needs can be validated
   against a real second use rather than speculated upfront.
5. ~~Should `libs/deployment-creation-form`'s name/version regex patterns...~~ **Resolved during
   implementation**: `NAME_PATTERN`/`VERSION_PATTERN` are fixed constants inside
   `validateDeploymentCreationFields`, but applying them is gated by opt-in flags
   (`validateNamePattern`/`validateVersionPattern` on `DeploymentCreationFormValidationOptions`),
   defaulting to off. `AppsEditor/GeneralForm.tsx` passes both flags `true` (matching its prior
   behavior exactly); `ToolsetEditor.tsx`'s `validate()` passes neither (Toolset creation never
   enforced a name/version pattern before this change, and extraction must not silently add
   one). Only the required-name and intro-length checks are unconditionally shared between the
   two flows.
6. `TagInput`'s outer field border currently has no override applied (see Decision 8) because
   no stable CSS class hook was found in the shipped `@epam/ai-dial-ui-kit` bundle. Confirm
   with the ui-kit maintainers whether one exists (or can be added) so `TagInput`'s corner
   radius can match `Input`/`Textarea`.
7. Should the other existing `DialInput`/`DialTextarea`/`DialTagInput` call sites in the app
   (Toolset's `SettingsForm.tsx`, `AuthSection.tsx`) be migrated to the new `libs/ai-dial-kit`
   wrappers as a follow-up, so the whole app converges on one restyled field look rather than
   only the General step?
