# Spec: app-editor-flow

## Purpose

Defines the `/apps-editor` route: a two-step (General → Settings) application authoring flow that creates an application via the backend and then hands off configuration to the schema's own editor, embedded as an iframe and driven by a postMessage save protocol.
## Requirements
### Requirement: Apps-editor route exists and is accessible

`apps/chat/src/types/routes.ts` SHALL add `AppsEditor = '/apps-editor'` to the `ROUTES` enum.

`apps/chat/src/app/app.tsx` SHALL register a lazy-loaded route for `ROUTES.AppsEditor`:
```tsx
const AppsEditorPage = lazy(() => import('../pages/AppsEditor/AppsEditor'));
// inside <Routes>:
<Route path={ROUTES.AppsEditor} element={
  <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <AppsEditorPage />
    </Suspense>
  </RouteErrorBoundary>
} />
```

**i18n impact**: See key table in the editor page requirement below.

**RTL / UI impact**: Logical CSS properties SHALL be used for horizontal spacing/alignment. Icons SHALL be mirrored in RTL where directional.

#### Scenario: Navigating to /apps-editor renders the page

- **WHEN** the user navigates to `/apps-editor?step=general&schema=<id>&returnUrl=/catalog&isCreating=1`
- **THEN** the `AppsEditorPage` component renders without a full-page error

#### Scenario: Route is lazy-loaded

- **WHEN** the user visits the catalog for the first time without navigating to /apps-editor
- **THEN** the AppsEditorPage module is NOT in the initial JS bundle

---

### Requirement: Apps-editor query param contract

`apps/chat/src/types/apps-editor.ts` SHALL export the query and step enums:

```ts
export enum AppsEditorQuery {
  Step = 'step',
  Schema = 'schema',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
  AppId = 'appId',
}

export enum AppsEditorStep {
  General = 'general',
  Settings = 'settings',
}
```

`apps/chat/src/constants/apps-editor.ts` SHALL export the shared truthy query value:

```ts
export const QUERY_VALUE_TRUE = '1';
```

The `AppsEditorPage` SHALL read all params exclusively via `useSearchParams` from `react-router-dom`.

**RTL / UI impact**: None (constants only).

#### Scenario: Step param defaults to general when absent

- **WHEN** the user navigates to `/apps-editor` without a `step` query param
- **THEN** the page renders the General step

---

### Requirement: A Settings-step save reasserts features.skills_supported via a follow-up updateApplication call

The embedded Settings-step editor (loaded from `schema.editorUrl`) SHALL persist a Settings-step
save entirely on its own — `AppsEditor` never calls the backend `updateApplication` endpoint
itself for that save, it only posts `TriggerSave` to the iframe and reacts to the `SAVE_SUCCESS`/
`SAVE_ERROR` postMessage the iframe posts back. That embedded editor is a separate application,
not owned by this repository, and has no reason to know about the chat-side `skills_supported`
hack described in the `applications-write-api` spec's "Quick Apps always get
features.skills_supported: true" requirement — its own save may leave the flag unset or
overwrite it back to its prior value.

To close that gap without needing to change the embedded editor's protocol, `AppsEditor`'s
`handleSaveSuccess` SHALL, immediately after receiving a `SAVE_SUCCESS` message (for both a
Save & Exit and a Preview trigger, since both perform a real save through the iframe) and
before any of its existing success side effects (`refetchDeployments`, `notifyOperationSuccess`,
navigation, entering preview), call the frontend `updateApplication` API for `appIdForSettings`
with the current General-step values (`name`, `description`, `iconUrl`, `topics`, `locales`,
`primaryLocale`, read via `generalFormRef.current.getValues()`) and **await** its result. This
call's only purpose is to re-trigger the backend's unconditional `skills_supported` force-merge
on every update — the General-step values are sent unchanged (a no-op for those fields) so this
call otherwise has no visible effect for a non-Quick-App schema, where the backend's
`isQuickAppSchema` check makes the force-merge itself a no-op too.

`AppsEditor` SHALL wait for this call to settle before proceeding: on success, the existing
success-path side effects run as before; on failure, `AppsEditor` SHALL stop before running any
of them — no `refetchDeployments`, no `notifyOperationSuccess`, no navigation, no entering
preview — and SHALL surface the failure the same way `SAVE_ERROR` from the iframe is surfaced
(`isSaving` becomes false, `pendingSaveAction` is cleared, `saveError` is set to the generic
"save failed" message, rendered via `Notification`). The page stays on the Settings step.

