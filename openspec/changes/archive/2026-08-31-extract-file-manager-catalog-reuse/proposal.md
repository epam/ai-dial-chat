## Why

`apps/chat` still owns reusable file-manager presentation and catalog
orchestration that downstream DIAL chat applications copy. The recent
`chore(chat): reuse components` refactor moved favorites state and catalog
limits mapping into `@epam/ai-dial-chat-hooks`, but it did not make the
file-manager shell/attach surface or the remaining `CatalogView` algorithms
reusable. Continuing from the pre-refactor specification would duplicate new
hooks, restore obsolete favorites contracts, and describe types that no longer
exist.

## Problem

- File-manager hosts must copy `DialFileManagerShell`, its loader/progress
  modals, attach selection behavior, labels, and grid-editing scroll wiring.
- Catalog hosts must copy entity-specific details dispatch, derived browse
  collections, primary-action resolution, and skill-preview request lifecycle.
- The existing draft does not match the current branch: it invents controller
  fields, gives `AttachResult` and upload state the wrong shapes, assumes a
  nonexistent CSS artifact, and misses newly authoritative capabilities.

## What Changes

### Track 1 — reusable file-manager UI

- Make `@epam/ai-dial-chat-shared` the canonical owner of the shell, attach
  modal surface, loader/progress modals, their label/prop contracts, the exact
  view-layer enum/type subset (including upload validation),
  `getParentFolderPath`, and
  `useGridEditingScroll`.
- Define `FileManagerController` as the exact structural subset of the current
  `UseDialFileManagerResult` read by the shell. Tabs and selection remain
  explicit controlled component props.
- Preserve existing `@epam/ai-dial-chat-hooks` imports through compatibility
  re-exports and compile-time assignability checks.
- Add the file-manager and narrowly leaked AG Grid engine as peer/external
  dependencies of `chat-shared`; record the same narrow exception in the
  repository architecture rules.
- Give `chat-shared` its own Tailwind/PostCSS entry and publish the Vite-emitted
  `dist/index.css` as `@epam/ai-dial-chat-shared/styles.css`.
- Reduce the main-chat page and modal to host adapters for configured hooks,
  i18n, config, notifications, browser download, and other app-owned behavior.

### Track 2 — reusable catalog orchestration

- Add a headless `CatalogDetailsApi` port and `useCatalogItemDetails` hook in
  `@epam/ai-dial-chat-hooks`, preserving the current prompt, skill, model,
  agent, and toolset dispatch and partial-failure behavior.
- Add pure helpers for selector filtering, hide-owned filtering, favorites,
  available tabs, and stale-topic reconciliation.
- Add a typed primary-action resolver that returns data to the host; routing,
  selected deployment state, and notifications remain in `apps/chat`.
- Add a headless skill-preview loading hook. The app adapter continues to own
  attachment-canvas synchronization, theme, i18n, and rendering.
- Reuse the recently extracted favorite-state and limits-mapping hooks instead
  of replacing or duplicating them.

## Non-goals

- No new library, backend/OpenAPI contract, route, storage schema, feature
  flag, UI redesign, or downstream `ai-dial-chat-pg` migration.
- No move of configured clients, auth/session state, app contexts, i18n,
  navigation, notifications, or browser-download policy into a library.
- No change to the built-in catalog content-preview request/stale-response
  behavior.

## Capabilities

### New Capabilities

- `chat-shared-file-manager-ui`: published file-manager presentation,
  controlled attach surface, exact controller/view contracts, styles, and
  package boundaries.
- `chat-hooks-catalog-orchestration`: injected catalog details controller,
  pure browse derivations, primary-action resolution, and skill-preview
  lifecycle.

### Modified Capabilities

- `chat-hooks-file-manager-domain`
- `chat-hooks-file-manager-composition`
- `file-manager-grid-editing-scroll`
- `catalog-item-details-fetch`
- `catalog-use-in-chat`
- `catalog-sort-filter-persistence`
- `catalog-tab-persistence`
- `catalog-favorites-persistence`
- `prompt-catalog-integration`

## Acceptance criteria

- The main chat preserves current desktop/mobile, RTL, keyboard, focus,
  loading, error, selection, and mutation behavior.
- `UseDialFileManagerResult` is assignable to `FileManagerController` without
  a cast; no fabricated field is added to either contract.
- `chat-shared` has no edge to `chat-hooks`, `catalog`, generated clients, or
  any app project; its only AG Grid use is the documented event-binding hook.
- A packed `chat-shared` package resolves `./styles.css` to emitted CSS that
  contains representative base and `mobile`/`desktop` utilities.
- Catalog details, partial failures, prompt parameters, favorites, persistence,
  and skill previews match the updated branch.
- Strict OpenSpec validation and the listed Nx/docs checks pass.

## Impact

- `libs/chat-shared`: new public file-manager UI surface, peer metadata,
  stylesheet export, README, and tests.
- `libs/chat-hooks`: compatibility re-exports and new catalog orchestration
  APIs/tests/README; existing favorites and limits APIs remain canonical.
- `apps/chat`: thin file-manager and catalog adapters plus focused wiring tests.
- `AGENTS.md` and `docs/architecture.md`: ownership and narrow AG Grid exception
  updated in the same implementation change.

The dependency direction remains `apps/chat -> chat-hooks -> chat-shared`,
`chat-hooks -> catalog`, and `catalog -> chat-shared`, with no reverse edge.
The change is additive for published consumers because moved hook exports are
retained as compatibility re-exports.
