## Context

The chat input's deployment selector already exists as an app-owned overlay, decoupled from its trigger:

- `apps/chat/src/components/DeploymentSelector/DeploymentSelectorPanel.tsx` renders the actual content: search (`SearchBar` from `@epam/ai-dial-kit`), a "Currently selected" row (shown even when the selected item isn't a favorite — `selectedItem` prop), a Favorites list with star toggles, and a footer `GhostButton` ("Browse") that calls `onBrowseCatalog`. Search matches highlight via `Highlight` from `@epam/ai-dial-ui-kit`.
- `apps/chat/src/components/DeploymentSelector/DeploymentSelectorOverlay.tsx` is a lazy i18n wrapper around the panel.
- `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx` is the data-binding hook: it reads `useDeployments()` (items, `selectedItemId`, `setSelectedItemId`) and `useFavoriteApplications()` (favoriteIds, toggleFavorite), maps deployments to `CatalogItem`s via `apps/chat/src/utils/map-deployment-to-catalog-item.ts`, resolves the selected item even when it isn't in the initially-loaded/favorited subset via `apps/chat/src/utils/deployment-id.ts#findDeploymentByIdOrReference`, and owns the "Browse" catalog modal's open state. It returns `{ renderOverlay(onClose): ReactNode, catalogModal: ReactNode }`.
- The chat input's only trigger today is `libs/conversation-input/src/components/Input/ModelSelectorControl.tsx`, which — on desktop, when a `modelPickerOverlay` prop is supplied — wraps a plain icon `<button>` in the ui-kit `Dropdown` (`matchReferenceWidth={false}`, `trigger={[]}`, controlled `open`/`onOpenChange`) and calls `modelPickerOverlay(onClose)` as `Dropdown`'s `renderOverlay`. `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` and `ConversationView.tsx` pass `useDeploymentSelectorOverlay().renderOverlay` straight through as `modelPickerOverlay`.

In other words, **the trigger-agnostic seam already exists** at the `renderOverlay: (onClose) => ReactNode` boundary — `ModelSelectorControl` is just one consumer of it, wired through `Dropdown`. Nothing under `libs/conversation-input` needs to change to add a second consumer with a different trigger shape.

Separately, `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx` renders the Model field as a plain ui-kit `Select` (`options={modelOptions.map(...)}`, bound to `values.modelId`), where `modelOptions: ScheduledTaskCreateFormModelOption[]` (`{id, label}`) is built by `ScheduledTaskCreatePage`/`ScheduledTaskEditPage` from `useDeployments().items`, discarding icon/type/favorite information the chat selector already has. Per the library-isolation rule, `libs/scheduled-tasks` cannot call `useDeployments()`/`useFavoriteApplications()` itself — its form-state contract (`values.modelId`, `errors.modelId`, `onFieldChange`) and its payload mapping (`apps/chat/src/utils/scheduled-task-trigger.ts` → `CreateScheduledTaskBodyDto.model`) are unaffected by this change and must stay exactly as documented in `openspec/specs/scheduled-task-create-form/spec.md`.

## Goals / Non-Goals

**Goals:**

- Add a second, form-field-shaped consumer of the existing `renderOverlay` seam, with zero behavioral or visual change to the chat input's icon trigger.
- Give the Scheduled Task forms the same search/favorites/grouping/Browse UX the chat input has, using the same data source and mapping utilities.
- Keep `libs/scheduled-tasks` free of deployment-loading/context knowledge — it receives a fully-composed trigger element as a slot, the same way `ConversationInput` receives `modelPickerOverlay`.

**Non-Goals:**

- Redesigning `DeploymentSelectorPanel`'s content, filtering, or Browse/catalog behavior.
- Changing `libs/conversation-input`'s public props (`InputProps`/`ConversationInputProps`) or `ModelSelectorControl`'s existing render paths.
- Changing the `CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` contract (`model` field stays a plain deployment-id string).
- Building a generic cross-app "trigger variant" enum inside a `libs/*` component — the trigger lives in `apps/chat` because the overlay data hook (`useDeploymentSelectorOverlay`) is itself app-owned.

## Decisions

### 1. New trigger is a sibling app component, not a `ModelSelectorControl` refactor

Add `apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx`, a new component consuming `useDeploymentSelectorOverlay()`'s `renderOverlay` directly through the ui-kit `Dropdown` primitive — the same primitive `ModelSelectorControl` already uses for `modelPickerOverlay`, just with `matchReferenceWidth` left at its default `true` (so the overlay matches the full-width field instead of the icon trigger's fixed `!w-[320px]` override) and a full-width outlined `<button>` trigger instead of an icon button.

