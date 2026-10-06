# toolset-editor-library Specification

## Purpose
Specifies `libs/toolset-editor`'s host-agnostic `ToolsetEditor` and `GeneralForm` React components: their public package surface, host-isolation boundary (no REST/i18n/routing knowledge, no `@epam/ai-dial-chat-api-client` import), form-state ownership with re-seeding, validation and dirty-field error surfacing, save/persist orchestration through injected callbacks, the injected auth-actions boundary for the OAuth login/logout flow, the Connect-section gating, and accessibility/RTL support.
## Requirements
### Requirement: Public package surface
`libs/toolset-editor/src/index.ts` SHALL export the composed `ToolsetEditor` component, the shared `GeneralForm` component (also consumed by the Custom App editor), and every TypeScript type reachable through their props (`ToolsetEditorProps`/`ToolsetEditorLabels` with its nested `layout`/`general`/`settings`/`validation` label groups and their `ToolsetEditorLayoutLabels`/`ToolsetEditorValidationLabels` types, `GeneralFormProps`/`GeneralFormLabels`, `SettingsFormLabels`, `AuthSectionLabels`, `ConnectMcpUrlContentLabels`, the form models `ToolsetFormData`/`ToolsetAuthFormData`/`DeploymentGeneralFormData`/`ToolsetFormErrors`, the injected-auth request shapes `ToolsetLoginRequest`/`ToolsetLogoutRequest`/`ToolsetAuthActions`, the host OAuth handoff `ToolsetOAuthLoginStatus` enum with the `ToolsetOAuthLoginHandler`/`ToolsetOAuthLoginRequest`/`ToolsetOAuthLoginResult` types, the `ToolsetTransportType` enum, the `AUTH_TYPE_ICONS`/`DEFAULT_TOOLSET_NAME`/`DEFAULT_TOOLSET_VERSION` constants, the `TOOLSET_EDITOR_CLASS` public class-name map, and the pure utils `getDefaultToolsetForm`, `getStorageSafeUniqueToolsetName`, `isValidEndpointUrl`, `normalizeReturnedEndpointUrl`, `isToolsetAuthValid`, `isToolsetFormValid`). The internal `SettingsForm`, `AuthSection`, and `ConnectMcpUrlContent` components SHALL NOT be re-exported from the barrel — only `ToolsetEditor` and `GeneralForm` render them.

The package `libs/toolset-editor/package.json` SHALL declare `name: "@epam/ai-dial-toolset-editor"`, `description`, `license: "Apache-2.0"`, an `exports` map matching `libs/skill-editor/package.json`'s shape (`@epam/source`/types/import/default for `.`, plus `./package.json` and `./styles.css`), `dependencies` on `@epam/ai-dial-builder-form` and `@tabler/icons-react`, and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-chat-hooks`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx` writes `import { ToolsetEditor, getDefaultToolsetForm } from '@epam/ai-dial-toolset-editor'` and `import type { ToolsetEditorLabels, ToolsetFormData, ToolsetAuthActions } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves successfully and every named export is defined

