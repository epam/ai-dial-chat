## Context

The skill editor keeps its tree as `SkillFileTreeNode[]` (`files`), owned by the app page `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` and shared by `useSkillEditorLoad`, `useSkillFileActions` and `useSkillEditorSubmit` from `@epam/ai-dial-chat-hooks`. File bytes live in `filesContentRef`. A Create folder action adds a `SkillFileNodeKind.Folder` node (`useSkillFileActions.ts:266`).

Today the folder is lost at three points:

- **Save**: `buildSkillFilesPayload` (`skill.ts:316`) filters to `SkillFileNodeKind.File`.
- **ZIP load**: `unpackSkillArchive` (`skill.ts:251`) drops directory entries.
- **Listing load**: `loadSkillFiles` (`useSkillEditorLoad.ts:118`) keeps only `nodeType === 'item'`, and `setFiles` maps every path to a File node.

The BFF (`skills-package.service.ts` `validateAndBuildFormData`) validates each path with `isValidSkillRelativePath` (`skill-path.util.ts`) and forwards one multipart part per path to Core `uploadSkillFolder`, a whole-skill replace.

Elsewhere in the product an empty folder is a zero-byte `.dial_folder` object:

- `HIDDEN_FILE` in `libs/chat-shared/src/constants/dial.ts:2`.
- `MARKER_NAME` in `apps/chat-api/src/files/files.constants.ts:5`.
- Prompts strip it in `prompts/utils/prompt-mapper.util.ts:65`.
- The file manager creates it in `ai-dial-react-file-manager` `use-folder-creation.tsx:272`.

## Goals / Non-Goals

**Goals:** an empty folder survives Save and re-open in the editor and appears in the details Content tab. The marker is never visible as a file, never user-creatable, and never stale after the folder gains content or is deleted.

**Non-Goals:** editor Upload-archive folder reconstruction; BFF archive import/download changes; excluding markers from Core's file-count limit; any UI, i18n or endpoint change.

## Decisions

### D1 — Markers are derived at save time, never stored in editor state
`buildSkillFilesPayload` computes markers from the Folder nodes it receives. A folder gets a marker only if no other node's path starts with `<path>/`, so only leaf empty folders get one. Markers are appended after the real files.

The alternative was to add a marker node on `onCreateFolder` and keep it in `files`. It was rejected because every tree action (rename, move, delete, add child) would then have to maintain the marker, and `libs/skill-editor` would have to hide it. Derivation keeps the invariant in one pure function. Because `uploadSkillFolder` replaces the whole skill, a folder that gained a file simply stops getting a marker, and the old marker is gone after the next save without any delete call.

### D2 — One marker helper module in `chat-hooks`, built on `HIDDEN_FILE`
`skill.ts` gains these pure arrow helpers:

- `SKILL_FOLDER_MARKER = HIDDEN_FILE`
- `isSkillFolderMarkerPath(path)`: final segment equals the marker and at least one segment precedes it.
- `skillFolderMarkerParent(path)`

Save, ZIP load, listing load, archive expansion and `buildSkillContentTree` all use these helpers.

Isolation: the marker describes DIAL Core storage shape and comes from the already-depended-on `@epam/ai-dial-chat-shared`, so this stays within the second isolation exception for `chat-hooks`. `libs/skill-editor`, `libs/catalog` and `libs/skills` never see the name. The BFF uses its own `MARKER_NAME`, matching the existing cross-boundary "keep in sync" comment, because apps/chat-api does not import frontend libs.

### D3 — `unpackSkillArchive` returns `folders` alongside `files`
`UnpackedSkillArchive` gains `folders: string[]`. The loader's internal `LoadedSkill` gains the same field. `useSkillEditorLoad` builds the file nodes first, then adds one Folder node per marker parent that is not already a file path. Folder nodes are seeded through the same `setFiles` call, so the editor's `seededFilesRef` dirty baseline includes them and a fresh load stays clean.

The alternative was to return the marker inside `files` and filter it in the hook. It was rejected because every caller of `unpackSkillArchive` would have to know to filter it.

### D4 — Listing fallback skips downloading markers
In `loadSkillFiles`, any item whose resolved path is a marker is moved to `folders` before the `downloadSkillFile` fan-out, which saves one request per empty folder.

### D5 — BFF accepts the marker only as a zero-byte final segment
The marker rule lives only in `SkillsPackageService.validateAndBuildFormData`, because it is the one place that has the received buffers. A path containing a `.dial_folder` segment is accepted only when:

- that segment is the final one,
- at least one segment precedes it,
- the prefix passes `isValidSkillRelativePath`, and
- `files[i].buffer.length === 0`.

Anything else throws `BadRequestException('Invalid supporting file path: …')`. The existing parity check runs first, so `files[i]` always exists.

The shared `isValidSkillRelativePath` is deliberately **left unchanged**: it reserves only the hyphenated forms, as it does today. Implementation found that reserving `.dial_folder` there would make the BFF archive import (`resolveSkillEntryPath`) reject any Core-exported skill ZIP that contains markers. That would contradict this change's non-goal of leaving archive import as it is. `uploadSkillFile`/`deleteSkillFile` therefore keep today's behaviour for that name. A regression test pins the shared validator's acceptance of `docs/.dial_folder`.

### D6 — Client validator reserves `.dial_folder`
The client mirror adds `.dial_folder` to its reserved names. User uploads (`validateBatch`) and typed folder names (`validateFolderPath`, which probes `<path>/probe`) are then rejected with the existing messages, so no new strings are needed. Generated markers bypass the validator, since the payload builder never validates. The mirror's doc comment records that the BFF additionally accepts the zero-byte final-segment form.

## Authorization

There are no new endpoints. `POST`/`PUT /api/v1/skills` keep their existing session guard and Core-side ACLs.

## Risks / Trade-offs

- **DIAL Core may reject or specially treat `.dial_folder` inside a skill package** (`uploadSkillFolder` / `ComplexResourceService`). This is the highest risk, so tasks are sliced risk-first: the BFF slice (group 1) lands first with supertest coverage, and the Core behaviour is confirmed against dev before slices 2–4. If Core refuses it, switch `SKILL_FOLDER_MARKER`/BFF constant to a neutral name (`.keep`). Only the two constants and the specs change.
- **File-count limit**: each empty folder consumes one of the 100 slots, and the editor's `validateBatch` projection does not count markers. If a user is at the limit and has empty folders, Save fails with the BFF's existing 400 count message, which the submit hook already surfaces. This is accepted: it is a rare edge, and Core enforces the same count.
- **Downloaded skill ZIP contains `.dial_folder` files**: these are visible in an OS unzip. This is accepted, because it is how Core stores folders. Re-uploading such a ZIP through the editor skips the markers (spec: Host archive expansion).
- **Revert**: after a revert, old clients show saved markers as zero-byte `.dial_folder` files. This is harmless and the user can delete them.
- **Agents consuming the skill** see an extra empty file in empty folders. It has no content impact.

## Migration Plan

No data migration is needed. Existing skills have no markers. To deploy, ship the BFF and frontend together; the order does not matter, because an old frontend never sends markers and a new frontend against an old BFF already passes the current validator, which does not reserve the underscore form. Rollback is a plain revert.

## Open Questions

- Confirm with the DIAL Core team, or on the dev stand, that `uploadSkillFolder` stores a `docs/.dial_folder` zero-byte part and that both `GET` ZIP and `listSkillFileMetadata` return it. This is needed before slice 2 merges.
