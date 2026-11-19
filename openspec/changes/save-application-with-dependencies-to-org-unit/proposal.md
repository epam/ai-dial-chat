# Proposal

## Why

Saving an application into an org-unit folder the user may write to is a direct write (`POST /api/v1/catalog/applications/:entityId/copy-to-org-unit`, `apps/chat-api/src/publish/org-unit-copy.service.ts:166`): one DIAL Core `copyResource` of the application and nothing else. The copy lands in the shared space with references to the author's **private** skills, prompts, toolsets and applications, and with an `iconUrl` that still names a private file. Other members of the unit then get a 403 from DIAL Core on every private reference, so the application is saved there but does not work. Publishing an application already solves this for the publication path (`openspec/specs/application-publish-dependencies/spec.md`); the direct-write path has the same gap and has not been given the same treatment.

## Problem

- Core's plain `copyResource` of an application into `public/` relinks and copies the files a schema marks (`ApplicationService.copyApplication`), but copies references to prompts, skills, toolsets and applications verbatim, and does not touch `iconUrl`: icons are rewritten only inside Core's publication machinery (`PublicationService`), through a hook the copy endpoint does not use.
- A non-administrator's copy also drops the admin consent of declared `resource_dependencies` (`ApprovalPolicy.DROP`). This stays as the known risk already recorded in `org-units-folder-permissions`.
- Rights in an org unit are per namespace: writing a dependency into the unit needs `write` on that dependency's namespace (`applications`, `toolsets`, `prompts`, `skills`), and writing the icon file needs `write` on `files` (`OrgUnitGrants.granted` takes the namespace from the resource type). The Save panel checks only the application's own namespace today.
- The Save panel opens before the save. For a schema-form application the form values are in the host and can be inspected; for an application with an embedded editor (for example a Quick App) the current values exist only inside the iframe, so the panel cannot know what it will reference until the save has run.

## Solution

When an application is saved into an org-unit folder by a direct write, chat-api copies it **together with its first-level private dependencies and its icon**, reusing what publishing already does.

1. **One preparation, two executors.** `ApplicationPublishPreparationService.prepare` (`apps/chat-api/src/publish/application-publish-preparation.service.ts:114`) already resolves the first-level dependencies of the caller's own bucket, computes their targets in the `.{app}.deps` namespace that is a sibling of the application, skips targets that already exist, and builds a temporary copy of the application whose references point at those targets. The direct write uses the same plan and executes it with Core `copyResource` instead of `createPublication`: icon file, then each dependency still to copy, then the temporary copy to the application's own target, then cleanup of the temporary copy. The endpoint's request and response do not change.
2. **Failures stop the write.** If preparing or copying the dependencies fails, the direct write fails with the error; it never leaves a working-looking application with private references. A retry after a partial failure completes the job, because targets that already exist are reused.
3. **Icon rule.** The icon is copied when the user may write `files` in the folder; otherwise the application is still written and the staging copy carries no icon reference, so the shared copy shows the default icon instead of a broken image. The panel shows a non-blocking notice when it already knows this.
4. **Rights are checked before anything is written.** After the save has run and the real dependencies are known, chat-api checks the user's `write` on the namespace of every dependency it is about to copy and answers 403 naming the missing types before the first copy. In the panel the same check runs on the dependencies it knows (stale for an embedded editor), as a hint that disables the folder with a typed reason, as it does today for the application's own namespace.
5. **Save panel section.** For a schema-form application the panel lists the dependencies of the current form values (the list and its endpoint are already in this branch from issue 9790), worded as dependencies saved or published together with the application. For an application with an embedded editor the panel shows one neutral sentence and no list. The section follows the Organization destination, as the list already does.

## What Changes

- chat-api: `OrgUnitCopyService.copyIntoOrgUnit` gains an application path that prepares, checks rights, and executes the plan with `copyResource`; other entity types are unchanged.
- chat-api: the preparation also builds the staging copy when the application has an icon but no dependencies, and rewrites `iconUrl` in it.
- chat-api: files become a resource type the transfer helper can copy (`apps/chat-api/src/common/utils/dial-resource-transfer.ts`).
- apps/chat, libs/chat-hooks: the Save panel's rights guard also considers the namespaces of the dependencies and of `files` for the icon; new typed reasons; the schema-form dependency list uses the "published together" wording; the embedded-editor sentence and the icon notice.
- libs/publish-panel: the Save panel gets one optional note for the dependencies section; defaults unchanged.
- Specs: new capability for the direct write with dependencies; deltas for the copy endpoint, the unit rights, the Save panel and the publish panel library.

## Non-goals

- Dependencies of dependencies. Only the first level, as in publishing.
- The Publish panel writing directly into an org unit. Only the Save panel is in scope.
- Entity types without dependencies (toolset, prompt, skill) and conversations. Their direct write is unchanged.
- Icons and non-file links of the dependencies themselves.
- Rewriting `resource_dependencies` of an application, and restoring the admin consent Core drops on a non-administrator's copy.
- Showing the real dependency list for an application with an embedded editor.
- Any change to DIAL Core (read-only, API-first).

## Known limitations (documented, not guarded)

- A dependency that is an application with private references of its own is copied as it is, so calls to it fail for other users (as in publishing).
- Several copies are not atomic. A failure in the middle can leave dependencies copied under `.{app}.deps` while the application is not; a retry reuses them.
- An existing target is reused, not refreshed: a dependency changed since an earlier copy is not updated for the same application version.
- For an embedded editor the panel's dependency sentence is generic and its rights hint cannot know the future dependencies; the authoritative check runs after the save, so a refused write leaves the user's edits saved in their own bucket and nothing in the unit.
- Applications with interceptors may be refused by Core for a non-administrator; applications with a function get a new function id; a schema that enables a bucket copy leaves an orphaned bucket (as recorded for publishing).

