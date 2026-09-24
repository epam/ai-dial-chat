## Context

The proposal has the audit and the motivation. The facts that constrain this design are:

- **`EditorLayout`** (`libs/builder-form/src/components/EditorLayout/EditorLayout.tsx:18`) already renders the screenshot's frame:
  - a header with a back arrow, an `<h1>` and an `actions` slot;
  - a 360 px `leftContent` with an end border, and a flexible `rightContent`;
  - on mobile, the actions move to a bottom bar.

  `EditorSection` (`libs/builder-form/src/components/EditorSection/EditorSection.tsx:8`) renders the "Metadata" and "Setup" `<h2>` headings.
- **`DeploymentCreationForm`** (`libs/builder-form/src/components/DeploymentCreationForm/DeploymentCreationForm.tsx:18`) renders the Metadata fields. It always renders all six fields (Avatar, Name, Version, Description, Locales, Tags).
- **`GeneralForm`** (`libs/toolset-editor/src/components/GeneralForm/GeneralForm.tsx:80`) wraps `DeploymentCreationForm` and `AvatarPickerModal` with host-injected `bucket`, `FileManagerModal`, `resolveIconUrl` and locale options. It is toolset-branded, but the custom app editor already imports it.
- **Toolset.** `ToolsetEditor` (lib) owns its form state and validation. It persists through injected callbacks (`onPersist`, `onPostSaveLogin`, `authActions`, `onOAuthLogin`).
- **Custom app.** `CustomAppEditor` (app) owns its state in the page and renders the stepper `EditorHeader` with `CustomAppEditorView`.
- **Quick app.** `AppsEditor` (app) uses the same stepper header, a duplicate `GeneralForm`, and a `SettingsStep` that embeds the schema's `editorUrl` iframe. The iframe cannot load without an application id (`apps/chat/src/pages/AppsEditor/SettingsStep.tsx`), which is why the flow is create-first.
- **Prompt and skill** already use `EditorLayout`, but render their Name/Description with their own `Input`/`Textarea` (`libs/prompt-editor/src/components/PromptEditor/PromptEditor.tsx:222`, `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:470`).
- **Packaging.** Every lib touched here is `"private": true`, so a public-API reshuffle has no external consumers. Internal apps and tests are the only callers.

## Goals / Non-Goals

**Goals:**
- One presentational shell (`EntityEditor`) and one Metadata field set (`MetadataForm`) used by every entity editor: toolset, custom app, quick app, prompt and skill.
- One headless metadata-state hook (`useMetadataForm`), so touched and error surfacing behaves the same everywhere.
- One app-level `ApplicationEditorPage`, parameterised by an `ApplicationEditorDefinition`, for every application kind. A new kind needs a definition and a Setup component, nothing else.
- Custom apps and quick apps become single-page Metadata | Setup editors.
- Routes, query params, request payloads and per-type validation rules stay unchanged.

**Non-Goals:**
- Setup forms generated from JSON schema.
- New metadata fields for prompts or skills.
- Backend/OpenAPI changes.
- Changing `BuilderFormContainer` or the scheduled-task editor.
- Unifying the per-type validation patterns (toolset loose version vs. semver). That is a product decision, not a layout decision, and is recorded as an open question.

## Decisions

### D1. Split: presentational + headless in `builder-form`, orchestration in the app

`libs/builder-form` gains three exports:

- **`EntityEditor`** (component). It is `EditorLayout` plus two `EditorSection`s plus the standard actions.
  ```ts
  interface EntityEditorProps {
    title: string;
    onBack: () => void;
    onCancel: () => void;
    onSubmit: () => void;
    submitLabel: string;        // host resolves Create vs Save
    isSubmitting?: boolean;     // -> EditorLayout.isSaving, disables actions
    isSubmitDisabled?: boolean; // external readiness only (e.g. iframe ReadyToSave), never validation
    extraActions?: ReactNode;   // rendered before Cancel, e.g. Preview / Exit preview
    hideStandardActions?: boolean; // quick-app preview mode shows only extraActions
    metadata: ReactNode;        // inside EditorSection(title = labels.metadataTitle)
    metadataFooter?: ReactNode; // extra left-panel content below Metadata (skill Files tree)
    setup?: ReactNode;          // inside EditorSection(title = labels.setupTitle); absent => left fills width
    setupTitle?: string;        // overrides labels.setupTitle (skill: selected file path)
    alert?: ReactNode;          // role="alert" region above the Setup section (submit / conflict errors)
    labels?: EntityEditorLabels; // metadataTitle 'Metadata', setupTitle 'Setup', cancelLabel 'Cancel', backAriaLabel 'Back', savingStatusLabel 'Saving'
    styles?: EntityEditorStyles; dir?: 'ltr' | 'rtl';
  }
  ```
