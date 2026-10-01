## Why

The catalog Create menu offered a single hard-coded "QuickApp" entry, while DIAL Core exposes many application runners (application type schemas) that the app already loads at startup (`apps/chat/src/context/DeploymentsContext.tsx:367`). Users could not create an application of any other runner from the catalog, and runners without an embedded editor had no way to be configured at all (Issue #8611). The legacy 0.x chat handled both cases — one Create entry per schema and a JSON-schema-driven settings form (`SchemaDrivenForm` on `DialSchemaRenderer`) — so this restores parity.

## What Changes

- The catalog Create menu offers **one option per application runner** returned by the schemas list, deduplicated by schema id, with id-less entries and the `custom_app` schema removed (Custom App keeps its own option). Every runner is shown — there is no configurability filter.
- Runner options are labelled with the schema's `displayName` (falling back to its id). "Quick app" and "Quick app 2.0" are different schemas and appear as two entries. **BREAKING (lib API)**: `CatalogEditNavigationLabels.createQuickApp` and the `catalog.create.quickApp` translation key are removed.
- Runners and the static options (Toolset, Custom App, Skill, Prompt) are **sorted together alphabetically**, case-insensitively, instead of a fixed order.
- The menu gains a **search field** that filters runners and static options by label, highlights the matched part with the kit's `Highlight` (single line, ellipsis + tooltip), announces an empty result as a `status`, and clears when the menu closes. It appears only while at least one runner is offered.
- The searchable menu has a **fixed 320px width** anchored to the button's end edge, and a height of seven rows under a sticky search row; longer lists scroll.
- Every runner creates through the existing `/apps-editor` route, like QuickApp. The editor kind is chosen from the schema: a schema **with** `editorUrl` keeps the embedded-editor flow (metadata first, then the "Create the application to configure its setup" step and the iframe); a schema **without** `editorUrl` opens a new **schema-app editor** that renders the full JSON schema with `DialSchemaRenderer`, creates the application in one request carrying `applicationProperties`, loads and saves them on edit, and blocks saving while a top-level required property is empty.
- Apps of **any** runner are editable by their owner, and Edit opens the editor under the app's own schema.
- Success notifications name an app "Quick app" only for the QuickApp schema; an app of any other schema is named by the schema's display name ("External app edited successfully"). New i18n keys: `entityNotifications.schemaApp.*` (10 strings).
- **BREAKING (URLs)**: the editors no longer read a `returnUrl` query parameter; they always return to their fixed route. `isSafeReturnUrl`, `resolveReturnUrl`, `ScheduledTaskCreateQuery` and the `ReturnUrl` enum members are removed.

**Non-goals**

- No filtering of runners by `editorUrl`, `schemaEndpoint` or `properties` (tried during implementation and rejected by the product owner — see design D1).
- No dedicated External app form (0.x `ExternalAppForm`); External app is treated as any other editor-less runner.
- No use of `dial:applicationTypeSchemaEndpoint`; 0.x never read it either.
- No translation of `DialSchemaRenderer`'s internal texts (`texts` prop) in this change.

**Acceptance criteria**

- With N distinct runner schemas (excluding `custom_app`), the Create menu contains N runner options plus the enabled static options, alphabetically ordered.
- Typing in the search field narrows the list; a query matching nothing shows the no-results status; closing the menu resets the query.
- The menu keeps its width while the query changes; with more than seven options it scrolls and the search row stays visible.
- Choosing a runner with `editorUrl` shows the embedded-editor flow; choosing one without it shows the schema form, and Create sends one request with the form values as `applicationProperties`.
- Editing an app of an editor-less runner pre-fills its saved properties and Save sends them back.

**Alternatives considered**

1. *Keep the single QuickApp entry and add a "More…" submenu* — rejected: hides runners behind an extra click and does not solve configuration of editor-less runners.
2. *Filter runners to those with an editor or declared properties* — implemented, then rejected: the product owner wants every runner visible; unconfigurable runners fall back to the schema form, which reports "No configurable properties".
3. *Cap the menu at N runners* — implemented, then replaced by a fixed-height scrolling menu so no runner becomes unreachable.
4. *Resolve properties server-side per schema* — rejected: one DIAL Core request per runner on every startup; the editor fetches the one schema it needs instead.

**Rollback**: revert the change's commits. The lib API removals (`createQuickApp`, `quickAppSchemaId` → `schemas` on `useCatalogEditNavigation`) and the `returnUrl` removal are the only breaking surfaces; both are consumed only by `apps/chat` in this repo.

## Capabilities

### New Capabilities

- `schema-app-editor`: the editor kind for applications of a runner without an embedded editor — schema-form Setup, one-request create with `applicationProperties`, edit load/save, required-property validation, and how `/apps-editor` picks this kind over the embedded-editor kind.

### Modified Capabilities

- `catalog-create-app`: the Create menu is built from every runner schema plus the static options, sorted together, searchable, with a fixed-size scrolling panel; the single Quick App entry, its schema resolution and the fixed order are replaced; non-runner entries no longer carry a return-url parameter.
- `catalog-quickapp-edit-action`: owned apps of any runner schema are editable, Edit routes to the app's own schema, and the toolset Edit URL no longer carries `returnUrl`.
- `catalog-create-options`: the Skill "Write instructions" and Prompt entries (and Prompt Edit) navigate without `returnUrl`, and the Prompt entry is placed by the alphabetical sort instead of last.
- `entity-operation-notifications`: only apps of the QuickApp schema are named "Quick app"; an app of any other schema is named by the schema's display name (new `schemaApp` copy with `{{type}}`), in the editors and in catalog operations, falling back to "Agent" when the schema is unknown.

## Impact

- **Libs** (`libs/*` isolation holds — every route, query key, i18n string and API call arrives from `apps/chat`):
  - `libs/chat-hooks`: `useCatalogEditNavigation` (takes `schemas`, returns `createSearch`; labels lose `createQuickApp`), `getRunnerSchemas` / `RunnerSchemaLike` in `shared/application-schema.ts`. Follows the existing hook at `libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts:112`.
  - `libs/catalog`: `CreateButton` searchable branch, `Catalog`'s new `createSearch` prop and `createSearch*` titles, `CatalogCreateSearch` type, `utils/create-menu.tsx`, `constants/create-menu.ts`.
- **App** (`apps/chat`): `CatalogView`, `useCatalogItems`, `ApplicationEditorPage`, new `definitions/schemaAppDefinition.tsx` and `setup/SchemaAppSetup.tsx` (modelled on `definitions/customAppDefinition.tsx`), `utils/application-editor.ts`, `types/application-editor.ts` (`SchemaApp` kind), `models/application-editor.ts` (`SchemaApplicationSetup`).
- **Backend / API**: no contract change in the final state — the schemas list keeps its fields; the editor reuses the existing `GET /api/v1/application-schemas/:id`.
- **i18n**: new `appsEditor.schemaForm.loadFailed` and `appsEditor.schemaForm.requiredMissing`; removed `catalog.create.quickApp`; the search field reuses `basic.searchPlaceholder`, `basic.clearSearch`, `basic.noResults`.
- **Accessibility**: search field named by its placeholder label; no-results is a `role="status"`. Known kit gap: `DialSchemaRenderer` labels a field's group, not its input.
