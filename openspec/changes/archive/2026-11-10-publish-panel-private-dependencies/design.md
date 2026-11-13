# Design

## Context

See `proposal.md` for the motivation. What exists today, read from source:

- **What publish carries along.** DIAL Core copies an application's `dial:file` files and relinks them (`ApplicationService.copyApplication`), and chat-api adds the application icon and the author's own conversation files to the same publication request (`PublishService.getApplicationIconUrl`, `ConversationPublishAttachmentsService.buildAddResources`). Core does not copy the prompts, skills, applications or toolsets an application references (`ApplicationSchemaService.getPrompts` / `getSkills` / `getDeployments` only feed access checks and share), and chat-api leaves a conversation's references to other users' files untouched.
- **The schema is already annotated.** The quickapps application schema marks reference fields with `"dial:resource": true` and file fields with `"dial:file": true`; Core's `DialResourceKeyKeyword` and `DialFileKeyword` read the same markers. chat-api already fetches and caches schemas in `ApplicationSchemasService` (key `application-schemas:item:{userSub}:{schemaId}`, 60 s).
- **Closest precedent for the shape of this feature:** publish history. A host function loads it, `mapPublishHistoryEntryDto` (`libs/chat-hooks/src/catalog/publish.ts`) maps it, `usePublishHistory` (`libs/chat-hooks/src/catalog/use-publish-history.ts`) holds the state for the app's containers, and `libs/catalog` reloads it inside `useDetailsPublish` through a `getPublishHistory` prop. Only `libs/toolset-editor` may import `@epam/ai-dial-chat-hooks` among feature libs, so `libs/catalog` takes a callback.
- **Downstream.** `pg-ai-chat` is a Vite SPA with no backend of its own. It consumes the published packages and the generated client, with its own `server-api/publish.api.ts`. It reuses the panel and the hook; the endpoints are the shared contract.

## Goals / Non-Goals

**Goals:**
- A reliable, schema-driven list of direct private dependencies for every entity kind the issue names, readable by all three hosts.
- The panel section is the only deliberately minimal part: read-only, no selection.
- Data shape and layering that survive a later "add to this publication" without a contract change.

**Non-Goals:**
- Anything in the proposal's Non-goals, and a UI beyond a plain list.
- Moving resolver logic into a lib. `apps/chat-api` imports no `libs/*` (its only `@epam/*` import is `@epam/ai-dial-typescript-sdk`) and the module-boundary lint keeps it so; the backend is shared across hosts through OpenAPI and the generated client, not through code.

## Decisions

### D1. Two routes in the existing controllers, one DTO pair

`GET /api/v1/catalog/:entityType/:entityId/publish-dependencies` (`getCatalogPublishDependencies`) and `GET /api/v1/conversations/publish-dependencies?path=` (`getConversationPublishDependencies`). They are served by sibling controllers (`PublishDependenciesController`, `ConversationPublishDependenciesController`) on the same paths as `PublishController` and `ConversationPublishController`, the precedent being `ConversationPublishController` beside `ConversationController`, and reuse `CatalogEntityParamsDto` and `ConversationPathDto`. Responses share `ResourceDependenciesResultDto { dependencies: ResourceDependencyDto[] }` in `apps/chat-api/src/publish/dto/`, with `ResourceDependencyDto { id, name, version?, type, location }` and a `ResourceDependencyType` enum (`application | toolset | prompt | skill | file`). The DTOs are named for the resource, not the operation, because their shape does not depend on publishing. The routes and the policy behind them (what counts as a dependency, what publish already carries along) are publish-specific; a later share lookup would add its own route and policy over the same shape. Generated-client names are the one thing expensive to change later, which is why only they are neutral now.

