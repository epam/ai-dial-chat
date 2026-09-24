## MODIFIED Requirements

### Requirement: App editor iframe component

`apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` SHALL:

- Build the iframe URL with encoded `authProvider`, `id`, `theme`, and `applicationCredentials` query parameters.
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

**Accessibility**: The `<iframe>` SHALL have `title={schema.displayName}`. The spinner container SHALL have `aria-label` from `appsEditor.settingsStep.loadingLabel` and `aria-live="polite"`.

**RTL / UI impact**: The embedded editor handles its own directionality. The host-owned credentials dialog SHALL inherit the host direction and use the shared forms' logical spacing and wrapping, as specified in `catalog-application-credentials`.

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

## ADDED Requirements

### Requirement: Quick app Settings can open application credentials in the Chat host

`AppEditorIframe` SHALL handle `{ type: 'REQUEST_APPLICATION_CREDENTIALS', appId: string }` by opening a Chat-owned `Popup` containing `ApplicationCredentials` for the requested application. `appId` identifies the selected agent and SHALL NOT be assumed to be the Quick app being edited. The host SHALL normalize the raw editor id through the existing `encodeToolsetId` helper before calling its BFF adapter.

The handler SHALL require both credential capability gates, `event.origin` equal to the configured editor URL's origin, `event.source` equal to the current iframe's `contentWindow`, and a nonempty string `appId`. Messages failing these checks SHALL be ignored. No API key, OAuth code or token SHALL be exchanged through this message contract; no credential-result message or client-channel report is required. Core/BFF authorization SHALL still apply to the requested app.

`AppEditorIframe` SHALL own `credentialsAppId` in local state. Its `handleMessage` and iframe URL SHALL remain memoized with the feature gates included in their dependencies. The popup SHALL use `applicationCredentials.title`, the existing localized close label, and the shared form's explicit no-credentials empty state. Closing the popup or changing the iframe URL SHALL clear `credentialsAppId`; disabling either gate SHALL prevent rendering the popup. The editor iframe SHALL remain mounted while credentials are open, preserving unsaved settings and the existing save/readiness protocol. The host popup and controls SHALL be operable by keyboard and inherit RTL layout.

The external editor integration SHALL rely on the advertised query parameter: hosts without it or with `false` do not support this action. The companion Quick Apps implementation owns metadata detection and the chip/Advanced-settings entry points. The Chat host SHALL NOT require an active conversation, completion or client channel for this operation. No new feature key, backend endpoint beyond the external-service listing, cache or telemetry is introduced.

#### Scenario: A selected agent's credentials open without saving the Quick app

- **WHEN** the current editor sends a trusted request for `applications/public/agent with space` with both gates enabled
- **THEN** the host opens the shared forms for `applications/public/agent%20with%20space`
- **AND** the editor remains mounted without triggering save or completion

#### Scenario: Other origins or windows cannot request a credential dialog

- **WHEN** the message origin differs from the editor origin or its source is not the current iframe window
- **THEN** no credential dialog opens, even when the message type and application id are valid

#### Scenario: Disabled capability or invalid payload is ignored

- **WHEN** either feature gate is disabled or `appId` is empty or not a string
- **THEN** the host ignores the request and does not mount credential forms

#### Scenario: Closing credentials preserves editor settings

- **WHEN** the user closes the host credential dialog after editing unsaved Quick app transport settings
- **THEN** the dialog closes and its credential state is discarded
- **AND** the iframe's unsaved transport settings remain unchanged

#### Scenario: A different iframe URL dismisses the previous dialog

- **WHEN** the iframe URL changes while a credential dialog is open
- **THEN** the host clears the previous requested application id and closes the dialog

#### Scenario: A requested application needs no credentials

- **WHEN** the trusted request targets an application whose listing has no authenticated services
- **THEN** the host dialog displays the localized no-credentials-required state and remains closable
