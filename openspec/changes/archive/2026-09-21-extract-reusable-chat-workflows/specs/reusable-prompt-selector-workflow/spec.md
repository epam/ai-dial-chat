## ADDED Requirements

### Requirement: Prompt selection is a public UI workflow

`@epam/ai-dial-prompts` SHALL export `usePromptSelectorOverlay` and named public options/result/labels/prompt-input types. It SHALL accept structural prompt data, favorite IDs, favorite/insertion callbacks, resolved enablement, labels and a host catalog renderer. It SHALL own browse visibility, pending prompt and selection origin, reuse existing prompt components and canonical parameter utilities, and SHALL NOT import generated API DTOs, parent providers, routing, storage, feature flags or i18n.

#### Scenario: Favorite prompt without parameters
- **WHEN** a user chooses a favorite whose content has no valid double-brace parameters
- **THEN** the workflow closes selection and inserts the content once through the host callback without showing parameters

#### Scenario: Favorites update
- **WHEN** the user removes a favorite and the host supplies updated favorite IDs
- **THEN** the favorites list reflects the supplied data without a new library-owned request

### Requirement: Browse and parameter transitions survive popover dismissal

The workflow SHALL render browse and parameter surfaces independently of the transient Add-menu popover. Browse content SHALL come from the host renderer, which receives open state and select/close callbacks. Selection SHALL use the existing double-brace grammar and unique parameter ordering. A parameterized browse selection SHALL retain its browse context behind the popup and offer Back; direct/favorites entry SHALL omit Back. Submission SHALL resolve parameters, insert exactly once and close both surfaces. Cancel SHALL clear the pending prompt without insertion and preserve the existing underlying-browse behavior.

#### Scenario: Browse with parameters
- **WHEN** a prompt requiring parameters is selected from the host browse modal after the Add-menu popover closes
- **THEN** the parameters popup remains mounted, Back returns to browse, and submitting populated values inserts resolved content once and closes both surfaces

#### Scenario: Browse without parameters
- **WHEN** an unparameterized prompt is selected in browse
- **THEN** its content is inserted and the browse modal closes

#### Scenario: Direct catalog entry
- **WHEN** the host directly opens parameters for a prompt from its route-level Catalog action
- **THEN** no browse Back action is offered and cancel inserts nothing

### Requirement: Enablement and catalog remain host policy

The parent SHALL pass its resolved `OverlayFeature.Prompts` policy from its existing adapter; another host SHALL be able to pass true. Disabled mode SHALL expose no menu renderer, no browse or parameter surfaces, and a no-op direct-open handler. The host catalog SHALL remain lazy-loaded and the workflow SHALL NOT eagerly import a catalog implementation or fetch prompt/favorite data on menu open.

#### Scenario: Disabled parent and enabled client application
- **WHEN** a parent adapter supplies false and a second host supplies true
- **THEN** the parent exposes no prompt surface while the second host uses the same public workflow with its own catalog

### Requirement: Prompt UI preserves localization and accessibility

Labels SHALL be supplied by the host using existing translation keys; no new user-facing strings or feature flags SHALL be required. Existing keyboard/focus handling, accessible names, parameter validation and RTL/mobile behavior SHALL be preserved. Callbacks and derived lists SHALL be memoized. No new API endpoint, cache or telemetry transport SHALL be introduced.

#### Scenario: Localized keyboard flow
- **WHEN** a host renders the workflow with translated labels under RTL and navigates using the keyboard
- **THEN** favorites, browse and parameters retain accessible labels, focus restoration, logical layout and existing validation