## Alternatives considered

| Option | Verdict |
|---|---|
| Copy only the application, as today | Rejected. The shared copy is broken for everyone but its author. |
| Block the folder, or fall back to a publication request, when the application has dependencies | Rejected. The unit writer expects a save, and a publication request is not a save. |
| Copy dependencies with a new mechanism of their own | Rejected. Publishing already defines the namespace, the reuse rule and the rewrite; a second pattern would drift. |
| **Reuse the publish preparation, execute it with `copyResource`** | **Chosen.** One plan, two executors; if Core later offers its own dependency-aware copy, only the preparation changes. |
| Strict icon rule: block the folder without `write` on `files` | Rejected. A missing icon is cosmetic; a missing dependency breaks the application. |
| Show the list from Core for an embedded editor with a "last saved" label | Rejected. It shows data that may be wrong and needs an explanation the user does not care about. |
| **Neutral sentence for an embedded editor, real list for a schema-form** | **Chosen.** No wrong data; the list appears for other kinds as soon as their form state can be read. |
| Check rights only in the panel | Rejected. For an embedded editor the panel's list is stale; the check must also run after the save and before the first write. |

## Capabilities

### New Capabilities
- `org-unit-application-dependencies`: saving an application into an org-unit folder together with its first-level private dependencies and its icon, including ordering, reuse of existing targets, failure and partial-failure behaviour, and the rights check before the first write.

### Modified Capabilities
- `org-units-api`: the copy-to-org-unit endpoint's behaviour for applications.
- `org-units-folder-permissions`: the direct-save rule also requires `write` on the namespaces of the dependencies the write will copy, and the known-risk text.
- `resource-save-panel`: the dependencies section, the embedded-editor sentence and the icon notice; the "no Dependencies section" requirement is replaced.
- `catalog-publish-flow`: the Save panel's list wording follows the "published together" variant.
- `publish-panel-library`: `SaveToFolderPanel` accepts the dependency note.

## Impact

- Code: `apps/chat-api/src/publish/` (org-unit copy, preparation, target helpers), `apps/chat-api/src/common/utils/dial-resource-transfer.ts`, `libs/chat-hooks` (`useResourceSavePanel`, org-unit guards), `libs/publish-panel` (one optional prop), `apps/chat` (container wiring, labels, reasons).
- API: the copy endpoint keeps its shape; applications gain new behaviour and a `403` naming missing namespaces, `409` for an existing target as before. Run `npm run openapi` and `npm run openapi:check`.
- Libraries: `libs/chat-hooks` stays host-agnostic (it receives the dependency list and the rights callbacks); `libs/publish-panel` receives a translated sentence and a list as props and learns nothing about Core.
- i18n: new keys for the embedded-editor sentence, the icon notice and the typed reasons for dependency namespaces and `files`, in `en.json` and the matching enums.
- State ownership: no new context.
- Docs: `docs/architecture.md` if its publish section names the direct write; the READMEs of `libs/chat-hooks` and `libs/publish-panel`; `npm run validate:docs` and `npm run validate:specs`.

## Acceptance criteria

- Saving a schema-form application with private prompts and skills into a unit folder the user may write to creates the application and each missing dependency under `.{app}.deps` in that folder, and the application's references point at them; a second member of the unit can call it without a 403 caused by those references.
- The user's original application is unchanged by the write; no temporary copy remains after the call, on success or failure.
- Without `write` on a needed dependency namespace the write answers 403 naming the types and nothing is copied; the panel disables the folder with a typed reason when it already knows.
- Without `write` on `files`, the application is written without a broken icon and the panel shows the notice when it can.
- A failure in the middle reports the error; saving again completes the copy and reuses what already exists.
- An application with an embedded editor shows the neutral sentence and no list; a schema-form application shows the list for its current form values.
- Toolsets, prompts, skills and applications without dependencies or icon behave exactly as before.

## Rollback and compatibility

Not breaking: the endpoint's request and response are unchanged. The new behaviour applies only to applications with first-level private dependencies or an own icon written into a unit. Reverting restores the single `copyResource`; copies already written stay valid in Core and are not migrated.

## Closest existing models

`ApplicationPublishPreparationService.prepare` (`apps/chat-api/src/publish/application-publish-preparation.service.ts:114`) for the plan; `ApplicationPublishCopyService.create` (`apps/chat-api/src/publish/application-publish-copy.service.ts:71`) for the temporary copy; `getPublishedIconTargetUrl` (`apps/chat-api/src/publish/publish-target.util.ts:158`) and `getPublishedDependencyTargetUrl` (`apps/chat-api/src/publish/publish-target.util.ts:275`) for target paths; `runResourceSave` (`libs/chat-hooks/src/catalog/resource-save.ts:123`) for the save sequence and the partial outcome.

## Scope flags

- Builds on the open publish-with-dependencies change; the preparation it introduces is the base here and will follow its review.
- Touches `libs/chat-hooks` and `libs/publish-panel`; both stay host-agnostic.
- Carries one slice already implemented in this branch: the Save panel's dependency list for schema-form applications and its endpoint (issue 9790).
- Depends on Core behaviours verified by reading Core's `development` code (the copy relinks schema files but not `iconUrl`; rights are checked per resource type); nothing was run end to end against a live Core.
