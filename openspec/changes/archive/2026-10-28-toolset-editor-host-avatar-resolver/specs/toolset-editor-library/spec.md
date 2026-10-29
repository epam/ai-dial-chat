## MODIFIED Requirements

### Requirement: Public package surface
`libs/toolset-editor/src/index.ts` SHALL export the composed `ToolsetEditor` component and every TypeScript type reachable through its props (`ToolsetEditorProps`/`ToolsetEditorLabels` with its nested `layout`/`general`/`settings`/`validation` label groups and their `ToolsetEditorLayoutLabels`/`ToolsetEditorValidationLabels` types, `GeneralFormLabels` (the `labels.general` group), `SettingsFormLabels`, `AuthSectionLabels`, `ConnectMcpUrlContentLabels`, the form models `ToolsetFormData`/`ToolsetAuthFormData`/`DeploymentGeneralFormData`/`ToolsetFormErrors`, the injected-auth request shapes `ToolsetLoginRequest`/`ToolsetLogoutRequest`/`ToolsetAuthActions`, the host OAuth handoff `ToolsetOAuthLoginStatus` enum with the `ToolsetOAuthLoginHandler`/`ToolsetOAuthLoginRequest`/`ToolsetOAuthLoginResult` types, the `ToolsetTransportType` enum, the `AUTH_TYPE_ICONS`/`DEFAULT_TOOLSET_VERSION` constants (`DEFAULT_TOOLSET_VERSION` is an alias of `@epam/ai-dial-builder-form`'s `DEFAULT_DEPLOYMENT_VERSION`), the `TOOLSET_EDITOR_CLASS` public class-name map, and the pure utils `getDefaultToolsetForm` (no parameters; returns an empty `name` and `version: DEFAULT_TOOLSET_VERSION`), `isValidEndpointUrl`, `normalizeReturnedEndpointUrl`, `isToolsetAuthValid`, `isToolsetFormValid`). The internal `SettingsForm`, `AuthSection`, and `ConnectMcpUrlContent` components SHALL NOT be re-exported from the barrel — only `ToolsetEditor` renders them. The barrel SHALL NOT export a default toolset name constant or a unique-name helper (the former `DEFAULT_TOOLSET_NAME` and `getStorageSafeUniqueToolsetName` were removed).

The package `libs/toolset-editor/package.json` SHALL declare `name: "@epam/ai-dial-toolset-editor"`, `description`, `license: "Apache-2.0"`, an `exports` map matching `libs/skill-editor/package.json`'s shape (`@epam/source`/types/import/default for `.`, plus `./package.json` and `./styles.css`), `dependencies` on `@epam/ai-dial-builder-form` and `@tabler/icons-react`, and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-chat-hooks`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx` writes `import { ToolsetEditor, getDefaultToolsetForm } from '@epam/ai-dial-toolset-editor'` and `import type { ToolsetEditorLabels, ToolsetFormData, ToolsetAuthActions } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves successfully and every named export is defined

#### Scenario: The removed GeneralForm wrapper is not exported
- **WHEN** a consumer attempts to import `GeneralForm` or `GeneralFormProps` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve; a host that needs the metadata field set renders `MetadataForm` from `@epam/ai-dial-builder-form` directly, as the Custom App editor (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) does

#### Scenario: Internal component is not part of the public surface
- **WHEN** code outside `libs/toolset-editor` attempts to import `SettingsForm`, `AuthSection`, or `ConnectMcpUrlContent` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export them

#### Scenario: Default form carries no generated name
- **WHEN** a consumer calls `getDefaultToolsetForm()`
- **THEN** the result has `name: ''`, `version: '1.0.0'`, protocol `HTTP`, and auth `None` / `WithoutLogin` / not logged in

#### Scenario: Removed name helpers are not exported
- **WHEN** a consumer attempts to import `DEFAULT_TOOLSET_NAME` or `getStorageSafeUniqueToolsetName` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve

### Requirement: No host, REST, or i18n dependency
`libs/toolset-editor/src/**` SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/ai-dial-chat-api-client`, any app-level React Context/provider, `react-router`/`react-router-dom`, or any environment/feature-flag/analytics module. All user-visible strings SHALL be supplied via nested `labels` props with English-language defaults applied at leaf read sites. Every backend call SHALL arrive through injected callbacks: persistence and post-save login through `onPersist`/`onPostSaveLogin`, API-key login/logout through the `authActions` prop (`login`, `logout`, `fetchAuthSettings`), the OAuth flow through `onOAuthLogin`, the Allowed-tools list through `listToolNames`, the Connect URL through `buildMcpUrl`, and notifications through `onNotifySuccess`/`onNotifyError`. Request bodies SHALL be typed by the lib-local `ToolsetLoginRequest`/`ToolsetLogoutRequest` structural interfaces; the host adapter maps them to its generated DTOs at the app edge.

This is the first `libs/*` (besides the `chat-hooks` exception) dependency on `@epam/ai-dial-chat-hooks`. It is justified because the helpers the lib needs (`getApiErrorDetails` and the `ToolsetAuthTypes`/`WithLogin`/`ToolsetCredentialsLevel` enums) are host-agnostic in `libs/chat-hooks` (no routes or i18n); the OAuth popup helpers stay with the host adapter (`apps/chat/src/hooks/toolsets/useToolsetEditorOAuthLogin.ts`). The lib SHALL import only the chat-hooks root barrel, never a subpath.

#### Scenario: No i18n import
- **WHEN** `libs/toolset-editor/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed in via the nested `labels` props

#### Scenario: No server-api or generated-client import
- **WHEN** `libs/toolset-editor/src/**` is searched for imports of `apps/chat/src/server-api` or `@epam/ai-dial-chat-api-client`
- **THEN** none are found

#### Scenario: No routing or app-context import
- **WHEN** `libs/toolset-editor/src/**` is searched for `react-router` imports or imports of any `apps/chat/src/context` module
- **THEN** none are found; navigation is exposed only via `onBack`/`onSaveComplete` callbacks and context values arrive as plain props (`avatarPicker`, the `buildMcpUrl` resolver)

#### Scenario: Chat-hooks is imported through the root barrel only
- **WHEN** `libs/toolset-editor/src/**` is searched for imports from `@epam/ai-dial-chat-hooks/`
- **THEN** none are found; every chat-hooks import is from `@epam/ai-dial-chat-hooks`

### Requirement: EditorLayout composition
`ToolsetEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell. `EntityEditor` in turn composes `EditorLayout` with a Metadata `EditorSection` and a Setup `EditorSection`. `ToolsetEditor` passes:

- `metadata`: `MetadataForm` from `@epam/ai-dial-builder-form` with every field, the host's `avatarPicker`, and the toolset-flavoured default labels when `labels.general` is omitted.
- `setup`: the internal `SettingsForm`.
- `title` and `submitLabel`: the resolved create/edit title and Create or Save label.
- `onSubmit`, `onCancel`, `onBack`, `isSubmitting` and `isSubmitDisabled`.

The metadata values, touched state and validation codes SHALL come from `useMetadataForm` (with `validateVersionPattern: true`, i.e. the default character-set `VERSION_PATTERN`). The endpoint and auth validation stays in `ToolsetEditor`.

On mobile the two sections SHALL stack vertically (Metadata first). The lib SHALL NOT render a footer button bar, a wizard indicator or a preview pane.

#### Scenario: Both sections visible at desktop width
- **WHEN** the editor renders at desktop width
- **THEN** the Metadata section (left) and Setup section (right) are both visible simultaneously

#### Scenario: Sections stack on mobile
- **WHEN** the editor renders at mobile width
- **THEN** Metadata renders above Setup, both reachable by scrolling, with no tab or step navigation

#### Scenario: Shell comes from EntityEditor
- **WHEN** `libs/toolset-editor/src/**` is searched for direct `EditorLayout` or `EditorSection` usage
- **THEN** none are found, and the shell renders through `EntityEditor`

### Requirement: Direction inheritance without i18n
`ToolsetEditor` SHALL rely on CSS logical properties and the ambient `dir` attribute inherited from `<html>` for right-to-left layout; it SHALL NOT inspect the active application language to decide direction. Directional icons SHALL be mirrored via `rtl:` Tailwind variants or logical properties.

#### Scenario: Renders correctly under an RTL ancestor
- **WHEN** the editor is mounted under an ancestor with `dir="rtl"`
- **THEN** its layout flips via inherited CSS logical properties with no prop or i18n call telling it to do so

## ADDED Requirements

### Requirement: Avatar picking is injected as one avatarPicker

`ToolsetEditorProps` SHALL take the avatar picker as a single required `avatarPicker: MetadataFormAvatarPicker` prop (the type `@epam/ai-dial-builder-form` exports for `MetadataForm`), in place of the former separate `bucket`, `FileManagerModal`, `resolveIconUrl`, `allowedMimeTypes` and `maxFileSizeBytes` props. `ToolsetEditor` SHALL pass it to `MetadataForm` unchanged. Turning a picked file into an icon URL is the host's `avatarPicker.resolveAttachedIconUrl`; `libs/toolset-editor/src` SHALL NOT call `dialFileToAttachment` or build a DIAL file path. `apps/chat` supplies the object from `apps/chat/src/hooks/application-editor/useApplicationAvatarPicker.ts`, the same one the Custom App editor uses.

Memoisation: the host passes a memoised object (`useApplicationAvatarPicker` returns one from `useMemo`), so `ToolsetEditor` adds none. i18n, RTL and accessibility are unchanged: the picker labels still arrive through `labels.general.avatarPicker`.

#### Scenario: A picked avatar resolves through the host
- **WHEN** a user picks an image in the avatar picker of `ToolsetEditor`
- **THEN** `avatarPicker.resolveAttachedIconUrl` is called with the `AttachResult`, and the URL it returns is reported through the form's `iconUrl`

#### Scenario: The lib no longer resolves DIAL files
- **WHEN** `libs/toolset-editor/src` is searched for `dialFileToAttachment`
- **THEN** nothing is found; its `@epam/ai-dial-chat-hooks` imports are `getApiErrorDetails` and the toolset-auth enums only

## REMOVED Requirements

### Requirement: GeneralForm shared surface

**Reason**: `GeneralForm` was a `@deprecated` wrapper whose only remaining job was resolving the picked avatar through `dialFileToAttachment`, which kept `toolset-editor` depending on a `chat-hooks` function for host file handling. `ToolsetEditor` now renders `MetadataForm` directly with a host-supplied `avatarPicker`.

**Migration**: render `MetadataForm` from `@epam/ai-dial-builder-form` and pass `avatarPicker` (including `resolveAttachedIconUrl`) and `labels`; `GeneralFormLabels` stays exported for `ToolsetEditorLabels.general`.