#### Scenario: Reassertion call runs before Save & Exit's side effects

- **WHEN** the iframe posts `SAVE_SUCCESS` for a Save & Exit trigger
- **THEN** `updateApplication(appIdForSettings, { name, description, iconUrl, topics, locales, primaryLocale })` is called and awaited before `refetchDeployments()`, `notifyOperationSuccess`, and navigation to `returnUrl`

#### Scenario: Reassertion call runs before Preview's side effects

- **WHEN** the iframe posts `SAVE_SUCCESS` for a Preview trigger
- **THEN** the reassertion `updateApplication` call is awaited before `refetchDeployments()` and before `isPreviewing` becomes true
- **AND** `refetchDeployments()` itself is awaited too when the save reported `hasChanges: true`; it remains fire-and-forget when the save reported `hasChanges: false`

#### Scenario: A failed reassertion call blocks the rest of the success path

- **WHEN** the reassertion `updateApplication` call rejects
- **THEN** `isSaving` becomes false, `saveError` is set to the generic save-failed message, `pendingSaveAction` is cleared, and no `refetchDeployments`, `notifyOperationSuccess`, navigation, or `isPreviewing` transition occurs

#### Scenario: A successful reassertion call does not alter General-step data

- **WHEN** the reassertion call succeeds
- **THEN** the `name`/`description`/`iconUrl`/`topics`/`locales`/`primaryLocale` values it sent are identical to what `generalFormRef.current.getValues()` already held, so the update is a no-op for every field except the backend's forced `features.skills_supported`

---

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

### Requirement: Server-api wrapper for createApplication

`apps/chat/src/server-api/applications.ts` SHALL export:

```ts
export const createApplication = (
  body: CreateApplicationBodyDto,
): Promise<CreatedApplicationDto> =>
  applicationsApi.createApplication({ createApplicationBodyDto: body });
```

Where `applicationsApi` is the generated `ApplicationsApi` instance (from `api-client.ts`), and `CreateApplicationBodyDto` / `CreatedApplicationDto` are the generated request and response models from `@epam/ai-dial-chat-api-client`.

**i18n impact**: None.

#### Scenario: createApplication calls generated client

- **WHEN** `createApplication({ name: 'My App', type: 'https://...' })` is called
- **THEN** `applicationsApi.createApplication` is invoked with the matching body

---

### Requirement: Application ID encoding contract

Application IDs returned by `POST /api/v1/applications` (`createApplication` in `apps/chat-api/src/applications/applications.service.ts`) SHALL have their name component percent-encoded (`encodeURIComponent`) before being included in the response `id` field. This makes the create response consistent with IDs returned by `GET /api/v1/applications`, which are passed through from DIAL Core where they are always stored percent-encoded.

**Invariant**: `CreatedApplicationDto.id` satisfies `/^(?:[\w.\-:@/()]|%[\dA-Fa-f]{2})+$/` — the same pattern `DEPLOYMENT_ID_PATTERN` enforces on `CreateConversationDto.deploymentId` in `apps/chat-api/src/conversations/`.

`AppPreviewChat` SHALL normalize the `appId` prop before forwarding it as `deploymentId` to `createConversation`. The normalization (`normalizeDeploymentId` in `AppPreviewChat.tsx`) is idempotent: it splits on `/`, decodes each segment with `decodeURIComponent` (falling back to `encodeURIComponent` on malformed sequences), then re-encodes with `encodeURIComponent`. This handles both:
- Already-encoded IDs — from apps created after the encoding fix (no double-encoding).
- Legacy IDs with raw spaces — from apps created before the fix, where `searchParams.get(AppsEditorQuery.AppId)` returns the raw percent-decoded string after a page reload.

**`startStream` is exempt**: `appId` forwarded as the model identifier to `startStream` is the raw prop value; it is not sent as `deploymentId` to the conversations creation endpoint and is not subject to `DEPLOYMENT_ID_PATTERN`.

#### Scenario: createApplication response ID is percent-encoded

- **WHEN** `POST /api/v1/applications` is called with `name = "No Temp 3"` and `version = "0.0.1"`
- **THEN** the response `id` is `"applications/<bucket>/No%20Temp%203__0.0.1"` (space → `%20`)
- **AND** `GET /api/v1/applications` returns the same percent-encoded ID for this application

