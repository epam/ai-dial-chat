## Context

Quick App creation (`POST /api/v1/applications`) and Toolset creation (`POST /api/v1/toolsets`)
both accept `name`, `description`, `iconUrl`, `version`, and `topics`, validated with
`class-validator` DTOs in `apps/chat-api/src` and forwarded to DIAL Core via
`@epam/ai-dial-typescript-sdk` (`saveCustomApplication` / `saveToolSet`).

**Update**: `@epam/ai-dial-typescript-sdk` was bumped from `0.1.0-dev.28` to `0.1.0-dev.31`
during implementation (root `package.json` was updated to the new version, but
`apps/chat-api/package.json` had its own separate, stale pin at `0.1.0-dev.28` — fixed to match
so npm stops installing a shadowing nested copy under `apps/chat-api/node_modules`). The
updated SDK's `Application`, `ApplicationData`, `ToolSet`, and `ToolSetData` schemas
(`node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`) now declare a **native**
top-level `intro?: string` field, resolving the placement risk originally flagged below —
`application_properties`/`defaults` are no longer used for `intro` at all. `ApplicationData`/
`ToolSetData` (the snake_case shapes returned by DIAL Core's listing/get endpoints, part of
the `DeploymentData` union) also carry `intro`, so it round-trips through `GET` as well as
`POST`.

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

**Original decision (superseded)**: send `intro` inside the existing generic property bag on
each schema — `application_properties.intro` for `saveCustomApplication`, and `defaults.intro`
for `saveToolSet` — since the SDK version available at the time (`0.1.0-dev.28`) had no
top-level `intro` field on either schema.

**Current decision**: now that `@epam/ai-dial-typescript-sdk@0.1.0-dev.31` declares a native
top-level `intro?: string` on `Application`/`ToolSet` (create/update request schemas) and on
`ApplicationData`/`ToolSetData` (listing/get response schemas), `intro` is sent as a plain
top-level field — `dialBody.intro = body.intro` in both `applications.service.ts`'s
`createApplication` and `toolsets.service.ts`'s `toDialToolsetBody` — instead of nesting it in
`application_properties`/`defaults`. The now-unnecessary `application_properties: {}`
initializer in `createApplication`'s `dialBody` was removed since nothing else in this flow
sets it.

**Alternatives considered (superseded, kept for history)**:
- *Encode into `descriptionKeywords`*: would corrupt the existing topics/keywords semantics
  and complicate parsing back out.
- *Store only in chat-api's own layer (not forwarded to Core)*: rejected — the requirement
  explicitly asks for `intro` to be forwarded to Core, and chat-api has no independent
  persistence layer for application/toolset metadata.

**Risk resolved**: the original risk — "not confirmed that DIAL Core preserves arbitrary keys
under `application_properties`/`defaults` for custom schemas" — no longer applies, since
`intro` is now a schema-declared field, not a smuggled property-bag key.

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
alias plus a pass-through `FC`. `Input.tsx`/`Textarea.tsx` import a shared `Input.scss` that
globally overrides the ui-kit's own `.dial-input` class (used by both `DialInput` and
`DialTextarea`) rather than passing a `className`/style prop from the wrapper component
itself — see the corrected sub-decision below for why. `TagInput` is a pure pass-through for
now — no stable CSS class hook for its outer field border was found in the shipped ui-kit
bundle to safely target. `libs/deployment-creation-form` imports `Input`/`Textarea`/`TagInput`
from `@epam/ai-dial-kit` instead of the primitives directly from `@epam/ai-dial-ui-kit`
(`libs/deployment-creation-form`'s `package.json`/`vite.config.mts` no longer list
`@epam/ai-dial-ui-kit` at all, since it is now only a transitive dependency through
`ai-dial-kit`). `.claude/rules/all-tsx.md` gained a "Text fields" entry alongside the existing
Button/SearchBar/Spinner/TabRow rules, banning direct `DialInput`/`DialTextarea`/`DialTagInput`
imports app-wide going forward.

