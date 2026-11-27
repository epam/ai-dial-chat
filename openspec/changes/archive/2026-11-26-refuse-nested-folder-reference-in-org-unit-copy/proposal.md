# Refuse a nested folder reference in an org-unit copy

## Why

A Quick App that uses a DIAL Loop application, saved into an org-unit folder by a regular user, ends in "saved, but could not be written: Forbidden". DIAL Loop refers to a folder of files; DIAL Core refuses the copy of that dependency into the shared space with `403 No read access to files/{bucket}/{name}__{version}/, which the resource refers to`, because Core allows a non-DIAL-admin to copy a resource only when none of its files is a folder. The guard of `route-folder-reference-apps-to-request` looks only at the saved application's own references, so a folder one level deeper is found late, when the dependency is copied.

## What Changes

- `copy-to-org-unit` reads the schema references of each application dependency it is about to copy. For a caller who is not a DIAL admin, a folder found there is refused with the existing `422` `folderReferenceNeedsRequest`, before anything is written.
- The Save panel already continues with a publication request on that code, so the same Save ends with "publish requested" instead of the red failure.
- No client, DTO, enum or OpenAPI schema change. Only descriptions of the endpoint change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `org-unit-application-dependencies`: a dependency's own references are read to detect a folder; a folder refuses the direct write for a non-DIAL-admin (new requirement and a changed sentence in the dependency-copy requirement).
- `org-units-api`: the copy endpoint's `422` refusal also covers a dependency that refers to a folder.

## Impact

`apps/chat-api/src/publish` (`org-unit-copy.service.ts`, controller descriptions) and its spec. One extra Core read (and a cached schema read) per application dependency to be copied, on this endpoint only. Applications only.

## Non-goals

No copy or rewrite of anything deeper. No note before Save and no change to the Publish panel (its dependency list does not show nested references, so it can show the refusal as an error; a warning needs Core to return the full tree). No logging change, no unreadable-file detection, no deeper nesting, no #9885.
