## Why

### Problem

The Create/Edit skill form's Files pane ([issue #8923](https://github.com/epam/ai-dial-chat/issues/8923)) already renders `DialFoldersTree`, but its only add control is a single "Upload from device" button (`libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:375`) and every node's context menu holds exactly one item, Remove (`SkillEditor.tsx:347`). A user cannot create a folder, bring in a `.zip` of skill resources, reuse files already stored in DIAL, or add anything next to / inside an existing node — a nested path only appears if an uploaded file already carries it. The design calls for an **Add** dropdown and **Add child / Add sibling / Delete** node actions.

## What Changes

### Solution

- **Add dropdown** in the Files pane header (ui-kit `ButtonDropdown`, already used by `libs/catalog/src/components/Catalog/CreateButton.tsx:48`) with four entries: **Create folder**, **Upload files from device**, **Upload archive from device**, **Open DIAL file system**. Header actions target the selected folder, or the root when a file / `SKILL.md` is selected.
- **Node context menu** becomes **Add child** (folders only) / **Add sibling** — each a submenu of the same four actions targeted at that folder / the node's parent — and **Delete** (today's Remove, renamed). `SKILL.md` keeps an empty menu.
- **Create folder** renders an inline-named folder node at the target depth, with required / invalid-character / duplicate-name validation plus an optional host path rule.
- **Upload archive** opens the existing staging dialog in an archive mode: a picked `.zip` is expanded by a host callback into `{ path, file }` entries that are staged exactly like device files, so `validateBatch` / `commitBatch` and the per-row errors are reused unchanged.
- **Open DIAL file system** calls a host callback that opens the shared file-manager modal and resolves with the picked files as `File`s; the lib stages them in the same dialog.
- All staged paths are prefixed with the target folder.
- New optional `SkillEditorFileActions` members (`onCreateFolder`, `validateFolderPath`, `extractArchive`, `pickFromFileSystem`); an entry whose callback is absent is not rendered, so existing hosts keep today's surface. New `SkillEditorLabels` entries, each with an English default.
- `useSkillFileActions` (`libs/chat-hooks/src/skill/useSkillFileActions.ts:79`) implements folder creation, host folder-path validation (reusing `isValidSkillRelativePath`) and `.zip` expansion with `fflate` (already a `chat-hooks` dependency, `libs/chat-hooks/package.json:137`). The app page wires the DIAL picker through the existing `DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) and `downloadFile` (`apps/chat/src/server-api/files.api.ts:13`).

### Library isolation

`libs/skill-editor` learns no bucket, DIAL path, route, or zip format: it only calls `fileActions.*` and receives `File` objects with relative paths. `.zip` parsing and path rules live in `libs/chat-hooks` (already the Skill Editor's DIAL-shape adapter); bucket resolution, the file-manager modal and downloads live in `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`.

### Non-goals

- Renaming or moving existing nodes; creating an empty *file*.
- Persisting empty folders: DIAL stores a skill's folders only through the files inside them, so a folder that is still empty at Save is dropped (`buildSkillFilesPayload`, `libs/chat-hooks/src/skill/skill.ts:283`). The editor keeps it until then.
- Uploading picked DIAL files by reference — they are downloaded and re-uploaded with the skill.
- Nested archives, or archives other than `.zip`.

### Alternatives considered

- **`DialFoldersTree` `createdFolderPath`** for inline creation — rejected: it only injects under an existing parent node (`FoldersTree.tsx:201` in `ai-dial-react-file-manager`), so root-level creation is impossible. The lib instead injects a draft node and drives it with `renamedPath`.
- **Unzipping inside `libs/skill-editor`** — rejected: adds a zip dependency and archive policy (junk entries, limits) to a host-agnostic form; a host callback keeps that at the adapter.
- **Committing archive / DIAL files directly, bypassing the dialog** — rejected: the issue requires the same per-file errors, which only the staging dialog renders.

### Acceptance criteria

1. The header renders an **Add** dropdown with the four actions; it is keyboard-operable, its trigger carries `aria-haspopup="menu"` / `aria-expanded`, and entries without a host callback are absent.
2. Create folder inserts an inline-named folder at the correct depth (root, selected folder, a node's parent or a folder's child), rejecting empty, `/`-containing, `.`/`..`, duplicate-sibling and host-rejected names; Escape cancels without a change.
3. An uploaded `.zip` expands into staged rows with folder structure preserved, under the target folder; invalid entries show the same per-file errors as a plain upload; a corrupt archive shows an error in the dialog.
4. "Open DIAL file system" opens the shared modal; attached files are staged in the upload dialog and committed through `commitBatch`; cancelling changes nothing.
5. A node's menu shows Add child (folders only), Add sibling and Delete; `SKILL.md` has no menu.
6. The tree still renders through `DialFoldersTree`; mobile accordion and desktop pane both work; logical properties, RTL and WCAG 2.1 AAA rules hold.
7. `libs/skill-editor/README.md` documents the new props, labels and enum; `npm run validate:docs` passes; unit tests cover each action and the protected node.

### Backward compatibility and rollback

Non-breaking: every new `fileActions` member and label is optional. The header control changes from a button to a dropdown, and the menu item label changes from "Remove" to "Delete" (`removeLabel` remains a deprecated fallback for `deleteLabel`). Rollback is a revert of this change; no data or API contract is touched.

## Capabilities

### New Capabilities

- `skill-file-tree-actions`: The Add dropdown, per-node Add child / Add sibling / Delete menu, inline folder creation, archive expansion and DIAL-file-system picking, and the target-folder rule.

### Modified Capabilities

- `skill-editor-library`: "Adding and removing supporting files and folders" — the single-control and "no empty-folder creation" rules are replaced; Remove becomes Delete.
- `skill-file-drag-drop`: "Upload dialog opens from 'Upload from device'…" and "Candidate paths are resolved…" — the dialog also opens from the Add menu entries, in files or archive mode, pre-staged with host-supplied entries, and prefixes candidate paths with the target folder.

## Impact

- **Code**: `libs/skill-editor` (`SkillEditor`, `SkillFileUploadDialog`, models, new `types/skill-file-upload-mode.ts`, utils), `libs/chat-hooks/src/skill/useSkillFileActions.ts` (+ a small archive helper), `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`.
- **Shared libs**: touches two libs' public API (`@epam/ai-dial-skill-editor`, `@epam/ai-dial-chat-hooks`), additively. No new dependency.
- **i18n**: new user-visible strings — Add, Create folder, Upload files from device, Upload archive from device, Open DIAL file system, Add child, Add sibling, New folder, archive dialog title / drop-zone copy / extraction error, folder-name errors, file-system download error. Keys go in `translation-keys.ts` + `en.json`; "Delete"/"Add" reuse `ButtonsI18nKeys`.
- **Docs**: `libs/skill-editor/README.md`, `libs/chat-hooks/README.md` (hook params).
- **Backend / API**: none.
