# toolset-editor-library Specification

## Purpose
Specifies `libs/toolset-editor`'s host-agnostic `ToolsetEditor` and `GeneralForm` React components: their public package surface, host-isolation boundary (no REST/i18n/routing knowledge, no `@epam/ai-dial-chat-api-client` import), form-state ownership with re-seeding, validation and dirty-field error surfacing, save/persist orchestration through injected callbacks, the injected auth-actions boundary for the OAuth login/logout flow, the Connect-section gating, and accessibility/RTL support.

## Requirements

### Requirement: Public package surface
`libs/toolset-editor/src/index.ts` SHALL export the composed `ToolsetEditor` component, the shared `GeneralForm` component (also consumed by the Custom App editor), and every TypeScript type reachable through their props (`ToolsetEditorProps`/`ToolsetEditorLabels` with its nested `layout`/`general`/`settings`/`validation` label groups, `GeneralFormProps`/`GeneralFormLabels`, `SettingsFormLabels`, `AuthSectionLabels`, `ConnectMcpUrlContentLabels`, the form models `ToolsetFormData`/`ToolsetAuthFormData`/`DeploymentGeneralFormData`/`ToolsetFormErrors`, the injected-auth request shapes `ToolsetLoginRequest`/`ToolsetLogoutRequest`/`ToolsetAuthActions`, the `ToolsetTransportType` enum, the `DEFAULT_TOOLSET_NAME`/`DEFAULT_TOOLSET_VERSION` constants, and the pure utils `getDefaultToolsetForm`, `getStorageSafeUniqueToolsetName`, `isValidEndpointUrl`, `normalizeReturnedEndpointUrl`, `isToolsetAuthValid`, `isToolsetFormValid`). The internal `SettingsForm`, `AuthSection`, and `ConnectMcpUrlContent` components SHALL NOT be re-exported from the barrel — only `ToolsetEditor` and `GeneralForm` render them.

The package `libs/toolset-editor/package.json` SHALL declare `name: "@epam/ai-dial-toolset-editor"`, `description`, `license: "Apache-2.0"`, an `exports` map matching `libs/skill-editor/package.json`'s shape (source/types/import/default for `.`, plus `./package.json`), and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-chat-hooks`, `@epam/ai-dial-builder-form`, and `@tabler/icons-react`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` writes `import { ToolsetEditor, getDefaultToolsetForm } from '@epam/ai-dial-toolset-editor'` and `import type { ToolsetEditorLabels, ToolsetFormData, ToolsetAuthActions } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves successfully and every named export is defined

