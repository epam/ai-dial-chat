# Proposal

## Why

A user can create two toolsets or two agents that look identical in the catalog.
Two reports describe the same gap from different sides:

- #9726: a toolset can be created with the same name and version as an agent that
  exposes an MCP interface (for example a DIAL Loop app, listed under both Agents and
  Toolsets). Nothing blocks it, and the two cards are indistinguishable.
- #9381: after the data-loss fix, QA still expects duplicate names to be rejected, while a
  name freed by renaming must stay reusable.

Root cause, verified on `development`: uniqueness today is only a *storage-path* check.

| Entity | Path | What a collision does today |
| --- | --- | --- |
| Toolset | `toolsets/<bucket>/<folder>/<name>__<version>` | create-only 412 becomes 409 "Toolset version already exists" (`apps/chat-api/src/toolsets/mutation/toolsets-mutation.service.ts:105`) |
| Application | `applications/<bucket>/<folder>/<name>__<version>` | create-only retries `name-2__version` … `name-20__version`, 409 only when all are taken (`apps/chat-api/src/applications/applications.service.ts:248`) |

Consequences:

1. A toolset and an MCP-capable application live under different resource roots, so
   neither path check ever sees the other (#9726).
2. An application silently lands on `name-2__version` and keeps the same displayed name,
   so identical cards appear (#9381).
3. A path is fixed at creation and does not follow a rename, so the path says nothing
   about what the user sees. Only displayed name and version do.

DIAL Core is read-only context here: it enforces a shared deployment-id namespace only for
admin-config entities (`ConfigResourceController.rejectDuplicateDeploymentId`), not for
user-bucket resources. A Core change would be a DIAL Core issue and is not an option for
this change.

## What Changes

- Add one backend uniqueness check, keyed by **(folder, displayed name, displayed
  version)** inside the caller's own bucket (`isMy`), evaluated **per catalog tab**.
- Run it on every write that places or re-labels a toolset or application: create
  (including create-only "save as new version"), fork, move, and in-place update when name
  or version changes (the entity being edited is excluded from the comparison).
- A match answers `409` with a message that names the conflicting kind; the Save panel
  already renders a 409 inline and stays open.
- Tab membership follows `catalog-interface-classification`: Toolsets tab = toolset
  resources plus applications whose `interfaces` include `mcp`; Agents tab = applications
  with `chat` or `custom_ui` (or no recognised interface). An application listed under
  both tabs is checked against both on update.
- Keep the `name-N` next-free-path fallback for applications, but only for a path held by
  an entity whose displayed name or version differs (the renamed-app case behind #9381),
  and give toolsets the same fallback. A renamed toolset keeps its original path exactly
  as a renamed application does, so without it a free name would be refused with a false
  "version already exists". It is added because the precedent already exists for
  applications: it is nearly free here, keeps the two kinds uniform, and lets whoever later
  removes the scheme do it once. The candidate limit and the leaf builder live in one
  shared util; each service keeps its own short loop.
- Compare the trimmed, case-sensitive displayed name, resolved by one rule: a string as it
  is, a locale map by its `en` entry, otherwise its first entry. Versions compare as stored
  strings; an absent version is the platform default.

## Non-goals

- Any DIAL Core change.
- Existing duplicates (no cleanup or migration).
- The reverse case: creating an application whose type schema declares `mcp` when a
  same-name toolset exists. Core derives `interfaces` from the schema
  (`ApplicationSchemaService.getMcp`), so it is not known at create time; the new
  application is treated as an agent.
- Atomicity under concurrent writes and the 30-second list caches beyond the freshness
  rule in design.md.
- Catalog badges or any other UI differentiation of already-created duplicates.
- Skills and prompts (their name is the path; they already return 409).

## Capabilities

### New Capabilities

- `resource-name-uniqueness`: the cross-type, per-tab uniqueness rule for toolsets and
  agents, its key, scope, tab membership, error semantics and exclusions.

### Modified Capabilities

- `toolset-write-api`: create, update and move reject a (folder, name, version) clash with
  any toolset-tab entity; create-only gains the next-free-path fallback applications
  already have, so only an exhausted fallback keeps the path-only 409.
- `applications-write-api`: create, update, fork and move apply the same check against the
  agents tab (and the toolsets tab for a dual-interface application on update).
- `application-create-api`: the `createOnly` next-free-path fallback applies only when the
  path is held by an entity with a different displayed name or version.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| A. Backend check by displayed name and version, per tab, own bucket (chosen) | Authoritative, one place for all clients, reuses the Save panel's 409 handling. Costs one list read per write. |
| B. Client-side check against the loaded catalog | Rejected as the only guard: misses entities not loaded and races. Could be added later as a UX hint. |
| C. UI-only differentiation (badge, "also an agent" note) | Rejected: leaves duplicates; the issue's first option and the team's preference is prevention. |
| D. Shared namespace in DIAL Core for user buckets | Out of reach: a DIAL Core proposal. |
| E. Keep the path-only check | The status quo that produced both issues. |

## Acceptance criteria

1. With an own agent that exposes `mcp` named `X` version `V` in folder `F`, creating a
   toolset `X`/`V` in `F` answers 409 and the Save panel shows the message inline.
2. Creating a second agent `X`/`V` in the same folder answers 409 (no `X-2` path is created).
3. The same name and version in a different folder, or in another user's bucket (public,
   shared, organisation), is accepted.
4. An agent without `mcp` does not block a toolset of the same name and version.
5. Renaming agent A to the name and version of agent B in the same folder answers 409;
   saving A without changing name or version never conflicts with itself.
6. An application or toolset renamed away from `X` frees `X`: creating a new `X` succeeds at
   the next free path with displayed name `X`.
7. The cross-kind and same-kind messages appear inline in the Save panel and on the Name
   field in create and edit mode, and the panel stays open.
8. `npm run openapi` and `npm run openapi:check` are clean; `chat-api` and `apps/chat` tests,
   lint and `npm run validate:specs` pass.

## Known limitations

- #9726 describes "the same name" without a version. The key includes the version, so an
  MCP-capable agent at a different version from the new toolset does not block it. This is
  deliberate (versions coexist) and was chosen by the team.
- Only the caller's own bucket is compared, so a platform-provided or public entity of the
  same name never blocks a personal one.
- The backend classifies tabs as if the Toolsets tab is enabled, which can only make the
  check stricter.

## Impact

- `apps/chat-api`: a shared check helper and a shared next-free-path util, with calls in
  `ToolsetsMutationService` and `ApplicationsService`; `ToolsetsListingService` gains a
  fresh-read option (the deployments listing already has one) and moves into a
  controller-free module so `ApplicationsModule` can read toolsets without reshuffling the
  OpenAPI document. Closest model: the create-only handling at
  `apps/chat-api/src/applications/applications.service.ts:248`. No `libs/*` change: the
  backend does not import the libs, so the tab-membership rule gets a small backend
  equivalent pinned to the spec table (see design.md).
- `apps/chat`: new user-visible string(s) for the cross-kind conflict in
  `apps/chat/src/i18n/locales/en.json` with matching enum members in
  `apps/chat/src/constants/translation-keys.ts` (existing keys at line 1423 and 1874 cover
  same-kind conflicts). Locale files other than `en` follow the existing fallback.
- `libs/chat-api-client`: no new endpoint; only added `409` documentation, regenerated via
  `npm run openapi`.
- Docs: `docs/architecture.md` unaffected; the three modified specs and one new spec change.

## Compatibility and rollback

Not breaking for clients: the endpoints, DTOs and 409 status already exist; the new
behaviour is additional 409 cases. The one visible change is that a duplicate which used to
succeed (as `name-2`) now fails. Rollback is reverting the helper calls; no data format or
migration is involved. Existing duplicates are untouched.

## References

Issues #9726 and #9381 (referenced only, not closed by this change).
