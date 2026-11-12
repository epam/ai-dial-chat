# Proposal

## Why

Publishing an entity that references other resources produces a broken copy for its audience unless every referenced resource is public too. DIAL Core copies only an application's declared files and icon on publish. It does not copy the prompts, skills, applications and toolsets the application refers to, and it leaves a conversation's references to other users' files and to private applications untouched. Today the Publish panel does not say so, and the publisher tracks it by hand ([#9790](https://github.com/epam/ai-dial-chat/issues/9790)). The panel should list what is still private before the user submits.

## Problem

- An agent built from other entities (application → prompt, skill, toolset, application) stops working for its viewers until each of those is published. Nothing in the panel reveals which ones are not.
- The information already exists in the data DIAL Core stores (`dial:resource` markers in the application's schema, the conversation body). Only the surface to read and show it is missing.

## What Changes

- **chat-api:** two read endpoints that list the **direct** dependencies of the item being published that are not in the public bucket, in the style of the existing publish-history endpoints:
  - `GET /api/v1/catalog/:entityType/:entityId/publish-dependencies` (next to `getCatalogPublishHistory` in `apps/chat-api/src/publish/publish.controller.ts:215`);
  - `GET /api/v1/conversations/publish-dependencies?path=` (next to `getConversationPublishHistory` in `apps/chat-api/src/conversations/conversation-publish.controller.ts`).

  The catalog route is served by a `PublishDependenciesService` in `apps/chat-api/src/publish/dependencies/` with a per-resource-type resolver registry. The conversation route is served by a service in the `conversations` domain next to `ConversationPublishAttachmentsService`. Both share one pure classification helper and the response DTOs. The application resolver is **schema-driven**: it reads the application's schema through `ApplicationSchemasService` and collects every value on a `dial:resource` field. The conversation resolver reads the stored conversation body. Toolset, prompt, skill and project resolve to an empty list, because no references exist in their DIAL Core model (verified in `ai-dial-core`: `ToolSet`, `Application` and the quickapps schema).
- **Generated client:** new OpenAPI operations `getCatalogPublishDependencies` and `getConversationPublishDependencies`, a shared `ResourceDependencyDto` / `ResourceDependenciesResultDto`, regenerate `libs/chat-api-client`.
- **libs/chat-hooks:** a `PublishDependency` mapper from the DTO, a `usePublishDependencies` hook following the existing `usePublishHistory` (`libs/chat-hooks/src/catalog/use-publish-history.ts`), and `getCatalogPublishDependencies` added to `createPublishApiClient` (`libs/chat-hooks/src/catalog/create-publish-api.ts`).
- **libs/publish-panel:** a `PublishDependency` type, an optional `dependencies` prop on `PublishPanel` / `StandalonePublishPanel`, a read-only `PublishDependenciesList` section with labels, colors and class-name props. The section is hidden when the list is empty.
- **libs/catalog:** a `getPublishDependencies` prop threaded to the details panel's publish flow, beside `getPublishHistory`.
- **apps/chat:** server-api wrappers, `t()` strings and wiring in all three hosts: conversation, catalog details panel, project.
- Informational only: no selection, no "add to this publication", no blocking of submit.

## Alternatives considered

| Option | Verdict |
|---|---|
| **A. Server-side resolver over DIAL Core data, one list endpoint per host kind (chosen).** Reuses the schema markers Core itself uses, keeps the logic in the one place that already holds the bearer token and DIAL parsers, and the generated client carries it to every host (including `pg-ai-chat`). | Chosen |
| B. Compute client-side in `libs/chat-hooks` from the entity bodies the app already holds | Rejected: the application body and its schema are not all on the client, the conversation body is large, and every host would re-implement the walk. |
| C. Hardcode the known reference shapes as `share` does (`type === 'dial-prompt'`) | Rejected: that already misses `dial-skill`, `tool_sets` and deployments, and breaks for any custom application schema. |
| D. Ask DIAL Core for the resolved resource list | Out of scope: Core changes are not proposed. Core exposes no such endpoint today. |

## Non-goals

- Adding the listed dependencies to the same publication request, or any selection state.
- Blocking submit when private dependencies remain (warn-only).
- Transitive dependencies. The list shows direct references only. A private dependency's own private dependencies appear when the user opens that dependency's Publish panel.
- Any change to DIAL Core, to the quickapps schema, or to what publish already sends (the application icon and owned conversation files stay in the same request).
- Dependencies of a conversation that live in `playback` / `replay` stacks (same boundary the existing attachment collection uses).

## Known gap (flagged, not fixed here)

A quick app's system prompt of `type: 'dial'` stores the prompt in `path`, which the quickapps schema does not mark `dial:resource`. Neither DIAL Core nor a schema-driven walk sees it, so that dependency is not listed. The design records this and the resolver is written so adding a case is one registry entry.

## Capabilities

### New Capabilities
- `publish-dependencies-api`: the two read endpoints, what counts as a dependency per entity kind, the best-effort failure behavior, the response contract and the generated-client surface.

### Modified Capabilities
- `publish-panel-library`: the read-only dependencies section, its props, labels, colors, class names, states and accessibility.
- `catalog-publish-flow`: catalog entity and project hosts load and pass the dependencies to the shared panel.
- `conversation-publish-flow`: the conversation host loads and passes the dependencies to the shared panel.

## Impact

- **Code:** `apps/chat-api/src/publish/` (service, resolvers, DTOs, controller, module), `apps/chat-api/src/conversations/` (controller route, DTO reuse), `libs/chat-api-client` (regenerated), `libs/chat-hooks/src/catalog/`, `libs/publish-panel/src/`, `libs/catalog/src/` (props only), `apps/chat/src/server-api/`, the three publish containers and `apps/chat/src/i18n/locales/en.json`.
- **Shared libs (scope flag):** touches `libs/publish-panel`, `libs/chat-hooks` and `libs/catalog`. Library isolation holds: the endpoint paths and the configured client stay in `apps/chat` and `libs/chat-hooks` (the documented exception for the generated client); `libs/publish-panel` and `libs/catalog` receive only a typed `dependencies` list or a `getPublishDependencies` callback and `*Labels`, with no `/api` path, i18n or app context.
- **i18n:** new user-visible strings (section title, per-type labels, empty/loading/error text); keys under `publish.dependencies*` (the shared `PublishI18nKeys` namespace). In libs they arrive through `*Labels` with English defaults.
- **Docs:** `libs/publish-panel/README.md`, `libs/chat-hooks/README.md`, `libs/catalog/README.md`, `docs/architecture.md` (new endpoints), `npm run validate:docs` and `npm run validate:specs`.
- **Downstream hosts:** `pg-ai-chat` consumes the same packages and generated client, so it gets the section by wiring `getPublishDependencies`; the backend it talks to must expose the new endpoints.

## Backward compatibility and rollback

Not breaking. New endpoints, new optional props and a new optional callback; omitting any of them leaves today's panel unchanged. Revert by removing the host wiring (the panel hides the section when no list is supplied); the endpoints and lib additions are inert without callers.

## Acceptance criteria

- Opening Publish for an application that references a private prompt, skill, application or toolset lists each one with name, type and location; a fully public one shows no section.
- Opening Publish for a conversation lists a private application model or add-on, a private skill, and a file in another user's bucket; files in the author's own bucket and the application icon are never listed (they publish with the item).
- Toolset, prompt, skill and project panels show no dependencies section.
- A failed or slow dependency lookup never blocks publishing and never shows a blocking error.
- All three hosts show the same section; strings, RTL mirroring and accessibility follow the repository rules.
- `npm run openapi:check`, `npm run validate:docs`, `npm run validate:specs`, lint and the affected tests pass.
