# Design

## Context

`OrgUnitCopyService.copyApplication` builds a plan (`plan(..., isStrict)`), refuses when `plan.hasFolderReference` and the caller is not a DIAL admin, then checks rights, copies the icon, stages and copies each `plan.toCopy` dependency through Core. `plan.toCopy` already leaves out dependencies of other buckets, `file` dependencies and dependencies whose target exists. Core's `checkSharedCopy` rejects a copy of any resource that refers to a folder, so the failure arrives at the dependency's copy, after the plan, the target check and possibly the icon. See proposal.md for motivation, and `route-folder-reference-apps-to-request` for the own-reference guard; this change builds on it and must be archived after it.

## Goals / Non-Goals

**Goals:**
- Refuse before any write when a copied application dependency refers to a folder, with the existing typed error.

**Non-Goals:**
- Traversing or copying deeper levels, a pre-save warning, Publish panel changes, detection of unreadable files.

## Decisions

1. **Read only `plan.toCopy` entries of type application.** Only an application has references, and the dependency service returns none for other kinds. A reused or foreign-bucket dependency is not copied, so Core never evaluates it. Alternative, reading every listed dependency, adds reads and refusals for resources that would not be copied.
2. **`getDependenciesStrict`, in parallel.** A failed read is thrown, not read as "no folder". The resolver throws a plain `Error` without Core's status, so `handleDialFetchError` answers `503` whatever Core said, as it already does for the strict `plan` read. Alternative, wrapping the failure into a status-mapped exception, is not worth a new error path here. Alternative, the lenient variant, would let Core's late 403 return silently.
3. **One small method on `ApplicationPublishPreparationService`, one `isDialAdmin` call.** The preparation service already holds `PublishDependenciesService`, so `OrgUnitCopyService`'s constructor and test fixtures stay as they are. The admin flag is read once and shared with the existing own-reference check, and only when there is something to refuse (own folder reference or an application in `toCopy`). A DIAL admin and a call with nothing to copy make no nested read. The helper is isolated so it can be replaced by a check on the full tree if Core returns one.
4. **Placement.** Right after the own-reference check, before `findMissingWriteNamespaces`, the icon copy and `stage`. A non-admin whose target name is taken, or who lacks a namespace right, therefore gets the `422` instead of `409`/`403`, as with the own-reference refusal; the request flow is where such a user goes anyway.
5. **Same error.** `createFolderReferenceNeedsRequest()`: same `422`, code and message; the client needs no change.

## Risks / Trade-offs

- [Publish panel shows the refusal as an error for this case] → Its list cannot see nested references. Known limit; a fix needs nested info in the dependencies DTO from Core's full tree.
- [The Publish panel's direct write maps `422` as a generic error] → Checked in the tests of task 1; no change planned.
- [One more Core read per application dependency] → Only on this endpoint and only for a non-admin.
- [Archive order] → The `org-units-api` delta repeats the earlier change's text of the same requirement; archive the earlier change first.
