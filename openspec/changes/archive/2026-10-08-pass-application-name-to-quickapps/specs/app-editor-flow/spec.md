# Spec Delta

## MODIFIED Requirements

### Requirement: App editor iframe component

`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` SHALL:

- Build the iframe URL with encoded `authProvider`, `id`, `theme`, `applicationCredentials`, and `applicationName` query parameters.
  - `applicationName` SHALL be `schema.displayName`, URL-encoded (e.g. `Quick app 2.0` becomes `Quick+app+2.0`), and SHALL be omitted entirely when `schema.displayName` is missing or empty. It is the same value used as the `${displayName}/` prefix when matching incoming postMessage types, so the embedded editor can name its own messages with it instead of being configured separately.
  - `providerId` from `useUser().user?.providerId`
  - `theme` from `useTheme().currentTheme`
  - `applicationCredentials` SHALL be `true` only when both `useFeatureFlag('liveChatInteraction')` and `useUiFeature(OverlayFeature.LiveChatInteraction)` are enabled, otherwise `false`
- Render a full-height `<iframe>` (`className="size-full border-none"`) with `allow="local-network-access=*"` so the embedded app — and any window it opens via `window.open` (e.g. an identity-provider login popup) — can request and receive the Local Network Access permission when the embedded app's or its identity provider's origin resolves to a private/internal IP address.
- Show a `<Spinner />` overlay until the iframe dispatches `load` or fires a `readyToInteract` postMessage event; after either, hide the spinner.
- Add a `window.addEventListener('message', handleMessage)` listener on mount and remove it on unmount (`useEffect` cleanup).
- In `handleMessage`, after verifying `event.origin` matches `schema.editorUrl`'s origin:
  - `event.data.type === \`${displayName}/${AppsEditorEvent.ReadyToInteract}\`` → set loading=false
  - `event.data.type === \`${displayName}/${AppsEditorEvent.UpdatedSuccess}\`` → call the optional `onUpdated` callback prop
  - `event.data.type === AppsEditorEvent.SaveSuccess` → call the optional `onSaveSuccess` callback prop with the message's `hasChanges` normalized to a strict boolean
  - `event.data.type === AppsEditorEvent.SaveError` → call the optional `onSaveError` callback prop with `event.data.error ?? ''`
- `AppsEditorEvent` (in `apps/chat/src/types/apps-editor.ts`) SHALL include at least `ReadyToInteract = 'readyToInteract'`, `UpdatedSuccess = 'updatedApplicationSuccess'`, `TriggerSave = 'TRIGGER_SAVE'`, `SaveSuccess = 'SAVE_SUCCESS'`, `SaveError = 'SAVE_ERROR'`, and `RequestApplicationCredentials = 'REQUEST_APPLICATION_CREDENTIALS'`. Further members carry the readiness and toolset-login parts of the protocol and are owned by the `quick-app-authoring` capability.
- Be wrapped in `forwardRef<AppEditorIframeHandle, Props>` and expose, via `useImperativeHandle`, a `triggerSave(general?)` that posts a `TriggerSaveMessage` (`{ type: AppsEditorEvent.TriggerSave, general }`) to the iframe's `contentWindow` targeted at `schema.editorUrl`'s origin (a no-op when that origin cannot be resolved):

```ts
export interface AppEditorIframeHandle {
  triggerSave: (general?: TriggerSaveGeneralPayload) => void;
}
```

Props:
```ts
interface Props {
  schema: ApplicationSchemaSummaryDto;
  appId: string;
  onUpdated?: () => void;
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
}
```

**Memoisation**: `handleMessage` SHALL be wrapped in `useCallback`. The `iframeUrl` string SHALL be wrapped in `useMemo`. `triggerSave` (inside `useImperativeHandle`) is memoised on `[schema.editorUrl]`.

