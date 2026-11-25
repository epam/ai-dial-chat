# Route folder-reference applications to a publication request

## Why

A DIAL Loop application refers to a folder of the user's files. Saving or publishing it directly into an org-unit folder fails for a regular user: DIAL Core refuses the copy with `403 No read access to files/{bucket}/{name}__{version}/, which the resource refers to`, and the chat shows a bare "Forbidden" (issue #9940, QA problem 1). Core's rule applies to every caller who is not a DIAL admin: a copy into the shared space needs `read` on every file the schema points to and none of them may be a folder, because a folder is copied with everything below it, which rules or child units may close to the caller. A DIAL admin is exempt. A unit role, even the unit's `admin` role, does not make a user a DIAL admin.

Copying the folder ourselves is not safe: the application would have to be written by a plain write, which loses what Core's copy keeps (relinking every file reference, external-service secrets) and can leave the unit copy pointing at someone else's files, which Core deletes with the application. The publication-request flow already handles the folder: Core copies it itself when an approver approves.

## What Changes

- An application that refers to a folder of files is written directly into an org-unit folder only by a DIAL admin. For everyone else the Save and Publish panels use the publication request that plain public folders already use.
- The Publish panel shows a new short sentence, saying a direct save is not possible because the application uses a folder of files, as a continuation of the text of its existing admin-approval callout (`directUnavailableNote`), so the panel shows one callout. The Save panel shows the same note in its existing destination note slot.
- Where the panel cannot see the folder reference (an application with an embedded editor, such as DIAL Loop opened in its editor), the server refuses the direct write with a typed error before copying anything, and the Save panel continues with the publication request for the saved application.
- A DIAL admin and every application without a folder reference keep today's direct write. Applications only: toolsets, prompts and skills are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `org-unit-application-dependencies`: the direct write refuses a folder-reference application for a caller who is not a DIAL admin, with a typed error.
- `resource-save-panel`: the direct-write rows are not taken for such an application; the typed refusal continues with the publication request.
- `catalog-publish-flow`: the Publish panel's direct decision includes the folder reference and shows the new note.
- `org-units-api`: the copy endpoint gains the `422` refusal and its code.
- `publish-panel-library`: the host's direct-unavailable sentence continues the text of the admin-approval callout in the same block, so the panel shows one callout.
- `org-units-folder-permissions`: the Save and Publish direct-write rules except a folder-reference application for a user who is not a DIAL admin.

## Impact

Backend: `apps/chat-api/src/publish` (dependency planning reports folder references; the copy service checks the caller's DIAL admin flag, which the org-units service already reads) and its OpenAPI error response (regenerate the client). Frontend: the shared direct-availability helpers in `libs/chat-hooks`, the Publish panel host in `CatalogView`, the Save panel hook and orchestration in `libs/chat-hooks`, and two translation keys. No endpoint, request or success-response shape change. With `features.orgUnitsEnabled` off nothing changes.

## Alternatives

- Copy the folder ourselves and write the application with a plain write: loses external-service secrets and relinking, can make unpublish delete files the unit copy does not own. Rejected after review.
- Disable the unit folder for such an application: a user with the right to request could not reach the unit at all.
- Make Core accept a readable folder: would be a Core issue and is out of scope.

## Non-goals

No file or folder copying by the chat. No change to DIAL Core. No change to the icon, the dependencies list, the publication-request flow itself, or to what a DIAL admin can do. The separate DIAL Loop folder-disabled bug in #9885 is not part of this change. Folders in the public bucket and files the caller cannot read are not detected here; DIAL Core still answers for them.

## Acceptance criteria

A regular user with `write` on applications in a unit saves a DIAL Loop application into a unit folder: the application is saved, a publication request is created, the "publish requested" notification shows and no "Forbidden" appears. The Publish panel shows the new note for such a folder and files a request. A DIAL admin still writes directly. An application without a folder reference by a regular user with `write` still writes directly. A direct write request sent anyway by a non-admin for a folder-reference application gets the typed refusal and writes nothing.
