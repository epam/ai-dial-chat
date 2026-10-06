# Spec: app-editor-flow

## Purpose

Defines the `/apps-editor` route: a two-step (General → Settings) application authoring flow that creates an application via the backend and then hands off configuration to the schema's own editor, embedded as an iframe and driven by a postMessage save protocol.
## Requirements
### Requirement: Apps-editor route exists and is accessible

`apps/chat/src/types/routes.ts` SHALL add `AppsEditor = '/apps-editor'` to the `ROUTES` enum.

`apps/chat/src/app/app.tsx` SHALL register a lazy-loaded route for `ROUTES.AppsEditor`:
```tsx
const ApplicationEditorPage = lazy(
  () => import('../pages/ApplicationEditor/ApplicationEditorPage'),
);
// inside <Routes>:
<Route path={ROUTES.AppsEditor} element={
  <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <ApplicationEditorPage kind={ApplicationEditorKind.QuickApp} />
    </Suspense>
  </RouteErrorBoundary>
} />
```

The route serves every application schema: `ApplicationEditorPage` resolves the kind with `resolveSchemaEditorKind` (`apps/chat/src/utils/application-editor.ts`), which switches to `ApplicationEditorKind.SchemaApp` when the `schema` param names a known schema without an `editorUrl`, and otherwise keeps `QuickApp`.

**i18n impact**: See key table in the editor page requirement below.

**RTL / UI impact**: Logical CSS properties SHALL be used for horizontal spacing/alignment. Icons SHALL be mirrored in RTL where directional.

#### Scenario: Navigating to /apps-editor renders the page

- **WHEN** the user navigates to `/apps-editor?schema=<id>`
- **THEN** the `ApplicationEditorPage` component renders without a full-page error

#### Scenario: Route is lazy-loaded

- **WHEN** the user visits the catalog for the first time without navigating to /apps-editor
- **THEN** the ApplicationEditorPage module is NOT in the initial JS bundle

---

### Requirement: Apps-editor query param contract

`apps/chat/src/types/apps-editor.ts` SHALL export the query enum:

```ts
export enum AppsEditorQuery {
  Schema = 'schema',
  AppId = 'appId',
}
```

`schema` names the application schema; `appId` is present only when an existing application is edited. The editor has no steps, and it always returns to `ROUTES.Catalog`, so there is no `step`, `isCreating` or `returnUrl` param.

The editor SHALL read all params exclusively via `useSearchParams` from `react-router`.

**RTL / UI impact**: None (constants only).

#### Scenario: Create mode without an app id

- **WHEN** the user navigates to `/apps-editor?schema=<id>` without an `appId` query param
- **THEN** the page renders in create mode

#### Scenario: Legacy params are ignored

- **WHEN** the URL still carries `step`, `isCreating` or `returnUrl` (e.g. an old bookmark)
- **THEN** the page renders as if they were absent, with no error and no step UI

---

### Requirement: A Settings-step save reasserts features.skills_supported via a follow-up updateApplication call

The embedded Setup editor (loaded from `schema.editorUrl`) SHALL persist a Setup save entirely
on its own — the chat host never calls the backend `updateApplication` endpoint for the
configuration itself, it only posts `TriggerSave` to the iframe and reacts to the `SAVE_SUCCESS`/
`SAVE_ERROR` postMessage the iframe posts back. That embedded editor is a separate application,
not owned by this repository, and has no reason to know about the chat-side `skills_supported`
hack described in the `applications-write-api` spec's "Quick Apps always get
features.skills_supported: true" requirement — its own save may leave the flag unset or
overwrite it back to its prior value.