- **`MetadataForm`** (component). This is `GeneralForm` moved from `toolset-editor` and extended:
  - `fields?: MetadataField[]`. `MetadataField` is a string enum: `Avatar`, `Name`, `Version`, `Description`, `Locales`, `Tags`. The default is all six, in the screenshot order with Locales before Tags, as today.
  - `isNameReadOnly?`, `nameCaption?`, `isDescriptionRequired?`, and `errors.description?`. The skill and prompt editors need these.

  `DeploymentCreationForm` gains the same `fields` option, and `MetadataForm` passes it through. Avatar-picker wiring stays host-injected through one optional `avatarPicker` prop (`bucket`, `FileManagerModal`, `resolveIconUrl`, `resolveAttachedIconUrl`, `allowedMimeTypes`, `maxFileSizeBytes`). `resolveAttachedIconUrl` is new: `GeneralForm` used to call `dialFileToAttachment` from `chat-hooks` itself, which builds DIAL storage paths and would make builder-form depend on `chat-hooks`. The host supplies it instead.
- **`useMetadataForm`** (hook).
  ```ts
  useMetadataForm({ initialValues, validationOptions, reseedKey? }) => {
    values, setValues(patch), touched, markTouched(field),
    errorCodes,            // full DeploymentCreationFormErrorCodes from validateDeploymentCreationFields
    visibleErrorCodes,     // only touched fields, or all after attemptSubmit()
    attemptSubmit(): boolean, // marks all touched, returns isValid
    isDirty, reset(values)
  }
  ```
  It returns codes, not messages, as `validateDeploymentCreationFields` does today, so i18n stays in the host.

**Why:** the layout and the field state are host-agnostic. Persistence, bucket and icon resolution, i18n, notifications and routing are not.

**Alternatives:**
- One lib `ApplicationEditor` that also persists. Rejected: it breaks AGENTS.md §Library isolation.
- Keep `GeneralForm` in `toolset-editor`. Rejected: custom and quick apps would depend on a toolset lib, which is the smell already present at `apps/chat/src/pages/ToolsetEditor/CustomAppEditorView.tsx`.

**Library isolation.** Every host-owned value arrives as a prop. The libs never import i18n, routing, server-api or storage.
- Labels: `t()`, passed as props.
- Avatar storage: `bucket` and `FileManagerModal`.
- Icon URL: `resolveIconUrl`.
- Locale choices: `availableLocaleOptions`.
- Save: `onSubmit`.

### D2. `toolset-editor` keeps its container, rebuilt on `EntityEditor`

`ToolsetEditor` swaps its hand-composed `EditorLayout` + `EditorSection`s for `EntityEditor`, and its metadata `useState` for `useMetadataForm` (with `validateVersionPattern: true`, unchanged). `GeneralForm` / `GeneralFormProps` / `GeneralFormLabels` stay exported with their current props, marked `@deprecated`. `GeneralForm` becomes a thin wrapper over `MetadataForm` that supplies `resolveAttachedIconUrl` via `dialFileToAttachment`, so nothing breaks in this change.

The toolset still has its own Setup section and auth/OAuth sequencing (`onPersist`, then `onPostSaveLogin`). That sequencing is non-trivial and already isolated behind callbacks. The toolset therefore joins the generic registry (D3) with a definition whose `renderPage` delegates to the lib container, not through the generic persist path. See D3 "Strategies".

### D3. `ApplicationEditorPage` + `ApplicationEditorDefinition` (the generic creation)

Layout in the app:

