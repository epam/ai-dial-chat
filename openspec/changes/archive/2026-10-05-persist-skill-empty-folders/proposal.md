## Why

A folder created through **Create folder** in the Skill Editor disappears after Save and re-open if it is still empty. QA found this while verifying [#8922](https://github.com/epam/ai-dial-chat/issues/8922). Users expect a folder they created and saved to still be there. Today it is lost silently, with no warning before Save.

The behaviour is intentional at the moment (`skill-file-tree-actions` → "Empty folders are editor-only"), but it is the only folder surface in the product that behaves this way. The DIAL file manager, conversations, prompts and toolsets already keep empty folders with the zero-byte `.dial_folder` marker convention.

## Problem

DIAL blob storage has no directory objects: a folder exists only as the path prefix of a file. The skill save contract (`filePaths` + blobs → `uploadSkillFolder`) can only describe files. The empty folder is lost in three places:

- **Save**: `buildSkillFilesPayload` keeps only `SkillFileNodeKind.File` nodes (`libs/chat-hooks/src/skill/skill.ts:316`).
- **Load**: `useSkillEditorLoad` rebuilds the tree only from file paths (`libs/chat-hooks/src/skill/useSkillEditorLoad.ts:279`). `unpackSkillArchive` skips directory entries (`skill.ts:264`), and the listing fallback keeps only `nodeType === 'item'` (`useSkillEditorLoad.ts:140`).
- **Details panel**: nothing ever wrote a folder, so there was nothing to show.

## Solution

Reuse the existing `.dial_folder` marker convention:

- `HIDDEN_FILE` in `libs/chat-shared/src/constants/dial.ts:2`.
- `MARKER_NAME` in `apps/chat-api/src/files/files.constants.ts:5`.
- The file manager's `FOLDER_PLACEHOLDER_FILE_NAME` in `use-folder-creation.tsx`.

## What Changes

- **Save**: `buildSkillFilesPayload` emits one zero-byte `<folder>/.dial_folder` entry for every folder node that has no descendant node. Markers are generated only at save time and never live in editor state.
- **Load (ZIP and listing fallback)**: a `<folder>/.dial_folder` entry is turned back into a `SkillFileNodeKind.Folder` node. It is not added to the in-memory content map and is not downloaded on the listing path.
- **Details panel**: `buildSkillContentTree` treats a `.dial_folder` item as "this folder exists" (creating the folder chain), never as a file node. It therefore never appears in the tree, the "N files" count, or the preview.
- **BFF path rules** (`POST`/`PUT /api/v1/skills`): a `filePaths` entry whose final segment is `.dial_folder` is accepted only when its received body is zero bytes. A `.dial_folder` segment anywhere else, or a non-empty marker, is rejected with `400`. The existing hyphenated `.dial-resource` / `.dial-folder` reservations stay as they are.
- **Client path rules**: `isValidSkillRelativePath` reserves `.dial_folder` for user-entered names (uploads, folder names). The editor's archive expansion skips `.dial_folder` entries the same way it skips `.DS_Store`.
- **Spec and docs**: replace the "Empty folders are editor-only" requirement, and the `libs/skill-editor` README sentence "the host decides whether an empty folder survives a save".

## Non-goals

- Reconstructing empty folders from a user-uploaded ZIP inside the editor (Upload archive). Its markers are skipped, not converted.
- Changing BFF whole-skill archive import (`skill-archive-import`) or archive download. Markers in a downloaded ZIP are a Core storage artefact and are left as-is.
- Excluding markers from the BFF file-count limit. They are real Core objects and Core counts them.
- New endpoints, OpenAPI changes, UI, strings, or feature flags.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **Baseline**: keep editor-only and warn before Save that empty folders are dropped | Rejected. It is the cheapest option, but it keeps the product inconsistent with every other folder surface and still loses the user's structure. |
| **`.dial_folder` marker** (picked) | Matches the existing convention end to end. Hidden-marker filtering already exists for other domains. Rollback is a plain revert. |
| A different marker name (`.keep`, `.gitkeep`) | Rejected. It would introduce a second convention. This is the fallback only if Core refuses `.dial_folder` inside a skill package (see design Open Questions). |
| Store a folder list in `SKILL.md` frontmatter | Rejected. It pollutes a user-authored, agent-consumed manifest, and the folders still would not exist in Core listings. |

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `skill-file-tree-actions`: "Empty folders are editor-only" is replaced by a requirement that an empty folder survives Save through a marker.
- `skill-editing`: load restores folder nodes from markers. The "no server-side folder entities exist" clause changes.
- `skills-multipart-processing`: the path-reservation rule gains the zero-byte `.dial_folder` final-segment exception.
- `skill-details-panel`: adds a requirement that folder markers are hidden from the Content tab tree and its count.

## Impact

- **Code**:
  - `libs/chat-hooks/src/skill/skill.ts` (payload, unpack, client validator, marker helpers)
  - `libs/chat-hooks/src/skill/useSkillEditorLoad.ts`
  - `libs/chat-hooks/src/skill/useSkillFileActions.ts` (archive expansion skip)
  - `libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts` (`buildSkillContentTree`)
  - `apps/chat-api/src/skills/utils/skill-path.util.ts`
  - `apps/chat-api/src/skills/package/skills-package.service.ts`
- **Shared libs (scope note)**:
  - `libs/chat-hooks` changes stay inside the second and fourth library-isolation exceptions. The marker is a DIAL Core storage shape taken from `@epam/ai-dial-chat-shared`'s `HIDDEN_FILE`, not host knowledge. No client is constructed and no app context is read.
  - `libs/skill-editor` changes only its README. It keeps treating folders as plain nodes and never learns the marker name.
- **API**: no new endpoint or DTO, so `openapi.json` is unchanged. Validation on the existing `createSkill` / `updateSkill` is relaxed for one exact shape.
- **i18n / RTL / a11y**: no new user-visible strings, no UI changes.
- **Docs**: `libs/skill-editor/README.md`. `docs/architecture.md` is not affected.

## Acceptance criteria

- Create folder `docs` (left empty), Save, re-open: `docs` is in the editor tree and in the details panel Content tab. The "N files" count does not include the marker.
- Adding a file to `docs` and saving leaves no `docs/.dial_folder` in the saved skill. Deleting the empty `docs` and saving removes it.
- A user-uploaded file or a typed folder named `.dial_folder` is rejected client-side. A non-empty `.dial_folder` part is rejected by the BFF with `400`.
- All new unit and supertest tests pass, and `npm run verify:full` is green.

## Rollback / compatibility

The change is not breaking. Skills saved before it have no markers and load exactly as today. If it is reverted, skills saved with markers still load: the old loader shows each marker as a visible zero-byte `.dial_folder` file. Nothing is lost and the user can delete it.