To close that gap without changing the embedded editor's protocol, `QuickAppSetup`
(`apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`) SHALL, in both its `save(values)`
and `startPreview(values)` handles and immediately after the iframe save resolves with
`SAVE_SUCCESS`, call `reassertSkillsSupport(values)`: the frontend `updateApplication(appId, …)` API
with the current Metadata values (`name`, `description`, `iconUrl`, `topics`, `locales`,
`primaryLocale`, derived through `toTriggerSaveGeneral(values)`), and **await** it. This call's only
purpose is to re-trigger the backend's unconditional `skills_supported` force-merge on every
update — the Metadata values are sent unchanged (a no-op for those fields), so for a non-Quick-App
schema, where the backend's `isQuickAppSchema` check makes the force-merge a no-op too, the call
has no visible effect.

The save only counts as successful once this call settles. On success, `save`/`startPreview`
resolve and the page's success path runs (`ApplicationFormEditor`'s `persist`: `refetchDeployments()`,
`notifyOperationSuccess`, navigation to `ROUTES.Catalog`; or, for Preview, `isPreviewing` becoming
true). On failure, `QuickAppSetup` SHALL set its inline `saveError` to `appsEditor.error.saveFailed`
(rendered through `ErrorMessageNotification` above the iframe) and rethrow, so the page stops
before any of those side effects — no `refetchDeployments`, no `notifyOperationSuccess`, no
navigation, no entering preview — and the page clears `isSaving` and stays open.

#### Scenario: Reassertion call runs before Save's side effects

- **WHEN** the iframe posts `SAVE_SUCCESS` for a Save trigger
- **THEN** `updateApplication(appId, { name, description, iconUrl, topics, locales, primaryLocale })` is called and awaited before `refetchDeployments()`, `notifyOperationSuccess`, and navigation to `ROUTES.Catalog`

#### Scenario: Reassertion call runs before Preview's side effects

- **WHEN** the iframe posts `SAVE_SUCCESS` for a Preview trigger
- **THEN** the reassertion `updateApplication` call is awaited before `refetchDeployments()` and before `isPreviewing` becomes true
- **AND** `refetchDeployments()` itself is awaited too when the save reported `hasChanges: true`; it remains fire-and-forget when the save reported `hasChanges: false`

#### Scenario: A failed reassertion call blocks the rest of the success path

- **WHEN** the reassertion `updateApplication` call rejects
- **THEN** `isSaving` becomes false, the Setup section's inline `saveError` is set to the generic save-failed message, and no `refetchDeployments`, `notifyOperationSuccess`, navigation, or `isPreviewing` transition occurs

#### Scenario: A successful reassertion call does not alter General-step data

- **WHEN** the reassertion call succeeds
- **THEN** the `name`/`description`/`iconUrl`/`topics`/`locales`/`primaryLocale` values it sent are identical to the Metadata values already passed to `save`/`startPreview`, so the update is a no-op for every field except the backend's forced `features.skills_supported`

---

### Requirement: App editor iframe component

`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` SHALL:

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

**Accessibility**: The `<iframe>` SHALL have `title={schema.displayName}`. The loading overlay SHALL expose exactly one status region: the kit `Spinner` (itself `role="status"`, wrapping a `role="img"`) SHALL receive `ariaLabel` from `appsEditor.settingsStep.loadingLabel`. The overlay container SHALL NOT carry its own `aria-label`/`aria-live` — a name on a role-less `div` is not exposed, and adding `role="status"` there would nest a second live region around the Spinner's.

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

**Invariant**: `CreatedApplicationDto.id` satisfies `/^(?:[\w.\-:@/()]|%[\dA-Fa-f]{2})+$/` — the same pattern `DEPLOYMENT_ID_PATTERN` (`apps/chat-api/src/common/validators/deployment-id.pattern.ts`) enforces on `CreateConversationDto.deploymentId`.

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

`AppEditorIframe` SHALL handle `{ type: 'REQUEST_APPLICATION_CREDENTIALS', appId: string }` by opening a Chat-owned `Popup` containing `ApplicationCredentials` for the requested application. `appId` identifies the selected agent and SHALL NOT be assumed to be the Quick app being edited. The host SHALL normalize the raw editor id through `normalizeDeploymentId` (from `@epam/ai-dial-chat-hooks`, decode-then-encode, idempotent) before calling its BFF adapter.

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