#### Scenario: AppPreviewChat normalizes a legacy raw-space appId before creating a conversation

- **WHEN** `AppPreviewChat` receives `appId = "applications/<bucket>/No Temp 3__0.0.1"` (raw space, from a pre-fix app)
- **AND** the user sends a first message
- **THEN** `POST /api/v1/conversations` is called with `deploymentId = "applications/<bucket>/No%20Temp%203__0.0.1"`
- **AND** the request succeeds (no 400 from `DEPLOYMENT_ID_PATTERN`)

#### Scenario: normalizeDeploymentId is idempotent on already-encoded IDs

- **WHEN** `appId = "applications/<bucket>/No%20Temp%203__0.0.1"` (already encoded, from a post-fix app)
- **THEN** `POST /api/v1/conversations` is called with `deploymentId = "applications/<bucket>/No%20Temp%203__0.0.1"` (unchanged — no double-encoding to `%2520`)

---

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

### Requirement: Quick-app editor renders a single Metadata | Setup page

The Quick App editor SHALL be rendered by `ApplicationEditorPage` with `kind = ApplicationEditorKind.QuickApp` (see `application-editor-registry`) on the unchanged route `ROUTES.AppsEditor`.

It uses the `schema`, `appId` and `returnUrl` query params. `step` and `isCreating` are accepted and ignored.

The page renders the shared `EntityEditor` layout:

- **Header.**
  - Back arrow.
  - Title: `appsEditor.createTitle` or `appsEditor.editTitle`, interpolating the schema `displayName`, with `appsEditor.defaultTypeName` as the fallback.
  - A Preview / Exit preview `GhostButton` in `extraActions`, with `aria-pressed` reflecting `isPreviewing`.
  - Cancel.
  - A Create button in create mode, or a Save button in edit mode.
- **Metadata section (left).** The shared `MetadataForm` with every field (see `quick-app-authoring` "Metadata section fields").
- **Setup section (right).** `QuickAppSetup` (see "Quick-app Setup section").

The page SHALL NOT render a step indicator, a Next button or the General-step Card preview.

**Create mode** (no `appId`) uses `ApplicationCreateStrategy.MetadataFirst`:

