## Why

The Scheduled Task create/edit forms' "Model or Agent" field is a flat, unsearchable `Select` built from a stripped-down `{id, label}` option list, while the chat input already has a fully-featured deployment selector (search, favorites, grouping, catalog "Browse") built on `apps/chat/src/components/DeploymentSelector/*`. Users have no way to search or favorite from the Scheduled Task forms, and the gap will only widen as the chat selector gains features. Reusing the existing selector behind a new trigger avoids building and maintaining a second, weaker deployment picker.

## What Changes

- Add a form-field trigger presentation to the existing `apps/chat/src/components/DeploymentSelector/*` selector (currently hard-wired to the chat input's icon trigger via `ModelSelectorControl.tsx` in `libs/conversation-input`), so the same dropdown content (search, favorites, grouping, Browse) can open from a full-width outlined field instead of only an icon button.
- Extract the trigger-agnostic parts of the selector (the `Dropdown`/`Popover` wiring currently embedded in `ModelSelectorControl`) so `DeploymentSelectorOverlay`/`DeploymentSelectorPanel` can be opened by either the existing icon trigger or a new form-field trigger, with no change to `libs/conversation-input`'s public API or the chat input's rendered output.
- Add a new form-field trigger component (app-owned, since the selector itself is app-owned) that renders as a full-width outlined control with a trailing chevron, required-field label "Model or Agent", and placeholder "Select Model or Agent".
- Wire the new trigger into `ScheduledTaskCreateForm`'s Model field (`libs/scheduled-tasks`) in place of the current `Select`, for both the create and edit flows (`ScheduledTaskCreatePage`, `ScheduledTaskEditPage`), preserving the existing `values.modelId` / `errors.modelId` form-state contract and the existing `model` field in the create/update payload.
- Extend the deployment options passed into `ScheduledTaskCreateForm` from the stripped `{id, label}` shape to the richer catalog-item shape the panel already renders (icon, type, favorite state), sourced from the same `useDeployments()`/`useFavoriteApplications()` data the chat input uses — no new data-loading path.
- Add i18n keys for any new form-field-trigger-specific strings (placeholder, loading/error/empty states) that don't already exist on the chat selector's label set.

## Capabilities

### New Capabilities

- `deployment-selector-form-trigger`: A form-field trigger presentation for the existing app-owned deployment selector (`apps/chat/src/components/DeploymentSelector/*`), opening the same search/favorites/Browse dropdown content as the chat input's icon trigger, selectable via a trigger-variant prop rather than a new dropdown implementation.

### Modified Capabilities

- `scheduled-task-create-form`: The "Model" field requirement changes from a plain `Select` populated with `{id, label}` options to the shared deployment-selector form-field trigger, with richer deployment options, required-field/placeholder copy, and preselection behavior on edit. The `values.modelId`/`errors.modelId` contract and the `model` field in `CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` are unchanged.

## Impact

- `apps/chat/src/components/DeploymentSelector/*` (`DeploymentSelectorOverlay.tsx`, `DeploymentSelectorPanel.tsx`, `useDeploymentSelectorOverlay.tsx`, `CatalogModal.tsx`): gains trigger-variant support; existing chat-input behavior must remain byte-for-byte equivalent from the user's perspective.
- `libs/conversation-input/src/components/Input/ModelSelectorControl.tsx`: refactored only as needed to consume the extracted trigger-agnostic dropdown wiring; no public prop changes to `ConversationInput`/`InputProps`.
- `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`: Model field markup and its `modelOptions` prop shape change.
- `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx`, `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`: build the richer deployment-option list and wire the new trigger's callbacks (selection, Browse navigation) instead of the current `modelOptions` mapping.
- `apps/chat/src/i18n/locales/en.json`: new keys for the form-field trigger's placeholder and states, if not already covered by existing `scheduledTasks.create.*`/chat selector keys.
- No backend or `@epam/chat-api-client` change: the `model` field on `CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` is untouched.