The Quick App editor SHALL be rendered by `ApplicationEditorPage` with `kind = ApplicationEditorKind.QuickApp` (see `application-editor-registry`) on the unchanged route `ROUTES.AppsEditor`, which renders `ApplicationFormEditor` with `quickAppDefinition` (`apps/chat/src/pages/ApplicationEditor/definitions/quickAppDefinition.tsx`). Any schema with an embedded editor opens here; Preview is offered only for the Quick Apps schema (`isPreviewAvailable` → `isQuickAppSchema`).

It uses the `schema` and `appId` query params (see "Apps-editor query param contract"); any legacy `step`, `isCreating` or `returnUrl` param is ignored.

The page renders the shared `EntityEditor` layout:

- **Header.**
  - Back arrow.
  - Title: `appsEditor.createTitle` or `appsEditor.editTitle`, interpolating the schema `displayName`, with `appsEditor.defaultTypeName` as the fallback.
  - In edit mode, an enter-only Preview `GhostButton` in `extraActions` (no `aria-pressed`; see `app-preview-chat` "EditorHeader preview button").
  - Cancel.
  - A Create button in create mode, or a Save button in edit mode.
- **Metadata section (left).** The shared `MetadataForm` with every field (see `quick-app-authoring` "Metadata section fields").
- **Setup section (right).** `QuickAppSetup` (see "Quick-app Setup section").

The page SHALL NOT render a step indicator, a Next button or the General-step Card preview.

**Create mode** (no `appId`) uses `ApplicationCreateStrategy.MetadataFirst`:

1. Clicking Create validates the metadata.
2. It calls `createApplication({ name, type: schemaId, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })` through `apps/chat/src/server-api/applications.ts`. For the Quick Apps schema, `applicationProperties` seeds the empty orchestrator/contexts/tool_sets defaults; for any other schema it is omitted.
3. It raises the `NotifiableEntity.QuickApp` + `EntityOperation.Created` notification.
4. It replaces the search params to add `appId`, which switches the page into edit mode in place.

A create failure raises an error notification with the API detail, falling back to `appsEditor.error.createFailed`, and re-enables the actions.

**Edit mode** (`appId` present):

- Save arms the save timeout and calls `QuickAppSetup`'s `save(metadata)` handle, which posts `TriggerSave` with the `general` payload.
- On `SaveSuccess`, the page does the following, in order:
  1. Awaits the `features.skills_supported` `updateApplication` reassertion (see "A Settings-step save reasserts features.skills_supported via a follow-up updateApplication call").
  2. Awaits `refetchDeployments()`.
  3. Raises `EntityOperation.Edited`.
  4. Navigates to `returnUrl`, which is always `ROUTES.Catalog`.
- On `SaveError`, the page clears `isSaving`, the Setup section shows the error or `appsEditor.error.saveFailed` inline above the embedded editor, and the page stays open.

**Preview** (edit mode only):

- Preview triggers a save with no `general` payload. On `SaveSuccess`, `isPreviewing` becomes true.
- When `hasChanges` is true, the page first awaits `refetchDeployments()`, with the saving overlay kept visible. A rejected refetch is logged and does not block preview.
- While previewing, the whole `EntityEditor` is hidden (still mounted, `inert`) and the definition's `Preview` component (`QuickAppPreview`) fills the page. Its "Back to setup" button returns to the editor (see `app-preview-chat` "Preview is a full-page mode").

**Other**

- Memoisation: the resolved schema and header callbacks SHALL be memoised (`useMemo`/`useCallback`); `returnUrl` is the constant `ROUTES.Catalog`.
- Schema not found: the page still renders, using the fallback title, without throwing.
- The saving overlay marks the content `inert`.