*Alternatives:* one `GET /api/v1/publish/dependencies?itemId=` (rejected: it hides the two different readers behind one parameter and breaks the repo's route-per-host convention); a field on the publish-history response (rejected: different lifetime and cache semantics, and it would couple two lookups that fail independently).

### D2. Application resolver walks the schema, not a hardcoded shape

`ApplicationDependencyResolver` reads the application with `getCustomApplication` (the call `PublishService` already makes for the icon), takes `application_type_schema_id`, fetches the schema through `ApplicationSchemasService.getApplicationSchema` with the session `sub`, and runs a pure `collectSchemaResources(schema, value)` over `application_properties`.

`collectSchemaResources` follows `$ref` into `$defs`, selects the branch of `oneOf` / `anyOf` whose `const` `type` equals the value's `type`, recurses into `properties`, `items` and `additionalProperties`, and returns the strings found under `dial:resource: true` properties. `dial:file` is ignored. It lives in `apps/chat-api/src/publish/dependencies/schema-resource-collector.util.ts` and is unit-tested on a trimmed copy of the quickapps schema.

*Alternatives:* hardcode `dial-prompt` as `share` does (rejected: misses `dial-skill`, `tool_sets`, deployments and any custom schema); add a generic walker as a lib (rejected: only chat-api needs it, and chat-api imports no lib).

### D3. Conversation resolver reads the body already in the caller's bucket

`ConversationPublishDependenciesService` (in `apps/chat-api/src/conversations/`) reads the conversation the way `ConversationPublishService` does, with the same cross-bucket-safe call, then collects `model.id`, `assistantModelId` (both, so a private assistant is found whichever field holds it), `selectedAddons`, per-message `custom_content.skills[].url`, and attachment urls, normalising urls with the helpers `conversation-attachments.util.ts` and `share-resource.util.ts` already use. The ownership split is the inverse of `collectOwnedAttachmentRefs`: foreign, non-public file refs are the dependencies. A folder attachment is one entry; it is not expanded.

### D4. One classification helper

`apps/chat-api/src/publish/dependencies/publish-dependency.util.ts` exposes `toResourceDependency(resourceUrl)`: parse the prefix and bucket (`getResourceTypePrefix` / `getResourceBucket` in `publish-target.util.ts`), return `undefined` for a bare id or the `PUBLIC_BUCKET` (`constants/dial.constants.ts`), decode name and folder, split `name__version` with `splitEntityNameAndVersion`, and `dedupeDependencies` collapses by `id`. Both resolvers and the tests go through it, so "not public" is defined once.

### D5. Best-effort at the service boundary

Each service wraps its whole resolution in one try/catch that logs `logger.warn` (message only) and returns `{ dependencies: [] }`. Validation stays at the `ValidationPipe`. This is deliberate: the list is advisory, and a failing lookup must never make a publish look broken. It differs from `PublishRulesService`, which throws, because rules feed a submit; dependencies do not.

*Alternative:* surface 502 and let the panel show an error (rejected: it would teach users to distrust Publish for an advisory feature).

### D6. Libs: the data and the state, not the transport

- `libs/publish-panel`: `PublishDependency`, `PublishDependencyType`, `PublishDependenciesLabels`, `PublishDependenciesStyles`/`Colors`, `PublishDependenciesList`, and the `dependencies` prop on `PublishPanel` and `StandalonePublishPanel`. Text and colours ride the existing nested `PublishPanelLabels.dependenciesLabels` and `PublishPanelStyles.dependencies`, exactly as `accessRulesLabels` and `styles.accessRules` do, so `libs/catalog` and the hosts add no label or style prop. Count text is `getAnnouncement: (count: number) => string`, the repo's function form. No client, path, i18n or context.
- `libs/chat-hooks/src/catalog`: `mapResourceDependencyDto` (next to `mapPublishHistoryEntryDto`), `getCatalogPublishDependencies` on `createPublishApiClient` (the client instance is passed in; the conversation request has no lib wrapper, like `getConversationPublishHistory`, so the app calls the generated conversations API), and `usePublishDependencies({ isOpen, entityId, loadDependencies })` shaped like `usePublishHistory`: read on open, failure leaves it empty, a stale response is dropped, another entity's list is never returned, and a module-level empty array keeps identity stable.
- `libs/catalog`: `getPublishDependencies` prop on `CatalogProps` and `DetailsPanelProps`, loaded in `useDetailsPublish` with the same stale-response guard as the history. It does not import chat-hooks.
- `apps/chat`: `server-api` wrappers, `t()` labels and the three containers.

The two hooks (`usePublishHistory`, `usePublishDependencies`) are near-twins. Extracting a shared primitive would touch untouched code, so it is left as a follow-up rather than done here.

### D7. The section

One `Notification` (warning) and a `<ul>`, placed as the last section of the panel's Main view, announced through the kit `LiveRegion`. Loading, error and empty all render nothing: the list is advisory and appears when it is ready, with no spinner to flash or layout to jump. This is the one place the design chooses silence over an error state, for the same reason as D5. Each row starts with the entity's own icon, never one invented per kind: `DeploymentIcon` (the host-resolved `iconUrl`, else initials) for entities, as the header of the same panel does, and the kit's `FileIcon` for a file or folder, the pattern `AddOnListItem` in `libs/catalog` already uses. The row then shows the name and version, and the type and folder as text. The icon URL is resolved by the host from the deployments and toolsets the catalog has already loaded (`createPublishDependencyIconResolver`, through `usePublishDependencyIconResolver` in `apps/chat`), so no extra request is made; an entity the catalog has not loaded shows its initials.

### D8. Cache, authorization, gating, telemetry

No chat-api cache of the result (the schema fetch keeps its existing 60 s cache). Authenticated session only; every upstream read carries the caller's bearer token. Not behind `ENABLED_FEATURES*`. No metrics; warnings only.

## Risks / Trade-offs

- **System-prompt gap** (quickapps `DialSystemPromptConfig.path` unmarked) → not listed; documented in the spec and the proposal. The resolver registry makes adding a case local.
- **Listed but not publishable by the caller** (a file or entity in someone else's bucket) → the list says only "not public"; no ownership marker in v1. Adding `isOwnedByCaller` later is an additive DTO field.
- **Schema drift** (a new Core keyword replaces `dial:resource`) → the collector is one util with a fixture-based test; Core's keyword is the contract.
- **Large conversations** → collection is one pass over the stored body that publish already reads; no folder expansion.
- **Advisory silence** (D5, D7) → a real outage looks like "no dependencies". Accepted; the warning log is the signal, and publish itself still validates in Core.
- **Duplicated hook shape** → tolerated for scope discipline; noted as a follow-up.

## Migration Plan

No data migration. Ship backend and generated client first (inert), then the libs, then the hosts. `pg-ai-chat` adopts by wiring `getPublishDependencies` and the dependency labels after upgrading the packages. Rollback: remove the host wiring; the panel renders as before.

## Open Questions

- Whether to extract one shared "load once per open" primitive for `usePublishHistory` and `usePublishDependencies` (a follow-up refactor; nothing here depends on it).
- Whether a later iteration marks a dependency the caller does not own (additive; does not change this change's contract).