1. Clicking Create validates the metadata.
2. It calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })` through `apps/chat/src/server-api/applications.ts`. `applicationProperties` seeds the same empty orchestrator/contexts/tool_sets defaults as before.
3. It raises the `NotifiableEntity.QuickApp` + `EntityOperation.Created` notification.
4. It replaces the search params to add `appId`, which switches the page into edit mode in place.

A create failure raises an error notification with the API detail, falling back to `appsEditor.error.createFailed`, and re-enables the actions.

**Edit mode** (`appId` present):

- Save arms the save timeout and calls `QuickAppSetup`'s `save(metadata)` handle, which posts `TriggerSave` with the `general` payload.
- On `SaveSuccess`, the page does the following, in order:
  1. Awaits the `features.skills_supported` `updateApplication` reassertion (see "A Settings-step save reasserts features.skills_supported via a follow-up updateApplication call").
  2. Awaits `refetchDeployments()`.
  3. Raises `EntityOperation.Edited`.
  4. Navigates to `returnUrl`.
- On `SaveError`, the page clears `isSaving`, the Setup section shows the error or `appsEditor.error.saveFailed` inline above the embedded editor, and the page stays open.

**Preview** (edit mode only):

- Preview triggers a save with no `general` payload. On `SaveSuccess`, `isPreviewing` becomes true.
- When `hasChanges` is true, the page first awaits `refetchDeployments()`, with the saving overlay kept visible. A rejected refetch is logged and does not block preview.
- While previewing, `hideStandardActions` hides Cancel and Save, and Exit preview returns to the editor.

**Other**

- Memoisation: the resolved schema, `returnUrl` and header callbacks SHALL be memoised (`useMemo`/`useCallback`).
- Schema not found: the page still renders, using the fallback title, without throwing.
- The saving overlay marks the content `inert`.

#### Scenario: Create mode shows Metadata and a pending Setup
- **WHEN** the page mounts with `?schema=<id>&returnUrl=/catalog` and no `appId`
- **THEN** the Metadata section renders the shared fields
- **AND** the Setup section shows "Create the application to configure its setup."
- **AND** the header shows Create, with no Preview enabled

#### Scenario: Create switches to edit mode and loads the editor iframe
- **WHEN** the user fills Name and clicks Create, and `POST /api/v1/applications` returns `{ id: "new-id" }`
- **THEN** `appId=new-id` is added to the URL with `replace`
- **AND** the header shows the edit title and Save
- **AND** the Setup section renders the schema editor iframe for `new-id`

#### Scenario: Create API failure shows error message
- **WHEN** `POST /api/v1/applications` responds with a non-2xx status
- **THEN** an error notification is shown and the Create button is re-enabled

#### Scenario: Save triggers iframe save and navigates on success
- **WHEN** in edit mode the user clicks Save and the iframe posts `SAVE_SUCCESS`
- **THEN** the page awaits the `updateApplication` reassertion and `refetchDeployments()`, shows the edited notification, and navigates to `returnUrl`

#### Scenario: Save failure shows inline error and stays on the page
- **WHEN** the iframe posts `SAVE_ERROR`
- **THEN** `isSaving` becomes false, the error renders inline in the Setup section, and the page does NOT navigate away

#### Scenario: Preview awaits a fresh deployment list when settings changed
- **WHEN** the user clicks Preview and the save reports `hasChanges: true`
- **THEN** the saving overlay stays visible until `refetchDeployments()` settles, then `isPreviewing` becomes true, and only Exit preview is shown in the header

#### Scenario: Legacy step param is ignored
- **WHEN** the page mounts with `?step=settings&schema=<id>&appId=<appId>`
- **THEN** the single page renders in edit mode, with no error and no step UI

#### Scenario: Page content is not clipped below the mobile global header
- **WHEN** the page renders at a mobile viewport, where the app-wide mobile-only global header is rendered above the routed content
- **THEN** the content area reaches the true bottom of the viewport and remains scrollable to its end

### Requirement: Quick-app Setup section

`QuickAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`, which replaces `SettingsStep.tsx`) SHALL be a `forwardRef` component implementing `ApplicationSetupHandle`. Its `save(metadata)` forwards to the inner `AppEditorIframe`'s `triggerSave(general)`, and its `triggerPreviewSave()` forwards to `triggerSave()` with no payload.

It SHALL render the following:

- Without `appId` (create mode): the `applicationEditor.setupPendingCreate` placeholder.
- With `appId` and `schema.editorUrl`: `AppEditorIframe`, kept mounted and hidden while `AppPreviewChat` is shown as an absolutely positioned sibling during preview.
- With `appId` but no `schema.editorUrl`: the `appsEditor.settingsStep.noEditorPlaceholder` placeholder.

It SHALL report iframe readiness through `onReadyChange`, which gates the Save button and Preview (see `quick-app-authoring`).

On mobile, the Setup section SHALL give the iframe a minimum height of 640 px so it stays usable below the stacked Metadata section.

#### Scenario: Schema with editorUrl renders iframe once the app exists
- **WHEN** `schema.editorUrl` is set and `appId` is `"abc"`
- **THEN** `AppEditorIframe` is rendered

#### Scenario: Schema without editorUrl renders placeholder
- **WHEN** `appId` is set and `schema.editorUrl` is undefined
- **THEN** the no-editor placeholder renders and `save()` resolves without posting a message

#### Scenario: No appId renders the pending-create placeholder
- **WHEN** `appId` is undefined
- **THEN** the pending-create placeholder renders and no iframe is mounted

### Requirement: Unit tests for the quick-app definition

`apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx` SHALL cover the following. All API calls SHALL be mocked via `vi.mock`.

1. Create mode renders the Metadata fields and the pending Setup placeholder.
2. Empty name shows the required error and does not call the API.
3. A name with forbidden characters, or a non-semver version, shows the invalid error and does not call the API.
4. A valid create calls `createApplication` with the correct body and seeded `applicationProperties`, then switches to edit mode with `appId`.
5. Save in edit mode posts `TriggerSave` with a `general` payload that carries `display_version`, omits `version`, and includes `locales`/`primaryLocale` when configured.
6. A create API failure renders the error.

#### Scenario: Unit test — empty name shows error
- **WHEN** Create is clicked with an empty name field
- **THEN** the validation error message is visible in the DOM and `createApplication` is not called
