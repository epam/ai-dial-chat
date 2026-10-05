## MODIFIED Requirements

### Requirement: Frontmatter and supporting files are unpacked and preserved for editing
On successful load, the page SHALL unpack the downloaded ZIP with `fflate`, parse the root `SKILL.md`'s YAML frontmatter with the `yaml` package's `parse` function keeping the entire parsed object (not just `name`/`description`), and load every other entry into an in-memory `Map<relativePath, Uint8Array>`. The file tree presented to `libs/skill-editor` SHALL be built from these real file paths, any parent folders inferred from those paths, and one `SkillFileNodeKind.Folder` node per folder marker.

A folder marker is an entry whose final path segment is `.dial_folder` (`HIDDEN_FILE` from `@epam/ai-dial-chat-shared`). `unpackSkillArchive` SHALL return markers separately from `files`, as a list of folder paths (the marker path without `/.dial_folder`). Markers SHALL NOT enter the content map or the file nodes. A root-level `.dial_folder` entry (no folder before it) stands for no folder and SHALL be dropped entirely, so it cannot become a file that the server would then refuse on save. The same rule SHALL apply on the listing fallback (`loadSkillFiles`): a `nodeType: 'item'` entry that resolves to a marker path SHALL become a folder path and SHALL NOT be downloaded. `useSkillEditorLoad` SHALL set `files` to the file nodes followed by a folder node for each marker folder path that is not already a file path. Its parent folders are still inferred by `buildDialFileTree`.

#### Scenario: Unknown frontmatter field is retained after load
- **WHEN** the loaded `SKILL.md` has a `version: "1.2.0"` field the form never renders
- **THEN** the page's in-memory frontmatter object still has `version: "1.2.0"` after load, ready to be re-serialized unchanged on save

#### Scenario: Supporting files load byte-for-byte
- **WHEN** the archive contains a binary `assets/logo.png` entry
- **THEN** the in-memory map holds that entry's exact decompressed bytes, unmodified

#### Scenario: File tree infers folders from paths
- **WHEN** the archive contains `agents/analyzer.md` and no separate folder marker for `agents`
- **THEN** the presented file tree shows an `agents` folder node containing `analyzer.md`, derived purely from the file's path

#### Scenario: A folder marker restores an empty folder from the ZIP
- **WHEN** the archive contains `SKILL.md` and `docs/.dial_folder`
- **THEN** `files` contains one `SkillFileNodeKind.Folder` node `docs`, no node named `.dial_folder`, and the content map has no `docs/.dial_folder` key

#### Scenario: A folder marker restores an empty folder from the listing fallback
- **WHEN** the ZIP route fails, and the listing returns the manifest plus an item resolving to `docs/.dial_folder`
- **THEN** `files` contains a folder node `docs`, and `downloadSkillFile` is called only for `SKILL.md`

#### Scenario: Reloading a saved empty folder is clean
- **WHEN** a skill with an empty `docs` folder is loaded and then saved without edits
- **THEN** the form is not dirty after load, and the save payload contains `docs/.dial_folder` again
