## MODIFIED Requirements

### Requirement: App editor iframe component

`apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` SHALL:

- Build the iframe src as: `${schema.editorUrl}?authProvider=${providerId}&id=${encodeURIComponent(appId)}&theme=${themeId}`
  - `providerId` from `useUser().user?.providerId`
  - `themeId` from `useTheme().currentTheme`
- Render a full-height `<iframe>` (`className="size-full border-none"`) with `allow="local-network-access=*"` so the embedded app — and any window it opens via `window.open` (e.g. an identity-provider login popup) — can request and receive the Local Network Access permission when the embedded app's or its identity provider's origin resolves to a private/internal IP address.
- Show a `<Spinner />` overlay until the iframe dispatches `load` or fires a `readyToInteract` postMessage event; after either, hide the spinner.
- Add a `window.addEventListener('message', handleMessage)` listener on mount and remove it on unmount (`useEffect` cleanup).
- In `handleMessage`, after verifying `event.origin` matches `schema.editorUrl`'s origin:
  - `event.data.type === \`${displayName}/${AppsEditorEvent.ReadyToInteract}\`` → set loading=false
  - `event.data.type === \`${displayName}/${AppsEditorEvent.UpdatedSuccess}\`` → call the optional `onUpdated` callback prop
  - `event.data.type === AppsEditorEvent.SaveSuccess` → call the optional `onSaveSuccess` callback prop with the message's `hasChanges` normalized to a strict boolean
  - `event.data.type === AppsEditorEvent.SaveError` → call the optional `onSaveError` callback prop with `event.data.error ?? ''`
- `AppsEditorEvent` (in `apps/chat/src/types/apps-editor.ts`) SHALL include at least `ReadyToInteract = 'readyToInteract'`, `UpdatedSuccess = 'updatedApplicationSuccess'`, `TriggerSave = 'TRIGGER_SAVE'`, `SaveSuccess = 'SAVE_SUCCESS'`, `SaveError = 'SAVE_ERROR'`. Further members carry the readiness and toolset-login parts of the protocol and are owned by the `quick-app-authoring` capability.
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

**RTL / UI impact**: None — iframe content handles its own directionality.

#### Scenario: Iframe src includes auth params

- **WHEN** `AppEditorIframe` renders with `schema.editorUrl = "https://editor.example.com"`, `appId = "abc"`, `providerId = "local"`, `themeId = "dark"`
- **THEN** the `<iframe>` `src` is `"https://editor.example.com?authProvider=local&id=abc&theme=dark"`

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