**Alternative considered:** extend `ModelSelectorControl` with a `triggerVariant: 'icon' | 'field'` prop inside `libs/conversation-input`. Rejected — `ModelSelectorControl` is reached through `ConversationInput`'s public API, which the Scheduled Task forms have no reason to render; threading a form-field variant through it would widen `libs/conversation-input`'s surface for a consumer that isn't a conversation input at all, and would still need `apps/chat` to supply `modelPickerOverlay`, so nothing is saved by routing through the lib. Keeping the new trigger as a standalone app component means `ModelSelectorControl.tsx` is untouched — backward compatibility for the chat input is by construction, not by regression testing alone.

### 2. `ScheduledTaskCreateForm` gains a `modelSelector: ReactNode` slot, replacing `modelOptions`

`ScheduledTaskCreateFormProps` (`libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`) drops `modelOptions: ScheduledTaskCreateFormModelOption[]` and gains `modelSelector: ReactNode` — a fully-composed element the host renders in place of today's `<Select>` at the same position in the Details column, wrapped by the same required-label/error markup pattern the form already uses for non-`Input`/`Select` controls (see `withRequiredMarker` used for `Calendar` fields in the same file). The lib still owns the "Model or Agent" label, the required marker, and rendering `errors.modelId` — only the interactive control itself is supplied by the app.

**Alternative considered:** a render-prop (`renderModelSelector: (props: { value, onChange, error }) => ReactNode`). Rejected as unnecessary indirection — the app already has everything it needs (`values.modelId`, `onFieldChange`, `errors.modelId`, `useDeployments()`) at the point where it renders `<ScheduledTaskCreateForm>`, so a plain pre-bound `ReactNode` slot is simpler and matches the existing `modelPickerOverlay: (onClose) => ReactNode` idiom already proven in `ConversationInput`.

**Alternative considered:** keep `modelOptions` and add a `useRichSelector?: boolean` flag. Rejected — it would force the lib to hold two competing implementations of the same field and both branches would need error/required markup duplicated; a single slot is strictly simpler.

### 3. `ScheduledTaskCreatePage`/`ScheduledTaskEditPage` compose the trigger from the same data the chat input uses

