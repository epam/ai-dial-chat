## MODIFIED Requirements

### Requirement: No host, REST, or i18n dependency
`libs/toolset-editor/src/**` SHALL NOT import `react-i18next`, `i18next`, any module under `apps/chat/src/server-api`, `@epam/ai-dial-chat-api-client`, any app-level React Context/provider, `react-router`/`react-router-dom`, or any environment/feature-flag/analytics module. All user-visible strings SHALL be supplied via nested `labels` props with English-language defaults applied at leaf read sites. Every backend call SHALL arrive through injected callbacks: persistence and post-save login through `onPersist`/`onPostSaveLogin`, API-key login/logout through the `authActions` prop (`login`, `logout`, `fetchAuthSettings`), the OAuth flow through `onOAuthLogin`, the Allowed-tools list through `listToolNames`, the Connect URL through `buildMcpUrl`, and notifications through `onNotifySuccess`/`onNotifyError`. Request bodies SHALL be typed by the lib-local `ToolsetLoginRequest`/`ToolsetLogoutRequest` structural interfaces; the host adapter maps them to its generated DTOs at the app edge.

This is the first `libs/*` (besides the `chat-hooks` exception) dependency on `@epam/ai-dial-chat-hooks`. It is justified because the functions the lib needs (`getApiErrorDetails`, `dialFileToAttachment`) are host-agnostic in `libs/chat-hooks` (no routes or i18n); the `ToolsetAuthTypes`/`WithLogin`/`ToolsetCredentialsLevel` enums come from `@epam/ai-dial-chat-shared`; the OAuth popup helpers stay with the host adapter (`apps/chat/src/hooks/toolsets/useToolsetEditorOAuthLogin.ts`). The lib SHALL import only the chat-hooks root barrel, never a subpath.

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

### Requirement: Auth block operations through authActions
The internal `AuthSection` SHALL run the login/logout flows through the `authActions` prop, and SHALL delegate the entire OAuth flow to the host through the `onOAuthLogin` prop — a `ToolsetOAuthLoginHandler` the component calls synchronously from the click handler, before any `await`, so the host can open its popup inside the user gesture. The popup, the OAuth callback route, the credentials level, and the redirect/channel coordination SHALL NOT live in the library; the component SHALL consume only the returned `ToolsetOAuthLoginResult` (`status`, optional resolved `auth` fields, optional `traceId`). The double-click guard (`isAuthBusy`) SHALL remain in the component. Notifications go through `onNotifySuccess`/`onNotifyError`. The `ToolsetAuthTypes`/`WithLogin`/`ToolsetCredentialsLevel` enums behind `authenticationType`/`withLogin` SHALL come from `@epam/ai-dial-chat-shared`, never re-declared locally.

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
