Slicing: vertical. One slice carries the new prop from the host through `ToolsetEditor` to `MetadataForm`. The next removes the dead wrapper, the last fixes the docs. design.md is skipped: the target contract, `MetadataFormAvatarPicker`, already exists in `builder-form` and is used by the Custom App editor, so no design choice is left open.

**Lib architecture guard:** after this change `libs/toolset-editor/src` must not:
- build a `files/<bucket>/…` path;
- call `dialFileToAttachment`;
- resolve the user or bucket itself.

All of that arrives through `avatarPicker`.

## 1. Inject the avatar picker

- [ ] 1.1 In `libs/toolset-editor/src/models/toolset-editor-props.ts`, replace `bucket`, `FileManagerModal`, `resolveIconUrl`, `allowedMimeTypes` and `maxFileSizeBytes` with a required `avatarPicker: MetadataFormAvatarPicker` (type-only import from `@epam/ai-dial-builder-form`), with JSDoc.
- [ ] 1.2 In `libs/toolset-editor/src/components/ToolsetEditor/ToolsetEditor.tsx`, render `MetadataForm` directly as `metadata`. Pass it:
  - `avatarPicker`;
  - the form values, errors and handlers `GeneralForm` passed;
  - labels memoised as `{ form: labels?.general?.form ?? DEFAULT_TOOLSET_METADATA_LABELS, avatarPicker: labels?.general?.avatarPicker }`.

  Move the toolset default labels out of `GeneralForm.tsx` into `libs/toolset-editor/src/constants/toolsets.ts`, or a new `constants/` file named for the domain.
- [ ] 1.3 In `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`, stop destructuring `avatarPicker` and pass `avatarPicker={avatarPicker}` instead of the five props.
- [ ] 1.4 Update the `ToolsetEditor` tests under `libs/toolset-editor/src/components/ToolsetEditor/tests/` to pass `avatarPicker`, using a stub `resolveAttachedIconUrl`. Add or keep a test that picking an avatar reports the URL the stub returns as `iconUrl`. Name it by behavior, for example "uses the host resolver for a picked avatar".

Verification:

- `npm run test:file -- <each spec under libs/toolset-editor/src/components/ToolsetEditor/tests>`
- the `ToolsetApplicationEditor` spec file under `apps/chat/src/pages/ApplicationEditor/toolset/`
- `npm exec nx run-many -t typecheck -p @epam/ai-dial-toolset-editor @epam/chat`

## 2. Remove the deprecated wrapper

- [ ] 2.1 Delete `libs/toolset-editor/src/components/GeneralForm/`, including its tests.
- [ ] 2.2 In `libs/toolset-editor/src/models/general-form-props.ts`, remove `GeneralFormProps` and keep `GeneralFormLabels`. Rename the file only if nothing else lives in it besides `GeneralFormLabels`; otherwise leave the path.
- [ ] 2.3 In `libs/toolset-editor/src/index.ts`, drop the `GeneralForm` and `GeneralFormProps` exports.
- [ ] 2.4 Confirm `libs/toolset-editor/src` contains no `dialFileToAttachment`, and that its `@epam/ai-dial-chat-hooks` imports are only `getApiErrorDetails` and the toolset-auth enums.

Verification: `npm exec nx run-many -t typecheck lint test -p @epam/ai-dial-toolset-editor @epam/chat`

## 3. Docs

- [ ] 3.1 `libs/toolset-editor/README.md`:
  - remove the `GeneralForm` section and the overview's mention of it;
  - replace the five avatar props in the `ToolsetEditor` props table and examples with `avatarPicker`;
  - note the migration to `MetadataForm`.
- [ ] 3.2 `docs/architecture.md`: drop "a deprecated `GeneralForm` wrapper over `MetadataForm`" from the `toolset-editor` row.
- [ ] 3.3 Run `npm run validate:docs` and `npm run validate:specs`. Then run `npm run verify:full` once.
