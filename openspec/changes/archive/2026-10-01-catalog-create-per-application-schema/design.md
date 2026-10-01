## Context

`DeploymentsContext` loads the application type schemas (runners) at startup in parallel with deployments and toolsets (`apps/chat/src/context/DeploymentsContext.tsx:367`). Before this change the catalog used them only to find the QuickApp schema: `useCatalogEditNavigation` built a single `quick-app` Create option, and only QuickApp apps were editable. `/apps-editor` had one kind, `QuickApp`, whose Setup is an iframe editor (`QuickAppSetup` → `AppEditorIframe`) reached through a metadata-first create; a runner without `editorUrl` could be created but then showed "Editor not available for this application type yet."

The legacy chat (`origin/development-0.x`) listed every schema in its Add App menu (`components/Marketplace/AddAppButton.tsx`) and picked the settings form in `EditorForm.tsx`: `editorUrl` → `CustomViewerForm` (iframe), else `schema.properties` → `SchemaDrivenForm` (`DialSchemaRenderer`), else nothing. It never read `dial:applicationTypeSchemaEndpoint`.

Constraints: `libs/*` must not know routes, query keys, i18n or API clients (AGENTS.md §Library isolation); the kit's `ButtonDropdown` accepts no menu header; `DialSchemaRenderer` has no 2.0 replacement.

## Goals / Non-Goals

**Goals:**

- One Create option per runner, reachable in a menu of any length.
- Configure editor-less runners with a form built from their JSON schema, as 0.x did.
- Keep the embedded-editor flow for runners that have `editorUrl` byte-for-byte unchanged.

**Non-Goals:**

- Filtering runners by capability (`editorUrl`, `schemaEndpoint`, `properties`).
- A dedicated External app form, reading `schemaEndpoint`, or translating the renderer's internal texts.

## Decisions

**D1 — Show every runner; no configurability filter.** `getRunnerSchemas` only dedupes by id and drops id-less entries and `custom_app`. Iterations tried filtering by `editorUrl || properties` (first resolved server-side per schema, then read from the list), then `editorUrl || schemaEndpoint`; the product owner rejected each, because hidden runners were ones users expected to see (External app). An unconfigurable runner now opens the schema form, which reports "No configurable properties". *Alternative*: keep a filter — rejected by the product owner.

**D2 — Resolve the editor kind in `ApplicationEditorPage`, keyed on `editorUrl` only.** `/apps-editor` stays a single route; the page maps the `schema` query parameter to `QuickApp` (has `editorUrl`, or unknown) or `SchemaApp` (no `editorUrl`) and keys `ApplicationFormEditor` by the result. The page waits while the schema list is loading and empty, so a deep link to an editor-less schema does not flash the iframe layout. *Alternatives*: a second route (would duplicate the URL builders and the lib's `buildQuickAppCreateUrl` contract), or branching inside `QuickAppSetup` (would mix two create strategies in one definition).

**D3 — `SchemaApp` creates all at once.** A schema may declare required properties; creating metadata first (the QuickApp strategy) would send an application DIAL Core may reject, and would show a "create first" step with nothing to configure afterwards. `AllAtOnce` sends `type` + `applicationProperties` in one `createApplication` call, following `definitions/customAppDefinition.tsx`.

**D4 — The full schema is fetched by the Setup, not carried by the list.** The form needs `properties`, `required` and nested definitions. The list endpoint's SDK typing carries only `dial:*` fields; passing the whole schema through the list for every runner was tried and removed. The Setup calls the existing `getApplicationSchema(id)`, cached server-side per user for 60 s.

**D5 — Required-property validation lives in the setup model.** `ApplicationEditorFormDefinition.validateSetup(setup, t)` has no access to the schema, so `SchemaApplicationSetup.requiredProperties` carries the schema's top-level `required`, re-applied by the Setup whenever it differs (an edit's `loadSetup` replaces the whole setup). Only top-level names are checked, as 0.x did; nested fields rely on the renderer's own highlighting.

**D6 — Search state in the hook, rendering in the lib.** `useCatalogEditNavigation` owns the query (it knows which options are runners and how the Skill group filters) and returns `createSearch`. `@epam/ai-dial-catalog`'s `CreateButton` renders the kit `Dropdown` + `Button` (because `ButtonDropdown` cannot take a `menuHeader`), the `Search`, the `Highlight`ed labels and the no-results status; strings arrive through `Catalog.titles`. No route, key or client crosses into either lib.

**D7 — Fixed-size panel from mirrored kit geometry.** A 320px width (`matchReferenceWidth={false}`, `placement="bottom-end"`) stops the panel resizing while filtering; `maxDropdownHeight` = 44 + 8 + 7×40 + 6×2 = 344px shows seven rows. The kit sizes rows internally, so the constants in `libs/catalog/src/constants/create-menu.ts` mirror its overlay geometry. *Alternative*: capping the number of runners — implemented, then replaced because it made runners unreachable.

**D8 — One alphabetical order.** Runners and static options sort together with `localeCompare(…, { sensitivity: 'base' })`, as 0.x's Add App menu did.

**D9 — Runner labels are schema data.** Every runner shows its `displayName`; the special "QuickApp" translated label is removed so "Quick app" and "Quick app 2.0" are distinguishable.

**D10 — `returnUrl` removed from the editors.** The editors return to a fixed route (`ROUTES.Catalog`, or the scheduled-tasks list), so the catalog's URL builders pass no `returnUrl`, and the open-redirect guards `isSafeReturnUrl` / `resolveReturnUrl` go with the only input they guarded.

## Risks / Trade-offs

- [`DialSchemaRenderer` names a field's group (`aria-labelledby="undefined-label"`), not its input] → noted for `ai-dial-ui-kit`; tests query the input inside the named group.
- [The renderer's texts ("Enter a value", "Add Item", remove-item aria labels) are English] → pass the `texts` prop with i18n keys in a follow-up.
- [Kit row height changes would break the 344px calculation silently] → constants documented next to the geometry they mirror.
- [A runner with no editor and no properties opens an empty form] → accepted per D1.
- [Property names `endpoint`, `features`, `inputAttachmentTypes`, `maxInputAttachments` are hoisted out of `applicationProperties` on create by `hoistApplicationFields`, a custom-app behaviour] → unchanged; would need a per-type opt-out if a runner schema uses those names.
- [Removing `returnUrl` means an editor opened from elsewhere always lands on its fixed route] → accepted; no in-repo caller passes another return target.

## Migration Plan

No data migration. Hosts of `@epam/ai-dial-chat-hooks` must pass `schemas` instead of `quickAppSchemaId` to `useCatalogEditNavigation` and drop `labels.createQuickApp`; `apps/chat` is the only consumer in this repo. Rollback is a revert of the change's commits.

## Open Questions

- `listApplicationSchemas` in the working tree currently spreads the raw upstream item (`...rawItem } as any`) and logs it; that returns undeclared fields and fails two service tests. It must be resolved (removed or turned into declared DTO fields) before merge.
- `RunnerSchemaLike` still declares `editorUrl` and `schemaEndpoint`, which `getRunnerSchemas` no longer reads — remove them or restore a use.
- Whether External app needs its own form (0.x `ExternalAppForm`) rather than the generic schema form.
