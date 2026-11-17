# Design

## Context

Motivation and scope are in `proposal.md`; requirements are in the delta specs. What the design has to respect:

- **What a publication request is.** DIAL Core's `Publication.Resource` carries `sourceUrl`, `targetUrl`, `reviewUrl`, `action` (`ADD`, `DELETE`, `ADD_IF_ABSENT`) and `publishCredentials`, never content. `createPublication` validates read access on each source, copies every source into a review bucket synchronously (`copySourceToReviewResources`), stores the request, and returns. Approval copies review to public (`copyReviewToTargetResources`, reading `reviewUrl`); rejection deletes the review copies. The source is not read again, except by `updatePublication` of a PENDING publication, which chat-api never calls. One request may mix resource types and is decided as a whole. An `ADD` whose target exists is refused at creation (`Target resource already exists`).
- **What Core relinks.** Only `FILE` resources of the same request, plus `iconUrl` of an application or toolset, attachments of a conversation, and any FILE-typed value a schema marks `dial:file` or `dial:resource`. References to prompts, skills, toolsets and applications in `application_properties` are copied verbatim. At call time Core skips public references and requires the **caller's** read access to every non-public one (403 otherwise).
- **What the author can touch.** The review copy is `READ_ONLY` for the author; the public copy is writable by approvers only. So references have to be correct in the source named by the request.
- **Existing code.** `PublishService.publish` (`apps/chat-api/src/publish/publish.service.ts`) builds one request for the entity and its icon. `ApplicationDependencyResolver.resolve` already throws on failure and `PublishDependenciesService.getDependencies` absorbs the error for the read-only endpoint. `collectSchemaResources` walks the schema next to the value but only reads. `ApplicationsService.forkApplicationVersion` copies an application with Core `copyResource`, then GETs and PUTs the copy, deleting it on failure. Publications are matched to a source by `isSameResourceUrl` in `apps/chat-api/src/publish/publication.util.ts`. Unpublish sends one `DELETE` for the application's own published target.
- **Who sees published resources.** Public resources are visible by folder rules, which Core evaluates from the resource's folder up through its parents (`RuleService.evaluate`), and at call time Core skips public references without an access check (`BaseRequestFunction`). So a dependency stored in a folder below the application's publication folder inherits that folder's rules, and a published application that points at public dependencies produces no 403 for them.
- **Authorization.** Unchanged: any authenticated session; every Core call uses the caller's bearer token, so Core's own checks (read on sources, write on the target folder, write on a toolset when credentials are published) remain the authority.

## Goals / Non-Goals

**Goals:**
- One request, one approval, a published application that works for others.
- The author's original is never written.
- Existing status, history and unpublish keep working with no change to their output.
- Republishing the same version after an unpublish keeps working.

**Non-Goals:**
- A generic "publish any entity with dependencies" engine. The new code is application-specific and sits beside `PublishService`.
- Fixing dependencies' own non-file links (a dependency toolset's icon in the author's bucket stays private).
- Changing the read-only `GET .../publish-dependencies` contract.
- Changing Unpublish.

## Decisions

### D1. Rewrite references on a temporary copy, not on the original

The source named in the request is a copy of the application in the author's own bucket with its references rewritten to the dependencies' target URLs. It exists from before `createPublication` until that call returns, then is deleted in a `finally`.

Why: the copy is the only place both writable by the author and read by Core at the right moment. Core makes review copies during the call and never reads the source again, so the copy can be deleted at once.

Alternatives considered:
- *Rewrite the original.* Rejected: a rejection or failure leaves the author's application broken.
- *Swap the body of the original around the call, then restore.* Rejected: no precedent for a temporary mutation of an original in this repository; `commitApplicationVersion` is a persistent exchange between two real versions made because the embedded editor writes to the source path. A crash in the window leaves a broken original, and a safe version needs a snapshot, which is the copy again. A concurrent save by the author during the window either fails the restore (`If-Match`) or is overwritten. Its one advantage, no `sourceUrl` mapping, is outweighed.
- *Rewrite when reading (as published conversation attachments).* Rejected: Core checks the stored references at call time; reads through chat-api are never on that path.
- *Edit the review or public copy.* Rejected: read-only for the author / approver-only.
- *Several requests, one per dependency.* Rejected: several approvals, and the application could become public before its dependencies.