**Accessibility**: The `<iframe>` SHALL have `title={schema.displayName}`. The loading overlay SHALL expose exactly one status region: the kit `Spinner` (itself `role="status"`, wrapping a `role="img"`) SHALL receive `ariaLabel` from `appsEditor.settingsStep.loadingLabel`. The overlay container SHALL NOT carry its own `aria-label`/`aria-live` — a name on a role-less `div` is not exposed, and adding `role="status"` there would nest a second live region around the Spinner's.

**RTL / UI impact**: The embedded editor handles its own directionality. The host-owned credentials dialog SHALL inherit the host direction and use the shared forms' logical spacing and wrapping, as specified in `catalog-application-credentials`.

#### Scenario: Iframe src includes applicationName

- **WHEN** `AppEditorIframe` renders with `schema.displayName = "Quick app 2.0"`
- **THEN** the iframe URL carries `applicationName=Quick+app+2.0`, which decodes to `Quick app 2.0` via `URLSearchParams`

#### Scenario: applicationName omitted when displayName is empty

- **WHEN** `AppEditorIframe` renders with `schema.displayName` empty or undefined
- **THEN** the iframe URL contains no `applicationName` parameter

#### Scenario: Iframe reloads when the schema display name changes

- **WHEN** `schema.displayName` changes while `AppEditorIframe` stays mounted
- **THEN** the iframe URL changes, the iframe reloads, and readiness (`ReadyToSave`) re-gates to false as for any other URL change

#### Scenario: Iframe src includes auth params

- **WHEN** `AppEditorIframe` renders with `schema.editorUrl = "https://editor.example.com"`, `appId = "abc"`, `providerId = "local"`, `themeId = "dark"` and both credential capability gates enabled
- **THEN** the iframe URL contains `authProvider=local`, `id=abc`, `theme=dark`, and `applicationCredentials=true`
- **AND** if either gate is disabled, `applicationCredentials=false` is supplied

#### Scenario: Iframe delegates Local Network Access to the embedded app

- **WHEN** `AppEditorIframe` renders
- **THEN** the `<iframe>` has `allow="local-network-access=*"`

#### Scenario: Spinner shown until iframe loads

- **WHEN** `AppEditorIframe` mounts
- **THEN** the `Spinner` is visible

#### Scenario: Spinner hidden after iframe load event

- **WHEN** the iframe fires the `load` event
- **THEN** the `Spinner` is no longer rendered

#### Scenario: Spinner hidden after readyToInteract postMessage

- **WHEN** a `message` event arrives with `data.type = "<displayName>/readyToInteract"`
- **THEN** the `Spinner` is no longer rendered

#### Scenario: onUpdated called on updatedApplicationSuccess

- **WHEN** a `message` event arrives with `data.type = "<displayName>/updatedApplicationSuccess"`
- **THEN** `onUpdated` is called

#### Scenario: Message listener removed on unmount

- **WHEN** `AppEditorIframe` unmounts
- **THEN** the `message` event listener added during mount is removed

#### Scenario: triggerSave posts TRIGGER_SAVE to the iframe

- **WHEN** `iframeRef.current.triggerSave()` is called and `schema.editorUrl` is `"https://editor.example.com"`
- **THEN** `iframe.contentWindow.postMessage({ type: 'TRIGGER_SAVE', general: undefined }, "https://editor.example.com")` is called

#### Scenario: SAVE_SUCCESS message calls onSaveSuccess

- **WHEN** a `message` event arrives with `data.type === 'SAVE_SUCCESS'`
- **THEN** the `onSaveSuccess` callback prop is called with the message's `hasChanges`, or `false` when the message omits it

#### Scenario: SAVE_ERROR message calls onSaveError with the error string

- **WHEN** a `message` event arrives with `data = { type: 'SAVE_ERROR', error: 'Invalid config' }`
- **THEN** `onSaveError('Invalid config')` is called

#### Scenario: SAVE_ERROR message without an error string still calls onSaveError

- **WHEN** a `message` event arrives with `data = { type: 'SAVE_ERROR' }`
- **THEN** `onSaveError('')` is called