**Corrected sub-decision (bug found in the first pass)**: the first version of `Input.tsx`
passed the radius override through the wrapper's own `className` prop, merged via
`mergeClasses`. This was wrong for `Input` specifically: `DialInput` renders its real, visibly
bordered box as a wrapper `<div>` ("input-container", carrying the `.dial-input` class) around
a separate, always-borderless inner `<input>` (`border-0 bg-transparent`) that receives the
`className` prop — so the override never reached the actual border (it stayed square), and
forcing a `border-radius` onto that inner input — which also has `overflow: hidden` for
text-overflow ellipsis — clipped text and the text cursor near the corners once it did have a
radius. (`DialTextarea` does put `.dial-input` directly on the `<textarea>` element, so it
wasn't affected by this specific bug — only `Input` was.) Fixed by moving `border-radius` (and
the border-color overrides below) into the global `.dial-input` class rule in `Input.scss`,
which correctly reaches the wrapper `<div>` for `Input` and the `<textarea>` for `Textarea`
alike; `Input.tsx`/`Textarea.tsx` no longer touch `className` at all.

`Input.scss` lightens the field's **resting** border color from `--stroke-primary`
(`#696e7c`) to `--stroke-tertiary` (`#e0e6f0`), matching `libs/catalog`'s own divider
convention (Decision 4's follow-up) — per user review, the field border itself, not just
page-level dividers, read as mismatched against Catalog. The **focus** border color was
changed from the ui-kit default `--stroke-focus` (`#eef1f7`, near-white — barely visible
against a light theme, and after the resting-border change above nearly indistinguishable
from it, so focus stopped reading as a visible state change) to `--stroke-info`
plus a soft `box-shadow` focus ring, borrowing `SearchBar`'s own focus treatment
(`libs/ai-dial-kit/src/components/SearchBar/SearchBar.module.scss`) per user request to reuse
Search's/chat's input approach. Hover and error colors are unchanged from the ui-kit default.
All non-default states are restored with their own `!important` rules, since overriding the
base `.dial-input` rule with `!important` would otherwise block the ui-kit's own
non-`!important` state rules for those pseudo-classes.

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

- **[Resolved]** ~~DIAL Core may not persist unrecognized keys under `application_properties`
  / `defaults` for custom schemas.~~ No longer applicable — `intro` is a native, schema-declared
  field as of `@epam/ai-dial-typescript-sdk@0.1.0-dev.31` (see Decision 1).
- **[Resolved]** ~~Without a GET-side mapping, `intro` set at creation cannot currently be
  retrieved back through chat-api's existing read endpoints/DTOs.~~ Addressed: `intro` was
  added to `ApplicationDto` (`apps/chat-api/src/applications/dto/application.dto.ts`),
  `DialToolsetDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`), and
  `DeploymentItemDto`/`RawDeploymentDto` (`apps/chat-api/src/deployments/dto/`), so it now
  round-trips through `GET /api/v1/applications`, `GET /api/v1/toolsets`, and
  `GET /api/v1/deployments` (the endpoint that actually backs the Catalog listing via
  `apps/chat/src/context/DeploymentsContext.tsx`'s `getDeployments`). The OpenAPI client was
  regenerated so `intro` is typed on the frontend. `apps/chat/src/utils/toolsets.ts`'s
  `toolsetDtoToForm` now pre-fills `intro` from the fetched DTO instead of hardcoding `''`.
  Rendering `intro` on Catalog cards themselves (`CatalogItem`/`Card`) is still not done — that
  remains a separate UI decision, out of scope unless requested.
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

1. ~~Should a follow-up change add `intro` to the GET/list response DTOs...~~ **Resolved**:
   done (see the Risks/Trade-offs entry above). The Quick App create-flow's own `GeneralForm.tsx`
   does not have an edit mode to pre-fill (create-only page); Toolset's `toolsetDtoToForm` now
   pre-fills `intro` from the fetched DTO.
2. Should `intro` also be forwarded on **update** (`updateApplication`/`updateToolset`), not
   just create? The current request is scoped to creation only; if `intro` cannot be changed
   after creation, that should be communicated as a known limitation to authors. Still open —
   `toolsets.service.ts`'s update path was not touched in this change.
3. ~~Confirm with the DIAL Core team whether `application_properties.intro` / `defaults.intro`
   is an acceptable interim placement...~~ **Resolved**: moot — `intro` is now a native
   top-level field on Core's schemas (see Decision 1), no interim placement needed.
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