#### Scenario: Create mode shows Metadata and a pending Setup
- **WHEN** the page mounts with `?schema=<id>` and no `appId`
- **THEN** the Metadata section renders the shared fields
- **AND** the Setup section shows "Create the application to configure its setup." with a Create button
- **AND** the header shows Create, with no Preview button

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
- **THEN** the page awaits the `updateApplication` reassertion and `refetchDeployments()`, shows the edited notification, and navigates to `ROUTES.Catalog`

#### Scenario: Save failure shows inline error and stays on the page
- **WHEN** the iframe posts `SAVE_ERROR`
- **THEN** `isSaving` becomes false, the error renders inline in the Setup section, and the page does NOT navigate away

#### Scenario: Preview awaits a fresh deployment list when settings changed
- **WHEN** the user clicks Preview and the save reports `hasChanges: true`
- **THEN** the saving overlay stays visible until `refetchDeployments()` settles, then `isPreviewing` becomes true, the editor is hidden, and the full-page preview with "Back to setup" is shown

#### Scenario: Legacy step param is ignored
- **WHEN** the page mounts with `?step=settings&schema=<id>&appId=<appId>`
- **THEN** the single page renders in edit mode, with no error and no step UI

#### Scenario: Page content is not clipped below the mobile global header
- **WHEN** the page renders at a mobile viewport, where the app-wide mobile-only global header is rendered above the routed content
- **THEN** the content area reaches the true bottom of the viewport and remains scrollable to its end

### Requirement: Quick-app Setup section

`QuickAppSetup` (`apps/chat/src/pages/ApplicationEditor/setup/QuickAppSetup.tsx`, which replaces `SettingsStep.tsx`) SHALL be a function component that receives `ref` as a prop (React 19, no `forwardRef`) and exposes `ApplicationSetupHandle` through `useImperativeHandle`. Its `save(metadata)` forwards to the inner `AppEditorIframe`'s `triggerSave(general)`, and its `startPreview(metadata)` forwards to `triggerSave()` with no payload.

It SHALL render the following:

- Without `appId` (create mode): the `applicationEditor.setupPendingCreate` placeholder, with a `PrimaryButton` Create that calls `onSubmit` (disabled while `isSubmitting`).
- With `appId` and `schema.editorUrl`: `AppEditorIframe` only. `QuickAppSetup` SHALL NOT render `AppPreviewChat`. The preview chat is rendered at page level by `QuickAppPreview` (see `app-preview-chat` "Preview is a full-page mode"), and the iframe stays mounted while preview is shown because the whole `EntityEditor` is only hidden.
- With `appId` but no `schema.editorUrl`: the `appsEditor.settingsStep.noEditorPlaceholder` placeholder.

It SHALL report iframe readiness through `onReadyChange`, which gates the Save button and Preview (see `quick-app-authoring`). It SHALL call `onPreviewReset` when a save reports `hasChanges: true` (see `app-preview-chat` "Preview session resets when the saved configuration actually changed"). `ApplicationSetupProps` no longer carries `isPreviewing`.

The Setup section SHALL give the iframe container a minimum height of 640 px (`min-h-[640px]`, applied at every width) so it stays usable below the stacked Metadata section on mobile.

#### Scenario: Schema with editorUrl renders iframe once the app exists
- **WHEN** `schema.editorUrl` is set and `appId` is `"abc"`
- **THEN** `AppEditorIframe` is rendered and no preview chat region is rendered inside the Setup section

#### Scenario: Schema without editorUrl renders placeholder
- **WHEN** `appId` is set and `schema.editorUrl` is undefined
- **THEN** the no-editor placeholder renders and `save()` resolves without posting a message

#### Scenario: No appId renders the pending-create placeholder
- **WHEN** `appId` is undefined
- **THEN** the pending-create placeholder renders and no iframe is mounted

#### Scenario: A real change requests a preview reset
- **WHEN** `startPreview` or `save` receives `SaveSuccess` with `hasChanges: true` and the reassertion succeeds
- **THEN** `onPreviewReset` is called exactly once
- **AND** with `hasChanges: false` it is not called

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