#### Scenario: GeneralForm stays importable for external consumers
- **WHEN** a consumer writes `import { GeneralForm } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves; inside this repo only `ToolsetEditor` renders it, while the Custom App editor (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) renders `MetadataForm` from `@epam/ai-dial-builder-form` directly

#### Scenario: Internal component is not part of the public surface
- **WHEN** code outside `libs/toolset-editor` attempts to import `SettingsForm`, `AuthSection`, or `ConnectMcpUrlContent` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export them

### Requirement: No host, REST, or i18n dependency
`libs/toolset-editor/src/**` SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/ai-dial-chat-api-client`, any app-level React Context/provider, `react-router`/`react-router-dom`, or any environment/feature-flag/analytics module. All user-visible strings SHALL be supplied via nested `labels` props with English-language defaults applied at leaf read sites. Every backend call SHALL arrive through injected callbacks: persistence and post-save login through `onPersist`/`onPostSaveLogin`, API-key login/logout through the `authActions` prop (`login`, `logout`, `fetchAuthSettings`), the OAuth flow through `onOAuthLogin`, the Allowed-tools list through `listToolNames`, the Connect URL through `buildMcpUrl`, and notifications through `onNotifySuccess`/`onNotifyError`. Request bodies SHALL be typed by the lib-local `ToolsetLoginRequest`/`ToolsetLogoutRequest` structural interfaces; the host adapter maps them to its generated DTOs at the app edge.

This is the first `libs/*` (besides the `chat-hooks` exception) dependency on `@epam/ai-dial-chat-hooks`. It is justified because the helpers the lib needs (`getApiErrorDetails`, `dialFileToAttachment`, and the `ToolsetAuthTypes`/`WithLogin`/`ToolsetCredentialsLevel` enums) are host-agnostic in `libs/chat-hooks` (no routes or i18n); the OAuth popup helpers stay with the host adapter (`apps/chat/src/hooks/toolsets/useToolsetEditorOAuthLogin.ts`). The lib SHALL import only the chat-hooks root barrel, never a subpath.

#### Scenario: No i18n import
- **WHEN** `libs/toolset-editor/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed in via the nested `labels` props

#### Scenario: No server-api or generated-client import
- **WHEN** `libs/toolset-editor/src/**` is searched for imports of `apps/chat/src/server-api` or `@epam/ai-dial-chat-api-client`
- **THEN** none are found

#### Scenario: No routing or app-context import
- **WHEN** `libs/toolset-editor/src/**` is searched for `react-router` imports or imports of any `apps/chat/src/context` module
- **THEN** none are found; navigation is exposed only via `onBack`/`onSaveComplete` callbacks and context values arrive as plain props (`bucket`, the `buildMcpUrl` resolver)

#### Scenario: Chat-hooks is imported through the root barrel only
- **WHEN** `libs/toolset-editor/src/**` is searched for imports from `@epam/ai-dial-chat-hooks/`
- **THEN** none are found; every chat-hooks import is from `@epam/ai-dial-chat-hooks`

### Requirement: Form state ownership and re-seeding
`ToolsetEditor` SHALL own the form state (`ToolsetFormData`, including the nested `auth` block), the field-error state, and the dirty-field set as internal state, seeded from the `initialForm` prop and re-seeded — resetting form values, errors, dirty fields, and the draft toolset id — whenever `initialForm`'s identity changes, mirroring `libs/skill-editor`'s `initialValues` pattern. The host loads the entity (route id, DTO-to-form mapping, redirect-on-missing, loading fallback) and passes the loaded form; the lib derives edit mode from the `toolsetId` prop (empty string = create mode) and owns the draft id created by the first persist during a create session.

#### Scenario: Editing a field updates local state
- **WHEN** a user types into any Metadata or Setup field
- **THEN** `ToolsetEditor`'s internal form state updates immediately and the rendered input reflects the new value, with no save occurring

#### Scenario: Host-supplied initialForm re-seeds the editor
- **WHEN** the host supplies a differently-identified `initialForm` object
- **THEN** the editor resets its form values, errors, dirty fields, and draft toolset id to a fresh-edit state

### Requirement: Validation and dirty-field error surfacing
`ToolsetEditor` SHALL validate the form through the lib's own `isToolsetFormValid`/`isValidEndpointUrl` utils (which delegate the name/version/description checks to `builder-form`'s `validateDeploymentCreationFields` with `TOOLSET_METADATA_VALIDATION_OPTIONS`, i.e. `validateVersionPattern: SEMVER_VERSION_PATTERN`), building error messages from the `labels.validation` group. That group SHALL include `nameTooLong`, `nameControlCharacters` and `descriptionTooLong`, which default to `Use 256 characters or fewer.`, `Remove line breaks, tabs and other control characters.` and `Use 2000 characters or fewer.` respectively. Field errors SHALL surface only for fields the user has touched — Metadata fields through `useMetadataForm`'s touched state (`name`/`version` are marked touched on edit, and too-long or control-character codes show at once), Setup fields (`endpoint` and the auth fields) through the editor's own dirty-field set — and SHALL be recomputed on every change, so an over-limit name or description is flagged while the user types. Patches that change `authenticationType`, `withLogin`, or `isLoggedIn` SHALL clear all auth-field errors at once. The Save action SHALL stay disabled until `isToolsetFormValid` passes.

#### Scenario: Untouched invalid fields show no error
- **WHEN** the editor opens with an empty endpoint and the user edits only the name
- **THEN** no endpoint error is shown, because the endpoint field is not dirty

#### Scenario: Over-long name shows inline while typing
- **WHEN** the user types a 257-character name
- **THEN** `labels.validation.nameTooLong` is shown under the Name field and Save is disabled, with no notification raised

#### Scenario: Save is disabled while the form is invalid
- **WHEN** any validation rule fails (missing, over-long or control-character name, over-long description, missing endpoint, invalid version or endpoint URL, incomplete auth configuration)
- **THEN** the Save/Create action is disabled until the failing fields are corrected

#### Scenario: Switching auth type clears auth errors
- **WHEN** the user has a key-header error visible and then switches the authentication type
- **THEN** all auth-field errors are cleared at once

### Requirement: Save and persist orchestration via injected callbacks
`ToolsetEditor` SHALL orchestrate saving entirely through injected callbacks, owning the saving indicator and ordering: `onPersist(form, toolsetId)` creates or updates (host owns the request mapping and failure notification, returning the new id or `null`); `onToolsetsChanged()` re-syncs the host's shared toolset list; `onSaveSuccess(form)` lets the host raise its success toast; `onPostSaveLogin(toolsetId, auth)` performs the post-save automatic API-key login; `onSaveComplete()` navigates away; `onBack()` covers Cancel and the header back action. The Log In flow's persist-before-login (`onEnsureSaved`) SHALL skip the request when the form is unchanged since the last persist, and SHALL resolve and use the id returned by the persist for every subsequent call in the same login attempt.

#### Scenario: Save persists, notifies, then navigates
- **WHEN** a user clicks Save with a valid form
- **THEN** the editor calls `onPersist`, then `onToolsetsChanged`, then `onSaveSuccess`, then `onPostSaveLogin`, and navigates via `onSaveComplete` only if all of them succeed

#### Scenario: Failed post-save login does not navigate
- **WHEN** `onPersist` succeeds but `onPostSaveLogin` rejects
- **THEN** the editor shows a login-failure error via `onNotifyError` and does NOT call `onSaveComplete`; the user stays in the editor with their input preserved

#### Scenario: Persist failure keeps the editor open
- **WHEN** `onPersist` resolves `null` (the host already surfaced its failure notification)
- **THEN** the editor clears the saving state, calls no further callbacks, and keeps the user's input

#### Scenario: Log In persists unsaved changes first
- **WHEN** a user edits fields without saving and then clicks Log In
- **THEN** the editor persists via `onPersist` first and every subsequent call in that login attempt uses the id the persist resolved, including the id of a toolset created by that very persist

### Requirement: Auth block operations through authActions
The internal `AuthSection` SHALL run the login/logout flows through the `authActions` prop, and SHALL delegate the entire OAuth flow to the host through the `onOAuthLogin` prop — a `ToolsetOAuthLoginHandler` the component calls synchronously from the click handler, before any `await`, so the host can open its popup inside the user gesture. The popup, the OAuth callback route, the credentials level, and the redirect/channel coordination SHALL NOT live in the library; the component SHALL consume only the returned `ToolsetOAuthLoginResult` (`status`, optional resolved `auth` fields, optional `traceId`). The double-click guard (`isAuthBusy`) SHALL remain in the component. Notifications go through `onNotifySuccess`/`onNotifyError`. `authenticationType`/`withLogin`/`ToolsetCredentialsLevel` SHALL come from `@epam/ai-dial-chat-hooks`, never re-declared locally.

#### Scenario: The OAuth flow is handed to the host synchronously
- **WHEN** a user clicks Log In on an OAuth toolset
- **THEN** `onOAuthLogin` is called before the component's first `await`, receiving the current `auth` state and an `ensureSaved` continuation, so the host can open a user-triggered popup and persist the toolset itself

#### Scenario: Each outcome selects its own notification
- **WHEN** the host resolves `onOAuthLogin` with `PopupBlocked`, `InvalidConfig`, `Failed` or `Success`
- **THEN** the component shows the matching label (`errorPopupBlocked`, `errorOAuthConfigMissing`, `errorLoginFailed` with the returned `traceId`, or `loginSuccessMessage`), and a `Cancelled` outcome shows nothing

#### Scenario: Fields resolved during the flow reach the form
- **WHEN** the host returns `auth` fields it resolved while running the flow, such as a dynamically registered `clientId`
- **THEN** the component merges them into the form regardless of the status

#### Scenario: A second click during an in-flight login is ignored
- **WHEN** the login flow is busy (`isAuthBusy`)
- **THEN** the Log In action is disabled and no second `onOAuthLogin` call starts

### Requirement: Connect section gating
The Connect toolset section SHALL render inside the Setup section only when the host supplies a `buildMcpUrl` resolver (i.e. an external core URL is configured) AND a persisted toolset id exists (edit mode, or a draft id created during the create session by Log In/Save). The composed editor resolves the URL by calling `buildMcpUrl` with the current persisted id and passes the resolved string to the internal SettingsForm; it SHALL never construct the URL itself. When either condition is absent the section SHALL NOT render.

#### Scenario: Connect section hidden in fresh create mode
- **WHEN** the editor opens in create mode before any save or login
- **THEN** no Connect section renders, since no persisted id exists

#### Scenario: Connect section appears once the draft id exists
- **WHEN** a create-mode user logs in (persisting the toolset and creating a draft id) while `buildMcpUrl` is supplied
- **THEN** the Connect section renders with the URL built from the freshly created id

#### Scenario: Connect section hidden without an external core URL
- **WHEN** the host omits `buildMcpUrl`
- **THEN** the Connect section never renders, even in edit mode

### Requirement: EditorLayout composition
`ToolsetEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell. `EntityEditor` in turn composes `EditorLayout` with a Metadata `EditorSection` and a Setup `EditorSection`. `ToolsetEditor` passes:

- `metadata`: the deprecated `GeneralForm` wrapper, which renders `MetadataForm` with every field.
- `setup`: the internal `SettingsForm`.
- `title` and `submitLabel`: the resolved create/edit title and Create or Save label.
- `onSubmit`, `onCancel`, `onBack`, `isSubmitting` and `isSubmitDisabled`.

The metadata values, touched state and validation codes SHALL come from `useMetadataForm` (with `TOOLSET_METADATA_VALIDATION_OPTIONS`, i.e. `validateVersionPattern: SEMVER_VERSION_PATTERN`). The endpoint and auth validation stays in `ToolsetEditor`.

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

### Requirement: GeneralForm shared surface
The Metadata field set SHALL live in `@epam/ai-dial-builder-form` as `MetadataForm` (see `builder-form`). `@epam/ai-dial-toolset-editor` SHALL keep exporting `GeneralForm`, `GeneralFormProps` and `GeneralFormLabels` with their current props, marked `@deprecated`. `GeneralForm` SHALL be a thin wrapper that renders `MetadataForm` and supplies `avatarPicker.resolveAttachedIconUrl` through `dialFileToAttachment` from `@epam/ai-dial-chat-hooks`. It SHALL contain no field markup or picker state of its own.

Every host concern stays injected:

- `bucket` (storage bucket)
- `FileManagerModal` (host file-manager modal component)
- `resolveIconUrl` (icon URL resolution)
- `allowedMimeTypes` / `maxFileSizeBytes` (avatar restrictions)
- `availableLocaleOptions` (locale choices)

The form SHALL NOT resolve the current user, import a file-manager implementation or build locale options itself. Its labels SHALL be an object whose `form` and `avatarPicker` groups are each optional and are replaced as a whole when supplied.

#### Scenario: Avatar picking goes through the host file manager
- **WHEN** a user clicks "Add avatar" and picks a file
- **THEN** the file is resolved through the host-supplied `FileManagerModal` and bucket, and the resulting URL is reported through `onChange({ iconUrl })`

#### Scenario: Deprecated wrapper renders the shared component
- **WHEN** a consumer imports `GeneralForm` from `@epam/ai-dial-toolset-editor`
- **THEN** it renders `MetadataForm` from `@epam/ai-dial-builder-form` with the same fields, labels and avatar behaviour as before

### Requirement: Accessibility of the editor surface
The lib SHALL keep the existing accessible patterns: the Connect section's copy feedback announced via an `aria-live="polite"` status region separate from the button's stable label; auth segment icons `aria-hidden` with their text available to screen readers; the saving status announced through `EditorLayout`'s live region; disabled (not hidden) auth controls while logged in or saving so their state is programmatically observable.

#### Scenario: Copy feedback is announced
- **WHEN** a user copies the Connect URL
- **THEN** an `aria-live="polite"` region announces the copied confirmation, separate from the Copy button's own label

#### Scenario: Saving state is announced
- **WHEN** the editor enters the saving state
- **THEN** the saving status is announced through the header's live region, independent of the Save button's label

### Requirement: Direction inheritance without i18n
`ToolsetEditor` and `GeneralForm` SHALL rely on CSS logical properties and the ambient `dir` attribute inherited from `<html>` for right-to-left layout; they SHALL NOT inspect the active application language to decide direction. Directional icons SHALL be mirrored via `rtl:` Tailwind variants or logical properties.

#### Scenario: Renders correctly under an RTL ancestor
- **WHEN** the editor is mounted under an ancestor with `dir="rtl"`
- **THEN** its layout flips via inherited CSS logical properties with no prop or i18n call telling it to do so
