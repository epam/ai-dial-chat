# Design

## Context

DIAL Core's `checkSharedCopy` runs on every copy into the shared space by a caller who is not a DIAL admin and throws `No read access to {url}, which the resource refers to` when a file the schemas refer to is a folder or is not readable. It reads the source body, so a rewritten reference that still names a folder is refused too, and Core has no folder copy of its own in its public API. Core's publication-request flow does not go through that check: the approver's approval copies the application and its folder. `hasAdminAccess` in `GET /api/v1/org-units` (`adminAccess === 'FULL'` from Core's role assignments) is true only for a DIAL admin, not for a unit's `admin` role.

On the client the direct decision already has three places: the Publish panel through `getCatalogPublishDirectAvailability` in `libs/chat-hooks/src/org-units/org-unit-guards.ts` (it already falls back to a request with an information note when a dependency namespace is missing), the Save panel through `isDirectDestination` in `useResourceSavePanel`, and the orchestration in `resource-save.ts`, where a failed direct write becomes `SavedButOrgUnitWriteFailed`. `PublishDependency` already carries `isFolder`. A Save panel opened from an embedded editor, such as DIAL Loop, cannot list dependencies and shows only the general sentence. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A regular user can get a folder-reference application into a unit through the request flow, with no "Forbidden".
- Reuse the existing request rows, the information-note slots and the typed-error pattern; add no new UI element.
- A server backstop for the cases the client cannot see.

**Non-Goals:**
- Copying folders, writing the application ourselves, secrets or file relinking.
- Toolsets, prompts, skills, conversations; the #9885 DIAL Loop disabled-folder bug.

## Decisions

1. **The rule is "folder reference and not a DIAL admin".** DIAL admin is the only caller Core exempts. The client reads `hasAdminAccess` from the org-units context; the server reads the same value from the org-units service it already uses for the write-namespace check. Alternative, deciding by the unit rights, is wrong: a unit `admin` is still refused. The BFF flag is stricter than Core's own: Core treats everyone as admin when admin rules are not configured, the org-units endpoint does not, so such a deployment sends the application through the request (conservative, not wrong). The flag is cached for 60 seconds, so a freshly granted DIAL admin may be routed to a request for up to a minute.

2. **Client decision where the list is known.** `getPublishDirectAvailability` gets a `hasFolderReference` input (any listed dependency with `isFolder`) and `hasAdminAccess`, and returns a flag that the host turns into the new note; the Save hook's `isDirectDestination` takes the same two inputs. The folder stays selectable. Alternative, disabling the folder, is rejected: the request path works.

3. **Server refusal as the backstop, typed.** The planner (`application-publish-preparation.service.ts`) reports folder references from the unfiltered references; the copy service refuses with `422` and a code, before anything is copied. `422` with a code follows the attachments precedent (`conversationAttachmentMissing`); `409` is not used because nothing conflicts. The code is an enum in a response DTO with `@ApiProperty({ enum, enumName })`, as for the publish conflict codes, so the client reads it from the generated client and never as a string literal. The refusal sits right after the dependency plan, before the single-copy shortcut, so an application with only a folder reference cannot reach Core's copy. The endpoint gets the extra `@ApiResponse` and the client is regenerated.

4. **Save continues with the request on the typed code.** In `resource-save.ts` the direct-write failure branch checks the code and runs the same `publish` step as the non-direct branch, so an embedded-editor application (DIAL Loop) ends in "publish requested". Alternative, the client calling the dependencies endpoint after the first save and deciding then, adds a request and a race for no benefit over the backstop. The Publish panel has no such fallback: its dependency list comes from the server, so the refusal can reach it only when that read failed, and then it is shown as an error. A fallback there would also report "saved to folder" for a filed request.

5. **Notes use the existing slots.** The Publish panel's `directUnavailableNote` (merged by `PublishPanel` into the admin-approval callout as a continuation of its text, so one blue `Notification` shows) and the Save panel's destination note slot. Two new keys: `catalog.publish.directUnavailableFolder` and `resourceSavePanel.directUnavailableFolder`. Lib strings arrive as props; no lib change beyond the hook inputs.

## Risks / Trade-offs

- [A regular user waits for approval where a direct save would be faster] → Intended; same as for plain public folders. The user sees the note before saving when the list is known.
- [The request flow for a DIAL Loop application, with the requester also the approver, has not been run] → Not covered by a task of this change; the team checks it on dev with a regular user before release.
- [The server cannot tell the caller is a DIAL admin when the rights read fails] → The check is skipped and Core answers, as for the existing namespace check.
- [A DIAL admin's direct copy of a folder-reference app is assumed to work] → Supported by Core's code (the check is skipped) and by the dev run of a DIAL Loop application with a skill; the team re-checks it on dev before release.
- [Spec wording: `org-units-folder-permissions` also says Save writes directly for a unit the user may write to] → Checked in task 4.1; the Save sequencing requirement itself is modified here.