```
apps/chat/src/types/application-editor.ts        // ApplicationEditorKind, ApplicationCreateStrategy, definition + setup-slot types
apps/chat/src/pages/ApplicationEditor/
  ApplicationEditorPage.tsx                      // route element: resolves definition by kind, renders EntityEditor
  definitions/customAppDefinition.tsx
  definitions/quickAppDefinition.tsx
  definitions/toolsetDefinition.tsx
  definitions/index.ts                           // APPLICATION_EDITOR_DEFINITIONS: Record<ApplicationEditorKind, ApplicationEditorDefinition>
  setup/CustomAppSetup.tsx                       // was EditorForm/CustomAppSettingsForm.tsx
  setup/QuickAppSetup.tsx                        // was SettingsStep.tsx (+ AppEditorIframe, AppPreviewChat moved alongside)
apps/chat/src/hooks/application-editor/
  useApplicationAvatarPicker.ts                  // bucket, FileManagerModal, resolveIconUrl, MIME/size limits, picker labels (built once)
  useMetadataLabels.ts                           // DeploymentCreationFormLabels from EditorI18nKeys (one place)
  useEditedApplication.ts                        // resolves the edited deployment from useDeployments(), waits for context
```

The contract:

```ts
enum ApplicationEditorKind { Toolset = 'toolset', CustomApp = 'custom-app', QuickApp = 'quick-app' }
enum ApplicationCreateStrategy {
  AllAtOnce = 'all-at-once',       // one create request with metadata + setup, then exit (custom app)
  MetadataFirst = 'metadata-first' // create with metadata, stay on page in edit mode, setup saves separately (quick app)
}

interface ApplicationSetupProps<TSetup> {
  mode: EditorMode; appId?: string; deployment?: DialDeployment; schema?: ApplicationSchemaSummaryDto;
  value: TSetup; onChange: (patch: Partial<TSetup>) => void;
  errors: Partial<Record<keyof TSetup, string>>;
  onReadyChange?: (ready: boolean) => void;   // gates Save (quick-app ReadyToSave)
  isPreviewing?: boolean;
}
interface ApplicationSetupHandle { save?: (metadata: MetadataPayload) => Promise<ApplicationSaveResult> }

interface ApplicationEditorDefinition<TSetup = unknown> {
  kind: ApplicationEditorKind;
  notifiableEntity: NotifiableEntity;
  createStrategy: ApplicationCreateStrategy;
  title: (mode: EditorMode, ctx: { schema?: ApplicationSchemaSummaryDto; t: TFunction }) => string;
  metadataValidation: DeploymentCreationFormValidationOptions;
  metadataLabelOverrides?: (t: TFunction) => Partial<DeploymentCreationFormLabels>;
  getInitialSetup: (deployment?: DialDeployment) => TSetup;
  validateSetup: (setup: TSetup, t: TFunction) => Partial<Record<keyof TSetup, string>>;
  Setup: ForwardRefExoticComponent<ApplicationSetupProps<TSetup> & RefAttributes<ApplicationSetupHandle>>;
  create: (metadata: MetadataPayload, setup: TSetup, ctx) => Promise<{ id: string }>;
  update?: (id: string, metadata: MetadataPayload, setup: TSetup, ctx) => Promise<void>; // absent => Setup handle saves
  confirmBeforeSubmit?: { titleKey: string; descriptionKey: string; confirmKey: string };
  renderExtraActions?: (ctx: ExtraActionsContext) => ReactNode;  // quick-app Preview
  renderPage?: (ctx: PageContext) => ReactNode;                   // escape hatch: toolset delegates to its lib container
}
```

The page owns the shared lifecycle:
- mode resolution from the query params;
- loading and error states;
- `useMetadataForm`;
- the avatar picker (via the hooks);
- the `alert` region;
- the saving overlay (`inert` content plus `aria-live` status, carried over from `AppsEditor`);
- the confirmation popup;
- `useOperationNotification` success notifications;
- `refetchDeployments()`;
- navigation to `returnUrl`.

`create`/`update` call the existing server-api wrappers (`apps/chat/src/server-api/applications.ts`). No new endpoints and no `fetch`.

**Strategies.**
- **`AllAtOnce`** (custom app): the primary button submits metadata and setup in one request, as `CustomAppEditor` does today at L354/L399. The confirmation popup stays.
- **`MetadataFirst`** (quick app), create mode:
  - Setup renders a placeholder: `applicationEditor.setupPendingCreate`, "Create the application to configure its setup."
  - **Create** calls `create`, raises the "Quick app created" notification, calls `setSearchParams({ appId }, { replace: true })`, and the page re-renders in edit mode. The title becomes Edit, the primary button becomes Save, and the iframe loads.
  - **Save** in edit mode calls the Setup handle's `save(metadata)`, which posts `TriggerSave` with the `general` payload. On `SaveSuccess` it runs the existing `updateApplication` reassertion and the refetch, raises the "Quick app edited" notification and navigates to `returnUrl`.
