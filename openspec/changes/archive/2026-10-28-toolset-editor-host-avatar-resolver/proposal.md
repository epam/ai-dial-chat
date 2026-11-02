## Why

`libs/toolset-editor` turns a picked avatar file into an icon URL itself. It calls `dialFileToAttachment` from `@epam/ai-dial-chat-hooks` inside its deprecated `GeneralForm` wrapper (`libs/toolset-editor/src/components/GeneralForm/GeneralForm.tsx:64-76`), so a feature lib decides how a DIAL file path is built from a bucket.

The host already owns that decision. `apps/chat/src/hooks/application-editor/useApplicationAvatarPicker.ts:47-69` builds a complete `MetadataFormAvatarPicker` with its own `resolveAttachedIconUrl`. `ToolsetApplicationEditor.tsx:268-277` then destructures it into five separate props, and `ToolsetEditor` reassembles them and recomputes the resolver.

`builder-form`'s `MetadataForm` already takes the whole object (`libs/builder-form/src/models/metadata-form-props.ts:35`), and the Custom App editor passes it straight through.

This closes the host-file part of follow-up 4.2 of `enforce-nx-module-boundaries`. Once it lands, `toolset-editor` takes from `chat-hooks` only `getApiErrorDetails` and the toolset-auth enums (`ToolsetAuthTypes`, `ToolsetCredentialsLevel`, `WithLogin`). Those stay in `chat-hooks`, which holds hooks, functions, types and enums but never a component; `allow-chat-hooks-ui-edges` records that rule and guards the edge.

There is also doc drift. The `toolset-editor` README says nothing in this repo renders `GeneralForm`, but `ToolsetEditor.tsx:504` does.

## What Changes

- **BREAKING** `ToolsetEditorProps` gets one required `avatarPicker: MetadataFormAvatarPicker`. It replaces the five props `bucket`, `FileManagerModal`, `resolveIconUrl`, `allowedMimeTypes` and `maxFileSizeBytes`. `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx` passes the `avatarPicker` it already gets from `useApplicationAvatarPicker`.
- `ToolsetEditor` renders `MetadataForm` directly. The toolset-flavoured default labels move from `GeneralForm` to the editor, or to a `constants/` file.
- **BREAKING** The `@deprecated` `GeneralForm` component and `GeneralFormProps` are removed. The user chose this over keeping or reshaping them. `GeneralFormLabels` stays, because `ToolsetEditorLabels.general` uses it.
- Docs:
  - the `toolset-editor` README: the `GeneralForm` section and the `ToolsetEditor` props table;
  - the `docs/architecture.md` line that lists the deprecated wrapper;
  - `toolset-editor-library`, `toolset-authoring` and `chat-hooks-attachment-mapping` deltas.

Non-goals:

- changing `MetadataForm` or `useApplicationAvatarPicker`;
- changing picker behavior, labels or limits;
- `getApiErrorDetails` and the toolset-auth enums, which stay in `chat-hooks`.

Acceptance criteria:

- `libs/toolset-editor/src` contains no `dialFileToAttachment` and no `GeneralForm` component.
- The `@epam/ai-dial-chat-hooks` imports in `libs/toolset-editor/src` are only `getApiErrorDetails` and the toolset-auth enums.
- Picking an avatar in the toolset editor still sets `iconUrl`. This is covered by the existing `ToolsetEditor` tests, adapted to the new prop.
- `typecheck`, `lint` and `test` pass for `toolset-editor` and `chat`.
- `validate:docs` and `validate:specs` pass.

Alternatives considered (user decision):

- **Keep `GeneralForm` with an `avatarPicker` prop.** Rejected: it still breaks its "current props" promise and keeps a dead wrapper.
- **Keep `GeneralForm` as is.** Rejected: the `dialFileToAttachment` edge would stay.

Rollback: revert the commit. Hosts that had adopted the new prop would need the five props back.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `toolset-editor-library`:
  - modified: "Public package surface", "No host, REST, or i18n dependency", "EditorLayout composition" and "Direction inheritance without i18n";
  - added: "Avatar picking is injected as one avatarPicker";
  - removed: "GeneralForm shared surface".
- `toolset-authoring` ("Metadata section fields"): rendered by `ToolsetEditor` through `MetadataForm`.
- `chat-hooks-attachment-mapping`: `GeneralForm` is no longer a `dialFileToAttachment` caller.

## Impact

- **Lib:** `libs/toolset-editor`, covering `ToolsetEditor`, `models/toolset-editor-props.ts`, `models/general-form-props.ts`, `index.ts`, the `GeneralForm` folder (deleted) and its tests.
- **App:** one call site in `apps/chat`.
- **Docs:** the `toolset-editor` README and `docs/architecture.md`.
- **Library isolation improves:** bucket-to-path knowledge leaves the lib. There are no new strings, no i18n change and no RTL change; the picker UI is identical.