Precedents for the chosen side: `forkApplicationVersion` (copy, then GET and PUT the copy, delete it on failure), `duplicateConversation` (reads a conversation, replaces private links, saves a new resource), and Core's own review-copy design (it edits only copies). There is no precedent in the repository of a Core resource created and deleted inside one request; cleanup of one's own half-made copy exists in `forkApplicationVersion`.

### D2. One request, dependencies as extra `ADD` resources

Dependencies go into the same `resources[]` as the application. Their `targetUrl`s are computed before the request, so the rewritten references name public paths that exist only once the request is approved; because the request is decided as a whole, they exist at the moment the published application does.

### D3. Per-application namespace, a sibling of the application

`{type}/public/{folderPath}/.{applicationResourceName}.deps/{sourceBucket}/{relative path}`, one shared function. It follows `conversation-published-attachments` (a namespace per published entity, the source bucket as its own segment) with one deliberate difference: the namespace is a **sibling** of the application, not nested under its name. Reason, found in review: a dependency that is itself an application would land at `applications/.../Helper__1.0.0/{bucket}/X__1`, a path below the published application's own leaf `Helper__1.0.0` in the same resource group, which is a file and a folder with one name. Conversation attachments never had this problem because attachments are `files/` and the parent is `conversations/`. Core itself keeps an application's files in a sibling dot folder (`.{appName}/`); `.{appName}.deps` is a different name from that one.

Cost: a prompt used by two applications is published twice, once per namespace. Accepted: it is collision-free; sharing across applications is a follow-up.

Checked in Core's code: a leading-dot folder segment is valid (`ResourceDescriptorFactory.isValidResourcePath` rejects only names that end with a dot), the review paths of an application and of a dependency application in the sibling folder differ, and the sibling folder inherits the publication folder's rules, so the audience of the application can read its dependencies. Not run against a live Core. Evidence (task 1.1), read in the Core checkout at `development` `ff115c10`, all under `server/src/main/java/com/epam/aidial/core/server/`:
- `util/ResourceDescriptorFactory.java`: `isValidResourcePath` rejects only a name or parent folder ending with `.`; `isValidFilename` rejects only empty, `.` and `..`. `.publish-staging` and `.Helper__1.0.0.deps` pass.
- `service/PublicationService.java` `validateResourceForAddition`: the review URL is `{type}/{reviewBucket}/{target path minus targetFolder}`, so `Helper__1.0.0` and `.Helper__1.0.0.deps/bucket/Calculator__1.0.0` differ; `Target resource already exists` for an `ADD` onto an existing target; source and target URLs and review URLs must each be unique within one request.
- `service/ResourceOperationService.java` + `controller/ResourceOperationController.java`: a non-overwriting copy onto an existing destination throws `IllegalArgumentException`, answered `400`; the copy needs read and (for applications and toolsets) write access on the source and write on the destination, all true in the author's own bucket.
- `service/RuleService.java` `evaluate`: rules are evaluated recursively over `resource.getParent()`, so a folder below the publication folder inherits its rules.
- `service/OrgUnitService.java` / `OrgUnitLookup.java` `requireNoUnitFolder`: refuses a target that is an org unit's own folder (`409`); the sibling `.{app}.deps` folder is not a unit folder.
- Fixtures and a schema-validating contract test: `apps/chat-api/src/publish/tests/dependencies/fixtures/` and `core-publication-contract.spec.ts`, built by hand from `docs/open_api_core.yaml` (`Publication`, `PublicationResource`) and the request shapes of `PublicationApiTest.java`. No claim failed, so D3, D6, D7 and the spec scenarios are unchanged.

### D4. A failure preparing the dependencies falls back to the old publish