- **`renderPage`** (toolset): the definition supplies the whole body with the lib `ToolsetEditor`, wired to the shared avatar and label hooks. The toolset is registered, discoverable and uses the same shell, but its auth sequencing stays inside the lib.

**Why a registry, not three pages calling shared hooks:** the registry is the "generic creation" the request asks for. The page lifecycle is written once, and the fake-kind unit test proves that a kind needs only a definition.

**Alternatives:**
- Three pages composing shared hooks. Rejected: the lifecycle is still triplicated and there is no single place to add a kind.
- Routing by a `kind` path param (`/application-editor/:kind`). Rejected for now: it breaks existing links. The three existing routes render `<ApplicationEditorPage kind={…} />` instead.

**As implemented (slice 3).** The contract in `apps/chat/src/models/application-editor.ts` differs from the sketch above in these places:

- The registry holds a union: `ApplicationEditorFormDefinition<TSetup>` for kinds on the shared page, and `ApplicationEditorPageDefinition` (`renderPage` only) for the toolset.
- Page-level strings come from `messageKeys` (titles, create/save/load failures, overlay labels), typed as `ParseKeys<'translation'>`.
- Edit-mode setup that is fetched separately goes through `loadSetup(appId, deployment)` instead of `getInitialSetup`. A failed load notifies and returns to `returnUrl`.
- Setup fields validate on blur through `onFieldBlur`, using the same `validateSetup` the submit runs.
- API failures raise an error notification with `requestId`, as `custom-app-editor` already requires. The `alert` region is not used for them.
- `notifiableEntity` is narrowed to the application entities, so `notifyOperationSuccess` type-checks.

### D4. Quick app: Preview in the header, Card preview removed

`renderExtraActions` returns a `GhostButton` with Preview / Exit preview:
- It is enabled only when `appId` exists and `isSettingsReady`.
- While previewing, `EntityEditor.hideStandardActions` hides Cancel and Save, as `EditorHeader` does today.

`QuickAppSetup` keeps the iframe mounted and toggles `AppPreviewChat` over it, which is the existing `SettingsStep` behaviour. The General-step `Card` preview is deleted; the screenshot has no preview column.

The readiness gating and timeouts (`ReadyToSave`, `LoggedOut`, save timeout) keep their current logic. They move from `AppsEditor` into `QuickAppSetup` and the quick-app definition, and gate `isSubmitDisabled` in edit mode.

### D5. Prompt and skill adopt `EntityEditor` + `MetadataForm`