Both pages already call `useDeployments()`. They additionally call `useFavoriteApplications()` (same context the chat input's `useDeploymentSelectorOverlay` uses) and render:

```tsx
<DeploymentSelectorFieldTrigger
  selectedId={values.modelId}
  onSelect={(id) => onFieldChange('modelId', id)}
  labels={{ ariaLabel: t(...), searchPlaceholder: t(...), ... }}
  placeholder={t(ScheduledTasksI18nKeys.ModelPlaceholder)}
  isInvalid={Boolean(errors.modelId)}
/>
```

and pass the result as `modelSelector`. `DeploymentSelectorFieldTrigger` internally reuses `findDeploymentByIdOrReference`/`mapDeploymentToCatalogItem` (the same utilities `useDeploymentSelectorOverlay` uses) to resolve `selectedId` into a display label/icon, so an edit task's current deployment renders correctly even when it isn't in the favorites or the initially-loaded subset — no separate lookup is written for the form.

**Why not reuse `useDeploymentSelectorOverlay()` verbatim inside the new trigger?** That hook is bound to `DeploymentsContext`'s own `selectedItemId`/`setSelectedItemId`, which is the *chat's* current selection, not the form's `values.modelId`. `DeploymentSelectorFieldTrigger` takes `selectedId`/`onSelect` as props instead, and internally calls a small selection-agnostic variant of the same hook logic (favorites list + selected-item resolution), parameterized by the passed-in `selectedId`/`onSelect` rather than the context's own state. This keeps one source of truth for "how to map deployments into panel items" while letting two independent selections (chat's live conversation model, the form's draft `modelId`) coexist without cross-talk — selecting a deployment in the Scheduled Task form must never change `DeploymentsContext.selectedItemId` or the chat's current model.

### 4. Trigger visual: outlined field + chevron, matching other form controls

`DeploymentSelectorFieldTrigger` renders a `<button type="button">` styled with the same field chrome tokens `Input`/`Select` use (border, radius, height, focus-visible ring — matched via existing Tailwind utility classes, not hardcoded pixel values), a truncated selected-deployment name (or the placeholder), and a trailing `IconChevronDown` that rotates when open and is mirrored under `rtl:scale-x-[-1]` only if the chevron's rotation itself needs directional correction (a symmetric down/up rotation does not need RTL mirroring; this is called out explicitly during implementation review). `aria-expanded`, `aria-haspopup="listbox"`, and `aria-labelledby` pointing at the field's label id are set on the button, consistent with the `Select`/`Dropdown` combobox pattern the ui-kit already documents.

### 5. Selection and Browse close the dropdown; catalog navigation is unaffected

`DeploymentSelectorPanel.onSelect` already closes the panel after calling back (per its own doc comment); `DeploymentSelectorFieldTrigger` wires this the same way `ModelSelectorControl` does — `onSelect={(id) => { onSelect(id); onPickerOpenChange(false); }}`. "Browse" opens the existing `CatalogModal` exactly as it does from the chat input; returning from the catalog does not touch the form's other field values because the catalog modal and the Scheduled Task form are sibling UI, not nested state.

### 6. States: loading / empty / error / disabled / unavailable

- **Loading:** while `useDeployments().isLoading`, the trigger renders disabled with the existing `modelSelectorLoadingLabel`-style copy (new Scheduled-Task-scoped i18n key if the chat selector's own loading string isn't reusable verbatim).
- **Empty:** zero deployments after load — trigger stays enabled (so validation still fires) but the opened panel shows its existing empty-favorites hint; Browse remains available since the catalog may have items not yet surfaced as "deployments".
- **Error:** `useDeployments().error` — trigger shows an error affordance and remains keyboard-reachable; existing required-field validation still blocks submit since `values.modelId` stays empty.
- **Disabled:** while `isSubmitting`, matching the rest of the form's disabled-during-submit behavior.
- **Unavailable/edit deployment:** when `values.modelId` (loaded from an existing task) doesn't resolve via `findDeploymentByIdOrReference` (deleted/renamed deployment), the trigger displays the raw stored id as a fallback label rather than silently clearing `values.modelId` — the field stays "selected" from the form's perspective (required-field validation passes, submit is not blocked on this alone), matching the proposal's "never silently replace or clear" requirement. This is a UI-only fallback; it does not change `mapFormValuesToCreateBody`/`mapFormValuesToUpdateBody`.

### 7. Search highlighting and favorites/Browse are untouched

No incompatibility was found during investigation: `DeploymentSelectorPanel` already uses `Highlight` from `@epam/ai-dial-ui-kit` for search matches, and its favorites/Browse wiring is data-shape-agnostic (it only needs `CatalogItem[]`/`onToggleFavorite`/`onBrowseCatalog`), so nothing about serving it from a second trigger requires modifying the panel itself.

## Risks / Trade-offs

- **[Risk]** A future change to `DeploymentSelectorPanel`'s props (e.g. a new required label) could silently break both consumers if only the chat call site is updated. → **Mitigation:** both `useDeploymentSelectorOverlay` (chat) and the new selection-agnostic hook variant (form) live in the same `apps/chat/src/components/DeploymentSelector/` folder and are covered by the "existing chat icon trigger remains unchanged" regression test plus a new form-trigger test suite, so a breaking prop change fails both suites, not just one.
- **[Risk]** Introducing a second selection (`values.modelId` in the form) alongside `DeploymentsContext.selectedItemId` (the chat's live model) could be conflated by a future contributor. → **Mitigation:** `DeploymentSelectorFieldTrigger`'s props (`selectedId`/`onSelect`) are explicit and documented as form-owned state; it never reads or writes `DeploymentsContext.selectedItemId`/`setSelectedItemId` directly.
- **[Risk]** `Dropdown`'s default `matchReferenceWidth: true` combined with the panel's existing fixed-width assumptions (`!w-[320px]` override used by the icon trigger) could make the overlay too narrow/wide when anchored to a full-width form field. → **Mitigation:** verify the panel's internal layout (list max-height, search bar, Browse footer) at the wider width during implementation; the panel itself uses relative/flex sizing (`LIST_MAX_HEIGHT_PX` is a max-height, not a width), so a wider anchor is expected to size correctly without panel changes, but this needs a visual check on both `mobile` and `desktop` breakpoints.
- **[Trade-off]** Duplicating a thin "resolve selectedId into a display item" hook (variant of `useDeploymentSelectorOverlay`, parameterized by `selectedId`/`onSelect` instead of context state) rather than parameterizing `useDeploymentSelectorOverlay` itself. Chosen to avoid changing the chat's existing hook signature/behavior at all; revisit if a third consumer appears and the duplication becomes a real maintenance cost.

## Open Questions

- Exact new i18n keys and their namespace (`scheduledTasks.create.*` vs. a shared `deploymentSelector.*` namespace) — resolved during implementation by first checking whether the chat selector's existing labels (`DeploymentSelectorLabels`) can be reused verbatim before adding Scheduled-Task-scoped duplicates, per the repo's "avoid duplicate translation values" rule.
- Whether the chevron rotation needs an explicit `rtl:` class or is naturally direction-agnostic — confirmed visually during implementation against a real RTL locale rather than assumed here.