Everything between "the user pressed Publish" and "the temporary copy exists" is preparation: reading the application and its schema, resolving its references, looking up whether each dependency target exists, creating and writing the copy. If any step fails, `PublishService` logs a warning (message only, no token), `ApplicationPublishPreparationService.prepare` has already deleted any copy it made, and the application is published exactly as before, without dependencies. The one failure that is not absorbed is "the same application is already being published" (`409`, its own `ApplicationBeingPublishedException`, so that a conflict while saving the copy is not mistaken for it), because falling back would turn a double click into two different requests.

Alternatives considered:
- *Strict (an earlier draft): any preparation error is a 502 and nothing is published.* Rejected by the user: an application that used to publish must not stop publishing because a read hiccuped or because DIAL Core refuses to copy it (interceptors). Silent degradation is no worse than today, where the panel only warns.
- *Middle: lenient on reads, strict on the copy.* Rejected: the same reasoning applies to a refused copy.

The resolver's existing best-effort `getDependencies` is used; no strict variant exists. The existence check of a dependency target is tri-state (`resourceExists`: 200 exists, 404 absent, anything else throws), so a transient failure is never read as "absent": it ends in the fallback instead of in a request Core refuses with "Target resource already exists". The repository's published-attachments flow takes the same stance ("only a definite answer; any other failure is not treated as not found"). An application in another bucket skips the dependency path before any read.

### D5. A write-back counterpart to `collectSchemaResources`

`collectSchemaResources` and a new `replaceSchemaResources` share one walk (refactored into a visitor), so the values read and the values replaced cannot drift. The walk also follows `allOf` and `additionalProperties`. Matching is on the percent-decoded value; a raw value may carry `?query`, `#fragment` or a legacy `metadata/` prefix that the resolver's `id` has stripped, so matching is done on the normalized raw value, not on `id` as it is. The replacement is written in the same percent-encoded form as the `targetUrl` Core receives. This matters because Core parses references with `fromAnyUrl` and swallows an `IllegalArgumentException` as "defined in DIAL config", so a malformed rewrite would silently drop a dependency instead of failing. The function returns a new value and never mutates its input, and lives under `apps/chat-api/src/publish/dependencies/`.

A dependency of type `file` is neither added nor rewritten: Core copies and rewrites any FILE-typed schema value itself.

### D6. Creating the copy

A new service in `apps/chat-api/src/publish/` (not in `ApplicationsService`, which is already large) drives it, reusing `transferDialResource` (`copyResource`, `overwrite: false`) and the application read/write helpers `ApplicationsService` exposes. Steps: resolve own application (`resolveOwnApplication`), copy to the staging path, read the copy with its ETag, write the rewritten body with `If-Match`, clear `applications:list:{userSub}` through `invalidateAfterWrite`. Secrets of external services are handled by Core's copy and by the same GET/PUT path `forkApplicationVersion` and `commitApplicationVersion` already use; chat-api reads and logs no secret.

The staging path is `{original folder}/.publish-staging/{original leaf}` in the author's bucket. It is deterministic so that one application has one copy in flight. Core answers `400` to a copy onto an existing target, which `transferDialResource` maps to `409`; a `412` from the `If-Match` write is mapped to `409` by `writeApplication`, so the "already publishing" `409` gets its own message to stay distinguishable. A leftover copy (a crash between create and delete) is reclaimed when it was last modified more than 3 minutes ago; the age comes from a metadata read of the copy, which `transferDialResource` does not provide, so the service adds one. A publish takes about a second; three minutes is far longer than the Core call lasts and short enough that a crash never blocks an application for long. The icon, target names and version are derived from the **original's** id, with only the application resource's `sourceUrl` swapped for the copy.

The copy keeps the original's `reference` (Core's copy passes a no-op consumer); Core regenerates it in the review copy. Nothing reads the copy's `reference`.

### D7. Mapping the staging path back to the original

