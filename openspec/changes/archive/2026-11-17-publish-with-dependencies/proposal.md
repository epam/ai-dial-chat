# Proposal

## Why

Publishing an application today only **warns** about the private resources it refers to (skills, prompts, toolsets, other applications). The published copy still points at the author's private URLs, so when another user calls it, DIAL Core checks read access on every non-public reference and answers 403 (`BaseRequestFunction.shareApplicationPrompts/Skills/Deployments`). The publisher is told to publish each dependency by hand, and even then the application keeps its private references, so it stays broken. Users expect one click on Publish to produce a working published application.

## Problem

- The Publish panel lists "Private dependencies" with a warning (`apps/chat/src/i18n/locales/en.json:624`); nothing publishes them.
- DIAL Core's publication request carries only resource URLs (`sourceUrl`, `targetUrl`, `action`, `publishCredentials`), accepts mixed resource types in one request and approves or rejects it as a whole, but rewrites links only for `FILE` resources and `iconUrl`. References to prompts, skills, toolsets and applications inside `application_properties` are copied as they are.
- The review copy Core makes at `createPublication` is read-only for the author, and the public copy is writable only by approvers, so the references cannot be fixed after the request exists. They must already be right in the **source** the request names.

## Solution

When the user publishes an **application**, chat-api publishes it together with its **first-level** private dependencies in **one** DIAL Core publication request, and the published application points at the published copies.

1. Resolve the application's first-level private dependencies with the existing resolver. Any failure while preparing them (reading, schema, target lookup, creating the copy) is logged and the application is published the old way, without dependencies.
2. Compute each dependency's public `targetUrl` in a per-application namespace that is a sibling of the published application (same idea as published conversation attachments, but a sibling so a dependency that is an application cannot collide with the application's own path).
3. Skip any dependency whose target already exists (the republish-after-unpublish case) but still point the application at it.
4. Make a **temporary copy** of the application in the author's bucket with Core `copyResource`, rewrite its `dial:resource` values to the dependencies' target URLs (GET then PUT of the copy, as `forkApplicationVersion` does), and call `createPublication` with the copy as the application's `sourceUrl` plus one `ADD` resource per dependency still to publish, while the application's own `targetUrl` stays the one the original would have had.
5. Delete the temporary copy as soon as `createPublication` returns, on success and on failure. Core copies sources into its review bucket during that call and uses only the review copies afterwards (approve copies review to public, reject deletes review).
6. Keep the author's version status, history and Unpublish working: the copy lives at a deterministic staging path that `isSameResourceUrl` (`apps/chat-api/src/publish/publication.util.ts:91`) maps back to the original on the source side.
7. The application's Publish panel shows the section as **Dependencies** with a plain caption ("Private dependencies listed below are published together with your {{entity}} so it can work correctly") instead of the warning, and the rows laid out as in the product mockup (40px rounded icon, type label above the name). The rows stay as they are. The conversation and project panels keep their current text.

The original application is never modified, so a rejected or failed request leaves nothing broken behind.

## What Changes

- chat-api: publishing an application collects its first-level private dependencies, builds the temporary copy, and submits them in one `createPublication`; dependencies already published at their target are reused. Any failure while preparing the dependencies falls back to the old publish; the public `GET .../publish-dependencies` stays best-effort.
- chat-api: `PublishService.publish` (`apps/chat-api/src/publish/publish.service.ts:147`) gains the dependency path for `applications`; other entity types are unchanged. Unpublish is unchanged.
- chat-api: publication matching (`isSameResourceUrl`) maps the staging path back to the original on the source side so status, history and unpublish access still see the application as published.
- Publish panel (`libs/publish-panel`): one optional presentation field (`dependenciesLabels.appearance`) with its own colors and type classes; defaults unchanged. App host: new strings for the application panel only.
- Dependencies are published with `publishCredentials` left off.

## Non-goals

- Dependencies of dependencies. Only the first level is handled and the user is not told about deeper levels.
- Conversations, toolsets, prompts, skills and projects. Only applications are in scope; toolsets, prompts and skills have no references to resolve, and conversation link handling is a separate piece of work. Their panels keep today's dependency section text.
- Changing Unpublish: it removes the application only, as before.
- The org-unit `copy-to-org-unit` path (`apps/chat-api/src/publish/org-unit-copy.service.ts`).
- A dependency published by hand earlier while the application still refers to the private original.
- Rewriting `resource_dependencies` of an application.
- Restyling the dependency rows.
- Any change to DIAL Core (the repository treats it as read-only, API-first).

## Known limitations (documented, not guarded)

These are deliberately not blocked in this version; a guard can be added later without redoing anything. Details and effects are in `design.md` D8 and D11.

- A dependency that is an application with its own private references is published as it is, so calls to it return 403.
- Applications with interceptors cannot be copied by a non-administrator (Core answers 403); they are published the old way, without dependencies.
- Applications with a schema that enables bucket copy leave an orphaned bucket; applications with a `function` get a new function id on the copy (silent).
- A dependency changed since it was published is not refreshed when the same application version is published again after an unpublish.
- Unpublishing a dependency on its own makes the published application that uses it invalid.
- A dependency in another user's bucket is not published (as for conversation files), though the panel still lists it.
- A toolset dependency is published without credentials; each user authorizes it.
- Core records the temporary copy's path as the publication's source; another Core client calling `listPublishedResources` would see that deleted path (chat-api and its frontend do not call it).

## Alternatives considered

