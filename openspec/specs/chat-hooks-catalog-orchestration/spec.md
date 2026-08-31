# Spec: chat-hooks-catalog-orchestration

## Purpose

Host-agnostic catalog orchestration layer in `@epam/ai-dial-chat-hooks`: the `useCatalogItemDetails` headless controller and its `CatalogDetailsApi` port, pure browse-state derivation helpers, the `resolveCatalogPrimaryAction` typed resolver, and the `useSkillFilePreview` lifecycle hook.

## Requirements

### Requirement: Catalog details operations are injected into a headless controller

`@epam/ai-dial-chat-hooks` SHALL export a `CatalogDetailsApi` matching the exact
current app wrapper signatures for deployment details, deployment limits,
personal/shared/public prompt reads, skill-file download, and skill-file
listing. `useCatalogItemDetails` SHALL accept an already configured instance
and return stable `onFetchDetails`, `onLoadContentFile`, and
`onLoadSkillDetailsFile` callbacks.

The operation names SHALL be `getDeploymentDetails`, `getDeploymentLimits`,
`getPrompt`, `getPublicPrompt`, `downloadSkillFile`, and `listSkillFiles`, with
their current parameter-object/positional conventions preserved rather than
normalized into a fabricated API.

The hook MAY use generated DIAL Core DTO types and operation signatures under
the existing `chat-hooks` exception, but SHALL NOT construct/configure a client,
know a base URL/auth/CSRF value, or import server-api, app contexts, i18n,
routing, notifications, storage, or rendered UI. Its current-skill ref SHALL be
private implementation state, not part of the returned public contract.

#### Scenario: Host supplies configured operations

- **WHEN** a host calls `useCatalogItemDetails` with an app adapter
- **THEN** all requests use that adapter and no import chain reaches
  `apps/chat/src/server-api` or client construction

#### Scenario: Callbacks remain stable

- **WHEN** the host re-renders with referentially unchanged options
- **THEN** all three returned callbacks retain their identities

### Requirement: Details dispatch preserves every current entity branch

The controller SHALL preserve the current dispatch and mapping behavior:
personal/shared/public prompts rebuild prompt content and overview; skills parse
their qualified id and combine manifest/inventory with `Promise.allSettled`;
models combine details with optional limits; agents and toolsets use deployment
details without model limits; deployment variants preserve MCP/connect
precedence, credentials and admin-specific data. Prompt/skill branches SHALL
never call deployment endpoints.

Rejected prompt/deployment requests SHALL resolve `undefined`. Skill manifest
and inventory failures SHALL remain independent, an unparseable downloaded
manifest SHALL yield its raw body, an invalid skill id SHALL issue no request,
and limits failure SHALL not discard successful model details.

#### Scenario: Skill request partially succeeds

- **WHEN** manifest download fails and recursive inventory listing succeeds
- **THEN** `onFetchDetails` returns the overview half without throwing

#### Scenario: Model limits fail

- **WHEN** model details resolve and the limits request rejects
- **THEN** mapped details are returned without limits

#### Scenario: Open skill changes before file load

- **WHEN** details are opened for skill B after skill A
- **THEN** subsequent content-file loads resolve against B, and archive actions
  parse their own item id rather than reading an exposed mutable ref

### Requirement: Browse-state derivations are pure and ordered

The package SHALL export immutable pure functions for selector visible-type
filtering, hide-owned filtering, favorite derivation, available-tab derivation,
and topic reconciliation. They SHALL use current predicates and order:
favorites are items whose `isUserFavorite` is true, tab ids follow supplied tab
order and include only types present in visible items, and topics are the
intersection of persisted topics with topics present in those items.

They SHALL NOT read contexts, storage, routes, translations, feature flags, or
network state and SHALL NOT replace `useFavoriteEntitiesState` or app preference
hooks.

The exported names SHALL be `filterCatalogItemsBySelector`,
`filterHiddenOwnedItems`, `deriveFavoriteItems`, `deriveAvailableTabIds`, and
`reconcileFilterTopics`.

#### Scenario: Stale topic is removed without mutation

- **WHEN** persisted topics contain one present and one absent topic
- **THEN** reconciliation returns a new set containing only the present topic
  and does not mutate either input

#### Scenario: Favorites retain item order

- **WHEN** favorited and non-favorited items are interleaved
- **THEN** favorite derivation returns only favorited items in original order

### Requirement: Primary-action resolution is typed and effect-free

The package SHALL export a string-enum/discriminated result for deployment and
prompt primary actions and an async resolver. Deployment items SHALL resolve
their id. Prompts SHALL prefer already seeded content, otherwise call a narrow
injected prompt-fetch callback, and SHALL return the current id, name,
description, content, and prompt-parameter presence needed by the host.

The resolver SHALL NOT navigate, select a deployment, write user config, show a
notification, import route constants, or swallow the host's error-reporting
information. Toolset/non-chat visibility remains the catalog/app predicate's
responsibility.

#### Scenario: Seeded prompt needs no request

- **WHEN** a prompt item already contains its body
- **THEN** the resolver returns the prompt result without calling the fetcher

#### Scenario: Prompt contains parameters

- **WHEN** the resolved body contains supported prompt parameters
- **THEN** the prompt result records that parameters are present so the app can
  navigate with its existing `pendingPrompt` state

### Requirement: Skill-preview lifecycle is headless and race-safe

The package SHALL export a hook that accepts the selected file id/name and an
async loader and returns loading, content, and a forbidden-or-generic error
classification. It SHALL clear stale content on selection change, ignore
settlements from older selections and after unmount, and preserve the current
forbidden classification.

It SHALL NOT render `SkillFilePreview`, import attachment-canvas context, open a
canvas, read theme/i18n, or replace `Catalog`'s separate content-preview loader.

#### Scenario: Older request resolves last

- **WHEN** file A starts loading, selection changes to B, and A resolves after B
- **THEN** A never replaces B's content or error state

#### Scenario: App bridges successful content

- **WHEN** the hook returns content for the selected file
- **THEN** the app adapter may pass it to `useSkillFilePreviewSync` and open the
  existing attachment canvas without the hook importing that app protocol

### Requirement: Public exports remain host-agnostic

All new types, hooks and helpers SHALL be exported from the package root and
documented in `libs/chat-hooks/README.md`. No new dependency on app code,
`react-i18next`, `react-router`, configured clients, or UI rendering SHALL be
introduced.

#### Scenario: Downstream host composes the APIs

- **WHEN** a downstream chat imports the controller, derivations, resolver and
  preview hook from `@epam/ai-dial-chat-hooks`
- **THEN** it can supply its own app adapters without deep imports into this
  repository