`isSameResourceUrl` normalizes the **source side only**, removing a `/.publish-staging/` segment before comparing. It is also called with target URLs (`publication.util.ts`), and normalizing there would mis-map a real folder with that name. It is the single comparison used by `publishesSource`, `getPublicationSourceAction`, `getPublicationSourceCredentials`, `getPublicationSourceTargetUrl` and, through them, `resolveVersionStatus` and the history and unpublish-access paths. A test asserts the output of those functions for a publication whose `sourceUrl` is a staging path equals the output for the original's URL. The merged version-history work (#9856) already builds its statuses on this matching, so the normalization applies to it too.

Side effect, accepted: dependencies are resources of the application's publication, so a private prompt, skill, toolset or application can read as In review or Published for the same folders. Not specially handled in this version.

### D8. No guard for application kinds the copy handles badly; recorded as known limitations

An early draft refused applications with a `function`, with the schema's bucket copy enabled, or with interceptors (422 `publishApplicationUnsupported`). Rejected by the user: record them as known limitations and go on, since a guard can be added later without changing anything else. What happens without a guard (a refused or failed copy ends in the fallback of D4, so the application is published the old way):

| Kind | Effect | Visible? |
|---|---|---|
| Interceptors, caller not an administrator | Core answers 403 when the copy is written (`validateInterceptors`); the copy is deleted and the application is published the old way, without dependencies | Warning in the log only |
| Schema with bucket copy enabled | Core copies a bucket keyed by the source path and deleting a personal application does not remove it, so an orphaned bucket remains | Silent |
| Application with a `function` | The copy gets a new function id | Silent |
| A dependency in another user's bucket | Not published and not rewritten, as the files of a published conversation in another user's bucket are (`conversation-published-attachments`); it stays listed in the panel, and the published application keeps pointing at it | Silent |
| A dependency that is an application with its own private references | The dependency is published with those references unchanged, so calls to it return 403 (first level only) | Silent until used |

The acceptance criterion "a second user can call it without a 403" therefore holds for dependencies that have no references of their own. The limitations are documented here, in the proposal, and in a comment on the service that collects dependencies.

### D9. Credentials

Dependencies are never submitted with `publishCredentials`. The existing flag applies to the application resource as today. It is a per-resource choice made in the panel for the entity itself (Core gates it on write access), so no choice has been made for a dependency. Consequence: a toolset dependency works for others only after each user authorizes it, which is not a 403.

### D10. Panel: separate application strings and a host-chosen variant

`libs/publish-panel` keeps its component and props and its defaults (title, warning, announcement), so panels that pass nothing are unchanged. It gains one optional field, `dependenciesLabels.appearance` (`PublishDependenciesAppearance`: `Warning` default, `Published`), reaching the panel through the existing `labels` path. `Published` follows the product mockup of the application panel exactly: the description is a plain muted caption under the heading instead of a notification, and each row is a 40px icon with 12px corners, 12px before the text, the upper-cased accent-colored type label above the name, with a thin divider between rows; its colors come from new `--pp-dependencies-*` variables and its type scale from `captionClassName` and `typeClassName` props defaulted to kit classes (`dial-tiny-text`, `dial-tiny-lead-semi-text`). The conversation and project panels already show this section (their containers call `getPublishDependenciesLabels` with `DependenciesEntityConversation` / `DependenciesEntityProject`); they stay as they are. The application panel passes new i18n keys (`publish.dependenciesPublishedTitle`, `…Description`, `…Announcement_one/_other`) and `Published`. Reason for new keys instead of rewording: the existing keys are shared with the conversation and project panels, where "published with your {{entity}}" would be false because only applications publish their dependencies. The lib does not learn about copies, namespaces or Core.

### D11. Republish after unpublish reuses what is already there

Unpublish removes the application only (`DELETE` for its own target), so the dependencies of an earlier publish remain. Publishing the same version to the same folder again would then ask Core to `ADD` targets that exist, which Core refuses (`Target resource already exists`).

Chosen: before building the request, check with the caller's token whether each dependency's `targetUrl` exists; if it does, leave it out of `resources[]` and still rewrite the reference to it.

