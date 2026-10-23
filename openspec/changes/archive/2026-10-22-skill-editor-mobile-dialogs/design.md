# Design

## D1. A native disclosure for the mobile Files card

The kit `Accordion` renders the title above the description and draws a right-pointing caret. The design wants a caption above an icon-led file name, and a caret pointing down (up when open). `SkillFilesSummary` is therefore a `<button aria-expanded aria-controls>` over a `role="region"`. While collapsed, the region stays mounted and `inert`, as the kit `Accordion` does, so a folder rename in progress survives a collapse. The file icon is the kit `FileIcon`.

## D2. One dialog adapter, chosen by `useIsMobile`

`Popup` and `BottomSheet` are both modal and portalled. Rendering both and hiding one with CSS would leave two focus traps, so the choice is made in JS with `useIsMobile` from `@epam/ai-dial-chat-shared`. `CreateButton` in `libs/catalog` already makes this choice the same way. Its breakpoint matches the `desktop:` Tailwind variant. The kit `BottomSheet` has no footer slot, so `SkillEditorDialog` puts a sticky Confirm/Cancel row at the end of the sheet body. The footer colours live in a stylesheet and read the theme tokens the kit panel uses. The sheet renders in a portal, outside the editor root's `--se-*` vars.

## D3. The conflict step lives inside the upload dialog

Stacking a second modal over the upload dialog would mean two nested focus managers. Instead, the dialog swaps its title, body and buttons while a conflict is pending. Because the body is swapped, focus is moved explicitly: to the question when it appears, and back to the drop zone afterwards.

Only file-on-file conflicts ask the question. In-batch duplicates and a file at a folder's path stay validation errors. The root `SKILL.md` keeps its metadata-import flow.

## D4. Replacement is an explicit flag, not a relaxed rule

`replacesExisting` on the candidate keeps the host validator's existing-path check strict for every other upload. The flag turns a duplicate into an overwrite only when the user chose Replace.

A replaced file keeps its node, so nothing derived from `files` notices the change. Three consumers needed a signal:

- **Dirty state.** `SkillEditor` sets a flag from `onCommitted`.
- **Preview.** `contentRevisions[path]` is keyed into the preview's open guard.
- **Retry payload.** `contentRevisions` is added to the create-retry fingerprint.

## D5. Duplicate naming follows the file manager

`buildDuplicatePath` produces `name (n).ext` from n = 1, like `@epam/ai-dial-react-file-manager`. A leading-dot name such as `.env` has no extension. The taken set includes existing files, staged candidates and waiting conflicts, so two duplicates in one batch never collide.