- **Prompt:**
  - `metadata` = `MetadataForm fields={[Name, Description]}`, with the prompt's own error strings. Validation stays in `libs/chat-hooks/src/prompt/prompt.ts`.
  - `setup` = the Instructions `MarkdownEditor`.
  - The primary label becomes Create/Save by mode. The host resolves it (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx:245`).
  - The lib gets `labels.createLabel`, alongside the existing `saveLabel`.
- **Skill:**
  - `metadata` = `MetadataForm fields={[Name, Description]} isDescriptionRequired nameCaption={…} isNameReadOnly={edit}`.
  - `metadataFooter` = the Files tree. On mobile it keeps its "Editing file" accordion.
  - `setup` = Instructions for `SKILL.md`, or the supporting-file preview. `setupTitle` is the selected file path, replacing the ad-hoc `<h2>`.
  - The Name/Description values still live in the skill editor's field state (`skill-editor-library` "Form field state ownership"). `MetadataForm` is controlled.
- Neither uses the avatar picker. The prompt and skill libs render `MetadataForm` without `bucket` or `FileManagerModal`, so those props become optional and are required only when `fields` includes `Avatar`.

### D6. Labels and i18n

- `useMetadataLabels` builds the Metadata labels from `EditorI18nKeys` once.
- The tags placeholder unifies on `editor.topicsPlaceholder` = "Add tags, comma separated", replacing "Add a topic".
- Section titles use `editor.metadataSectionTitle` / `editor.setupSectionTitle`. These move from `toolsetEditor.*` to `editor.*`, and the toolset keys are removed.
- New keys:
  - `applicationEditor.setupPendingCreate`
  - `customApp.createTitle` ("Create custom app")
  - `customApp.editTitle` ("Edit custom app")
  - `appsEditor.createTitle` ("Create {{type}}")
  - `appsEditor.editTitle` ("Edit {{type}}"). `type` is the schema `displayName`, falling back to "quick app".
- Removed keys: `editor.stepGeneral`, `editor.nextButton`, `editor.saveButton`, `editor.stepsNavAriaLabel`, `editor.stepOfTotal`, `editor.moreActionsLabel`. Remove them from every locale file.

### D7. Memoisation, a11y, RTL, feature gating

- **Memoisation:**
  - Definitions are module-level constants.
  - Label objects built in the page and in the hooks are wrapped in `useMemo`.
  - Every callback passed to `EntityEditor` or `Setup` is wrapped in `useCallback`.
  - `EntityEditor`, `MetadataForm` and each `Setup` are `memo`.
- **A11y:**
  - `EditorLayout` already provides the `<h1>`, a labelled back button and an sr-only saving status.
  - `alert` renders `role="alert"`.
  - A submit attempt with invalid metadata focuses the first invalid field. This is existing `DeploymentCreationForm` behaviour, and the rule applies to every kind.
  - The primary button is never disabled for validation reasons. It is disabled only by `isSubmitting` or external readiness.
  - Quick-app preview toggling uses `aria-pressed` on the Preview button.
- **RTL:** no new physical classes. The back-arrow mirroring is already handled by `EditorLayout`.
- **Feature gating:** unchanged. The custom app stays behind `OverlayFeature.CustomApps` / `HideCustomAppCreation` at the catalog entry, and the routes stay ungated as today.
- **Observability:** unchanged; existing notifications and console errors.

## Risks / Trade-offs

- **[Risk] The quick app's two-click create (Create, then Save) surprises users.** Mitigation: the Setup placeholder explains it, the header switches to Edit/Save in place, and the "created" notification confirms the first step. Alternative in Open Questions.
- **[Risk] The toolset `renderPage` escape hatch makes the registry less uniform.** Mitigation: it is documented as the only escape hatch. Moving toolset auth into a generic `afterPersist` step is a follow-up once a second kind needs post-save auth.
- **[Risk] Custom-app behaviour change.** Save is no longer disabled while invalid, and there is no redirect to the General step. Mitigation: a submit attempt still blocks the request and focuses the first invalid field. The spec deltas and tests cover it.
- **[Risk] Existing Vitest specs for `CustomAppEditor`, `AppsEditor` and `EditorHeader` encode the wizard flow.** Mitigation: they are rewritten against the single page in their slices. There is no E2E project in `apps/`.
- **[Risk] A large diff in a single PR.** Mitigation: slices are independently shippable. The lib shell comes first (behaviour-neutral), then toolset, custom app, quick app, prompt and skill, then cleanup.
- **[Trade-off] Mobile.** The quick-app iframe sits below the Metadata stack. Setup gets a minimum height (`min-h-[640px]` on mobile) so the iframe stays usable.

## Migration Plan

1. Add `EntityEditor`, `MetadataForm`, `useMetadataForm` and `DeploymentCreationForm.fields` (additive). Re-point `toolset-editor`'s `GeneralForm` alias. There is no visual change.
2. Rebuild the toolset lib container on `EntityEditor`. Its visuals are already the target.
3. Add the `ApplicationEditorPage` scaffolding with the toolset (`renderPage`) and custom-app definitions. Switch the `/custom-app-editor` and `/toolset-editor` routes.
4. Add the quick-app definition and switch `/apps-editor`. The ignored `?step=` param keeps old links working.
5. Migrate prompt and skill onto `EntityEditor` + `MetadataForm`.
6. Delete `EditorHeader`, `CustomAppEditorView`, the `AppsEditor/GeneralForm` copy and the unused i18n keys. Update the docs.

Rollback: revert the slice. Earlier slices are additive, so reverting a later slice leaves a working state.

## Open Questions

- **Quick-app create UX.** In-place create→edit with Create, then Save, has been picked. The alternative is "Create" doing create + trigger iframe save + exit in one click once the iframe is ready, but the iframe cannot be configured before the id exists, so that needs the embedded editor to accept a draft. Confirm with product.
- **Unifying version validation.** The toolset uses the loose `VERSION_PATTERN`; the apps use semver. This change keeps both. Unifying is a follow-up decision.
- **Whether the toolset's post-save OAuth login can move to a generic `afterPersist`** and drop `renderPage`. Deferred.