| Option | Verdict |
|---|---|
| Rewrite references in the original application, then publish it | Rejected. A rejected or failed request leaves the author's original broken. |
| Swap the original's body for the rewritten one around `createPublication`, then restore | Rejected. No precedent in the repo (the only swap, `commitApplicationVersion`, is a persistent version exchange), and a crash in the window leaves a broken original. Making it safe needs a snapshot, which is the temporary copy again. |
| Rewrite references at read time (as for published conversation attachments) | Rejected. Core evaluates the stored references at call time, so reads through chat-api do not help. |
| Edit the review copy or the public copy after the request is created or approved | Rejected. The review copy is read-only for the author and the public copy needs approver rights. |
| Publish dependencies in separate requests | Rejected. Several approvals, and the application could go public before its dependencies. |
| **Temporary copy with rewritten references, one request** | **Chosen.** Matches `forkApplicationVersion` (`apps/chat-api/src/applications/applications.service.ts:808`), `duplicateConversation`, and Core's own review-copy model. |
| Republish after unpublish: delete the dependencies together with the application | Rejected. Changes Unpublish for every approver; too large an effect for this change. |
| Republish after unpublish: `ADD_IF_ABSENT` | Rejected. Core's approval of an application or toolset target has no `ADD_IF_ABSENT` handling (it uses the `NEW_ONLY` precondition), so an existing target would likely fail the approval; the content would also be stale. |
| **Republish after unpublish: reuse the existing target, skip its `ADD`** | **Chosen.** Independent of Core's per-type behaviour and leaves Unpublish alone. |
| Guard applications with a function, bucket copy or interceptors with a 422 | Rejected for now; recorded as known limitations. |
| Strict preparation: any failure stops the publish with a 502 | Rejected. An application that published before must still publish; any preparation failure falls back to the old path. |
| Reword the shared dependency strings for everyone | Rejected. Conversation and project panels share the keys and publish nothing with their dependencies; the application panel gets its own keys. |

## Capabilities

### New Capabilities
- `application-publish-dependencies`: publishing an application together with its first-level private dependencies in one request, via a temporary rewritten copy, including target naming, reuse of existing targets, fallback on preparation failure, cleanup and status mapping.

### Modified Capabilities
- `publish-panel-library`: the dependencies section gains a host-chosen notice variant; defaults unchanged.
- `catalog-publish-api`: publishing an application may submit dependency resources in the same Core request.

## Impact

- Code: `apps/chat-api/src/publish/` (publish service, dependency resolver, publication matching, a new temporary-copy service), `libs/publish-panel` (one optional field), `apps/chat` (new application strings and wiring of the host labels).
- API: the publish endpoint's request shape does not change; its behaviour for applications does. New response `409`. Run `npm run openapi` and `npm run openapi:check`.
- Libraries: only `libs/publish-panel` is touched. It stays host-agnostic: it receives translated text, a variant and the dependency list as props and learns nothing about copies, endpoints or Core.
- i18n: new keys `publish.dependenciesPublishedTitle`, `publish.dependenciesPublishedDescription`, `publish.dependenciesPublishedAnnouncement_one`, `publish.dependenciesPublishedAnnouncement_other` in `en.json` (the only shipped locale). Existing dependency keys are unchanged.
- State ownership: no new context. The panel already receives the list through `useCatalogPublishing`.
- Docs: `docs/architecture.md` only if its publish description names the request shape; update the description of `publish-dependencies.controller.ts`; run `npm run validate:docs`.

## Acceptance criteria

- Publishing an application that references private skills and prompts creates **one** Core publication whose resources are the application and each dependency not already published, the application resource's `targetUrl` equal to what the original would have had.
- After approval the published application's references point at the published dependencies, and a second user can call it without a 403 caused by those references (for dependencies that have no references of their own, see the known limitations).
- The original application is byte-identical before and after, for success, rejection and failure.
- No temporary copy remains after the call returns, on success or failure; a leftover from a crash is reclaimed after 3 minutes and is never shown in the public catalog.
- The original still shows its status (In review, Published), history and Unpublish access after publishing.
- Publishing the same version again after an unpublish succeeds and reuses the published dependencies.
- A failure while preparing the dependencies never stops the publish: the application is published the old way and a warning is logged.
- The application's Publish panel shows the heading "Dependencies", the plain caption and the mockup row layout; the conversation and project panels are unchanged.

## Rollback and compatibility

Not breaking for API callers: the request shape is unchanged. The new behaviour applies only to applications that have private dependencies; publishing an application without them sends the same Core request as today. Revert the change to restore the old behaviour; nothing is stored or migrated. Publications already created with dependencies stay valid in Core.

## Closest existing models

`forkApplicationVersion` (`apps/chat-api/src/applications/applications.service.ts:808`) for copy-then-edit-the-copy with cleanup; the published conversation attachments flow (`openspec/specs/conversation-published-attachments/spec.md`) for namespaced extra resources in the same request; `collectSchemaResources` (`apps/chat-api/src/publish/dependencies/schema-resource-collector.util.ts:116`) and `ApplicationDependencyResolver.resolve` (`apps/chat-api/src/publish/dependencies/application-dependency.resolver.ts:33`) for dependency discovery.

## Scope flags

- Touches one shared lib (`libs/publish-panel`) for a single optional presentation field.
- Builds on the already merged version-history work (#9856), which also matches publications by `sourceUrl`; the staging-path normalization sits in the same comparison.
- Depends on Core behaviours verified in the Core code at its `development` at the time of writing; they are noted in `design.md`.