Alternatives considered:
- *Delete the dependencies in the same request as the application when unpublishing.* Deletion would be limited to what the application's own publication created (chat-api already reads that publication to find the target; hand-published dependencies and applications published before this change are never in it), so the blast radius is smaller than it first sounds. Rejected anyway: it changes Unpublish for every approver, who would see more removals in a destructive request, and the user judged that effect too large for this change.
- *`ADD_IF_ABSENT` for dependencies.* Rejected: it works for prompts and skills, where Core's copy reports "already there", but at approval `copyApplication` and `copyToolSet` are called with `overwrite=false` (the `NEW_ONLY` precondition) and return nothing, and only the plain and complex branches handle `ADD_IF_ABSENT`; by reading the code an existing application or toolset target would make the approval fail (not run). The content would also be stale.
- *Reuse the existing target (chosen).* Independent of Core's per-type behaviour and leaves Unpublish alone. Cost, accepted: a dependency changed since it was published is not refreshed for the same application version; a new version gets a new namespace and publishes them again.

Known edge: a dependency target that exists only in another still-pending publication is not seen by the existence check, and the second approval would fail on it.

## Risks / Trade-offs

- **Leftover staging copy after a crash** → visible only to its author, never public; reclaimed by the next publish after 3 minutes, and until then that application answers `409`.
- **`isSameResourceUrl` is a central comparison** → one change affects every publication lookup. Mitigate with normalization on the source side only, and tests across history, statuses and unpublish access.
- **Rewritten references to not-yet-existing public paths** → between request creation and approval the review copy refers to public targets that do not exist yet. The review copy is not callable by others; approval creates the targets and the application together.
- **Unpublishing a dependency on its own** → the published application becomes invalid (Core reports a missing referenced resource). Unpublish is unchanged in this version; documented limitation.
- **A dependency's own non-file links** (for example the icon of a dependency toolset in the author's bucket) stay private → accepted for the first level.
- **Dot folders** (`.publish-staging`, `.{app}.deps`) → leading-dot folders have precedent (`.client_data`, `.scheduler`, Core's `.{appName}`) and Core accepts them, but catalog and file listings may show them.
- **Core behaviour is verified in Core's `development` at the time of writing** → the rewrite scope, copy-at-create timing, the `Target resource already exists` rule and the review copy being read-only are load-bearing. None of this was run end to end against a live Core; it rests on reading Core's code and tests. A contract test built by hand from Core's OpenAPI document and publication tests, and a note in `docs/`, make a change in Core noticeable. A live run on a dev environment before merge is desirable but not a precondition.
- **Fallback of D4** → in a rare failure the application is published without its dependencies and only the log says so; that is no worse than before this change.
- **Core's own record of the source** → Core stores the staging `sourceUrl` in the publication and the copy is deleted afterwards; another Core client that calls `listPublishedResources` (not chat-api or its frontend) would see that deleted path instead of the original.
- **Toolset dependencies publish without credentials** (D9) → they need per-user authorization, not a 403.
- **Each application version creates its own copies of the dependencies** → accepted (D3).
- **Dependencies show in the audience's catalog under a folder named with the author's bucket id** → accepted for this version.
- **`resource_dependencies` of an application are not rewritten** → they hold concrete URLs in the author's bucket and `required` entries answer 403 at call time; out of scope.

## Migration Plan

No data migration. Deploy backend and frontend together or backend first; the panel text change is independent. Rollback: revert the change; publications already created stay valid in Core, and any leftover staging copy is deleted by the author or ignored. Run `npm run openapi` and `npm run openapi:check` for the added responses, and `npm run validate:docs`, `npm run validate:specs`.

## Open Questions

None that change the specs, the approach or the tasks.

## Follow-ups (deferred on purpose)

- Dependencies of dependencies, and a guard or warning for a dependency application that has private references.
- Guards for applications with a `function`, bucket copy or interceptors (D8).
- A dependency already published by hand while the application still refers to the private original.
- Unpublishing the dependencies together with their application (D11), and a safeguard against unpublishing a dependency that a published application uses.
- Non-file links of dependencies, such as a dependency toolset's icon.
- Conversation publishing.