#### Scenario: Custom App editor imports the shared GeneralForm
- **WHEN** `apps/chat/src/pages/ToolsetEditor/CustomAppEditorView.tsx` writes `import { GeneralForm } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves and the General step renders through the library component with the Custom App editor's own labels

#### Scenario: Internal component is not part of the public surface
- **WHEN** code outside `libs/toolset-editor` attempts to import `SettingsForm`, `AuthSection`, or `ConnectMcpUrlContent` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export them

### Requirement: No host, REST, or i18n dependency
`libs/toolset-editor/src/**` SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/ai-dial-chat-api-client`, any app-level React Context/provider, `react-router`/`react-router-dom`, or any environment/feature-flag/analytics module. All user-visible strings SHALL be supplied via nested `labels` props with English-language defaults applied at leaf read sites. Every backend call SHALL arrive through injected callbacks: persistence and post-save login through `onPersist`/`onPostSaveLogin`, auth operations through the `authActions` prop (`login`, `logout`, `fetchAuthSettings`), and notifications through `onNotifySuccess`/`onNotifyError`. Request bodies SHALL be typed by the lib-local `ToolsetLoginRequest`/`ToolsetLogoutRequest` structural interfaces; the host adapter maps them to its generated DTOs at the app edge.

This is the first `libs/*` (besides the `chat-hooks` exception) dependency on `@epam/ai-dial-chat-hooks`. It is justified because the OAuth helpers the auth block needs (`initiateOAuthLogin`, `navigateToolsetOAuthPopup`, `openToolsetOAuthPopup`, `waitForToolsetOAuthResult`, `getApiErrorDetails`, `buildToolsetMcpUrl`, and the `ToolsetAuthTypes`/`WithLogin`/`ToolsetCredentialsLevel` enums) are host-agnostic in `libs/chat-hooks/src/oauth/` (the callback path is a parameter, no routes or i18n). The lib SHALL import only the chat-hooks root barrel, never a subpath.

#### Scenario: No i18n import
- **WHEN** `libs/toolset-editor/src/**` is searched for `react-i18next`/`i18next` imports
- **THEN** none are found; all copy is passed in via the nested `labels` props

#### Scenario: No server-api or generated-client import
- **WHEN** `libs/toolset-editor/src/**` is searched for imports of `apps/chat/src/server-api` or `@epam/ai-dial-chat-api-client`
- **THEN** none are found

#### Scenario: No routing or app-context import
- **WHEN** `libs/toolset-editor/src/**` is searched for `react-router` imports or imports of any `apps/chat/src/context` module
- **THEN** none are found; navigation is exposed only via `onBack`/`onSaveComplete` callbacks and context values arrive as plain props (`bucket`, `connectUrl` inputs)

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
`ToolsetEditor` SHALL validate the form through the lib's own `isToolsetFormValid`/`isValidEndpointUrl` utils (which delegate the name/version checks to `builder-form`'s `validateDeploymentCreationFields` with `validateVersionPattern: true`), building error messages from the `labels.validation` group. Field errors SHALL surface only for fields the user has touched (the dirty-field set); patches that change `authenticationType`, `withLogin`, or `isLoggedIn` SHALL clear all auth-field errors at once. The Save action SHALL stay disabled until `isToolsetFormValid` passes.

#### Scenario: Untouched invalid fields show no error
- **WHEN** the editor opens with an empty endpoint and the user edits only the name
- **THEN** no endpoint error is shown, because the endpoint field is not dirty

#### Scenario: Save is disabled while the form is invalid
- **WHEN** any validation rule fails (missing name/endpoint, invalid version or endpoint URL, incomplete auth configuration)
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
The internal `AuthSection` SHALL run the login/logout/OAuth flows through the `authActions` prop and the chat-hooks OAuth helpers, preserving the popup-open-before-await ordering for the dynamic-client-registration branch (the placeholder popup is opened synchronously in the click handler, before any `onEnsureSaved`/`fetchAuthSettings` await), the double-click guard (`isAuthBusy`), and the Cancelled-result backend reconciliation (a fetched `fetchAuthSettings` result reporting `isLoggedIn: true` recovers a login the popup flow reported as cancelled). The OAuth callback route SHALL arrive as the `oauthCallbackPath` prop; notifications go through `onNotifySuccess`/`onNotifyError`. `authenticationType`/`withLogin`/`ToolsetCredentialsLevel` SHALL come from `@epam/ai-dial-chat-hooks`, never re-declared locally.

#### Scenario: Dynamic-registration login opens the popup synchronously
- **WHEN** a user clicks Log In on an OAuth "With login" toolset that has no client id yet
- **THEN** the placeholder popup opens synchronously in the click handler before any awaited persist/fetch, so the browser treats it as user-triggered

#### Scenario: A second click during an in-flight login is ignored
- **WHEN** the login flow is busy (`isAuthBusy`)
- **THEN** the Log In action is disabled and no second popup or concurrent login starts

#### Scenario: A false popup cancel is reconciled with the backend
- **WHEN** the popup flow resolves Cancelled but a subsequent `authActions.fetchAuthSettings` reports `isLoggedIn: true`
- **THEN** the editor marks the toolset logged in and shows the login success notification

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
`ToolsetEditor` SHALL use `EditorLayout` from `@epam/ai-dial-builder-form` as its outer shell, with the Metadata `EditorSection` (rendering `GeneralForm`) as `leftContent`, the Setup `EditorSection` (rendering the internal `SettingsForm`) as `rightContent`, and Cancel + Save/Create in the `actions` slot. On mobile the two sections SHALL stack vertically (Metadata first). No footer button bar, wizard indicator, or preview pane SHALL be rendered by the lib.

#### Scenario: Both sections visible at desktop width
- **WHEN** the editor renders at desktop width
- **THEN** the Metadata section (left) and Setup section (right) are both visible simultaneously

#### Scenario: Sections stack on mobile
- **WHEN** the editor renders at mobile width
- **THEN** Metadata renders above Setup, both reachable by scrolling, with no tab or step navigation

### Requirement: GeneralForm shared surface
The exported `GeneralForm` SHALL render the Metadata field set through `builder-form`'s `DeploymentCreationForm` plus the `AvatarPickerModal`, with every host concern injected: `bucket` (storage bucket), `FileManagerModal` (host file-manager modal component), `resolveIconUrl` (icon URL resolution), `allowedMimeTypes`/`maxFileSizeBytes` (avatar restrictions), and `availableLocaleOptions` (locale choices). It SHALL NOT resolve the current user, import a file-manager implementation, or build locale options itself. Its labels SHALL be a `GeneralFormLabels` object whose `form` and `avatarPicker` groups are each optional and replaced as a whole when supplied.

#### Scenario: Avatar picking goes through the host file manager
- **WHEN** a user clicks "Add avatar" and picks a file
- **THEN** the file is resolved through the host-supplied `FileManagerModal` and bucket, and the resulting URL is reported through `onChange({ iconUrl })`

#### Scenario: Custom App editor supplies its own placeholders
- **WHEN** the Custom App editor renders `GeneralForm` with its own `labels.form.name.placeholder`
- **THEN** the Name field uses that placeholder while the rest of the form keeps the shared default labels

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
