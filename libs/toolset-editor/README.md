# @epam/ai-dial-toolset-editor

Host-agnostic form for authoring and editing a DIAL MCP toolset: the composed
`ToolsetEditor` (Metadata + Setup two-column layout, validation, save/persist
orchestration, and the API-key login flow) plus the shared `GeneralForm`
metadata field set that the Custom App editor also consumes.

The lib is deliberately passive about everything a host owns. It holds the form
state, the dirty-field/error state, and the draft toolset id created by the
first persist of a create session — and nothing else: it never calls an API
(persistence, login, logout, and auth-settings reads arrive through
`onPersist`/`onPostSaveLogin`/`authActions`), never runs the OAuth flow
(`onOAuthLogin` hands the whole flow — popup, callback route, credentials
level, redirect coordination — to the host and gets back a
`ToolsetOAuthLoginResult`), never reads a route or context (navigation is
`onBack`/`onSaveComplete`), never constructs the MCP connect URL
(`buildMcpUrl` is a host resolver, because the URL depends on the draft id the
lib itself creates), and never resolves a translation (every string arrives via
optional `labels` groups with English defaults). Validation delegates the
name/version checks to `@epam/ai-dial-builder-form`'s
`validateDeploymentCreationFields`, so the toolset editor and the Quick/Custom
App editors share one field contract.

`SettingsForm`, `AuthSection`, and `ConnectMcpUrlContent` are internal — they
are rendered by `ToolsetEditor` and are not exported. Only their `*Labels`
types are exported so a host can type the label groups it threads into
`ToolsetEditorProps.labels`.

This library depends on `@epam/ai-dial-chat-hooks` for shared form vocabulary
only — `ToolsetAuthTypes`, `WithLogin`, `ToolsetCredentialsLevel` and
`getApiErrorDetails`. The OAuth transport helpers live on the host side of
`onOAuthLogin`. The dependency is root-barrel only — never import a
`@epam/ai-dial-chat-hooks/` subpath.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-toolset-editor": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-toolset-editor/styles.css';
```

## Peer Dependencies

- `react` `^19.2.8`
- `@epam/ai-dial-ui-kit` `^0.15.0-dev.18`
- `@epam/ai-dial-chat-shared` `*`
- `@epam/ai-dial-chat-hooks` `*`

## Components

### `ToolsetEditor`

```tsx
import { ToolsetAuthTypes } from '@epam/ai-dial-chat-hooks';
import {
  getDefaultToolsetForm,
  ToolsetEditor,
} from '@epam/ai-dial-toolset-editor';
import type {
  ToolsetAuthActions,
  ToolsetFormData,
} from '@epam/ai-dial-toolset-editor';

const ToolsetEditorPage = () => {
  // Loaded before the editor renders; a new object identity re-seeds the editor.
  const [initialForm, setInitialForm] = useState<ToolsetFormData | undefined>();

  const authActions: ToolsetAuthActions = {
    login: (toolsetId, body) => api.loginToolset(toolsetId, body),
    logout: (toolsetId, body) => api.logoutToolset(toolsetId, body),
    fetchAuthSettings: (toolsetId) => api.fetchToolsetAuthSettings(toolsetId),
  };

  if (!initialForm) return <Loading />;

  return (
    <ToolsetEditor
      initialForm={initialForm}
      toolsetId={routeToolsetId}
      onPersist={async (form, toolsetId) => {
        const body = mapFormToRequestBody(form);
        const saved = toolsetId
          ? await api.updateToolset(toolsetId, body)
          : await api.createToolset(body);
        return saved.id;
      }}
      onPostSaveLogin={async (toolsetId, auth) => {
        if (auth.authenticationType === ToolsetAuthTypes.ApiKey) {
          await api.loginToolset(toolsetId, buildLoginBody(auth));
        }
      }}
      onToolsetsChanged={() => refetchToolsets()}
      onSaveSuccess={(form) => toast(`${form.name} saved`)}
      onSaveComplete={() => navigate(returnUrl)}
      onBack={() => navigate(returnUrl)}
      buildMcpUrl={
        externalCoreUrl &&
        ((toolsetId) => `${externalCoreUrl}/mcp/${toolsetId}`)
      }
      listToolNames={(toolsetId) => api.listMcpToolNames(toolsetId)}
      authActions={authActions}
      onOAuthLogin={runOAuthLogin}
      onNotifySuccess={(message) => toast(message)}
      onNotifyError={(message, requestId) => showError(message, requestId)}
      bucket={user.bucket}
      FileManagerModal={FileManagerModal}
      resolveIconUrl={(url) => resolveIconUrl(url)}
      allowedMimeTypes={['image/png', 'image/jpeg', 'image/svg+xml']}
      maxFileSizeBytes={1024 * 1024}
      availableLocaleOptions={localeOptions}
      labels={labels}
    />
  );
};
```

`initialForm` re-seeds the editor whenever its object identity changes, so a
host that loads asynchronously should memoize it and produce a new object only
once the data has arrived. Create mode passes `toolsetId=""`; the editor then
owns the draft id returned by the first `onPersist` and uses it for the
auth flows, the allowed-tools fetch, and the Connect section.

`onPersist` returns the persisted toolset id, or `null` when the request
failed (the host surfaces its own failure notification — the editor stays
open with the user's input). Save ordering is: `onPersist` →
`onToolsetsChanged` → `onSaveSuccess` → `onPostSaveLogin` →
`onSaveComplete`; a rejected `onPostSaveLogin` shows a login-failure error
and does not navigate. The Log In flow persists unsaved changes first
(`buildMcpUrl`'s and every subsequent call in that attempt use the id the
persist resolved) and skips the request entirely when the form is unchanged
since the last persist.

The Connect toolset section renders only when `buildMcpUrl` is supplied and a
persisted id exists; omit `buildMcpUrl` (e.g. no external core URL
configured) and the section stays hidden in every mode. When `listToolNames`
is omitted, the "Allowed tools" field falls back from the Select to a
free-text tag input.

`labels` is a nested `ToolsetEditorLabels` object whose `layout`, `general`,
`settings`, and `validation` groups are each optional and replaced as a
whole; an omitted group falls back to the library's English defaults.

### `GeneralForm`

The Metadata field set on its own, for editors that need it without the
toolset Setup section (the Custom App editor's General step is the in-repo
consumer). It wraps `DeploymentCreationForm` and the `AvatarPickerModal` from
`@epam/ai-dial-builder-form`.

```tsx
import { GeneralForm } from '@epam/ai-dial-toolset-editor';
import type {
  DeploymentGeneralFormData,
  ToolsetFormErrors,
} from '@epam/ai-dial-toolset-editor';

const GeneralStep = ({
  form,
  errors,
  onChange,
}: {
  form: DeploymentGeneralFormData;
  errors: ToolsetFormErrors;
  onChange: (patch: Partial<DeploymentGeneralFormData>) => void;
}) => (
  <GeneralForm
    form={form}
    errors={errors}
    bucket={user.bucket}
    FileManagerModal={FileManagerModal}
    resolveIconUrl={(url) => resolveIconUrl(url)}
    allowedMimeTypes={['image/png', 'image/jpeg', 'image/svg+xml']}
    maxFileSizeBytes={1024 * 1024}
    availableLocaleOptions={localeOptions}
    onChange={onChange}
    onNameBlur={() => setErrors(validateName(form))}
    labels={labels}
  />
);
```

State is fully controlled: every edit reports a `Partial<DeploymentGeneralFormData>`
patch through `onChange`, and the avatar picker reports
`onChange({ iconUrl })` after resolving the picked file through the host's
`FileManagerModal` and `bucket`. `onNameBlur`/`onVersionBlur` let the host
surface errors at blur time. `GeneralFormLabels.form` and
`GeneralFormLabels.avatarPicker` are each optional and replaced as a whole.

## Utilities

### `getDefaultToolsetForm`

```ts
import { getDefaultToolsetForm } from '@epam/ai-dial-toolset-editor';

const form = getDefaultToolsetForm(existingToolsetNames);
// → name 'New toolset' (suffixed when it collides), version '0.0.1',
//   protocol HTTP, auth: None / WithoutLogin / not logged in
```

Returns the form state a brand-new toolset editor opens with; pass the
user's existing toolset names so the seeded default name is conflict-free.

### `getStorageSafeUniqueToolsetName`

```ts
import { getStorageSafeUniqueToolsetName } from '@epam/ai-dial-toolset-editor';

getStorageSafeUniqueToolsetName({ existingNames: ['New toolset'] });
// → 'New toolset 1'
```

Returns a storage-safe name that does not collide with any existing name,
appending a numeric suffix when the candidate is taken.

### `isValidEndpointUrl`

```ts
import { isValidEndpointUrl } from '@epam/ai-dial-toolset-editor';

isValidEndpointUrl('https://mcp.example.com/sse'); // true
isValidEndpointUrl('sse://mcp.example.com'); // false
isValidEndpointUrl('ftp://mcp.example.com'); // false
```

Validates a toolset endpoint URL: `http(s)` scheme, parseable, no trailing `.`
or `//`. An `sse://` URL is invalid — DIAL Core stores only `http`/`https`
endpoints, and the SSE transport is selected through the form's `protocol`
field, not through the URL scheme.

### `normalizeReturnedEndpointUrl`

```ts
import { normalizeReturnedEndpointUrl } from '@epam/ai-dial-toolset-editor';

normalizeReturnedEndpointUrl('https:/mcp.example.com'); // 'https://mcp.example.com'
```

Normalizes an endpoint URL as returned by the backend: repairs a
single-slash scheme and decodes percent-encoding when either produces a
valid URL; otherwise returns the trimmed value unchanged.

### `isToolsetAuthValid`

```ts
import { isToolsetAuthValid } from '@epam/ai-dial-toolset-editor';

isToolsetAuthValid(form.auth, isEditMode);
```

Returns whether the auth form state can be saved without surfacing
validation errors. `isEditMode` relaxes the OAuth `clientSecret`
requirement — the backend never returns a stored secret, so an existing
OAuth-with-config toolset stays saveable without retyping it.

### `isToolsetFormValid`

```ts
import { isToolsetFormValid } from '@epam/ai-dial-toolset-editor';

isToolsetFormValid(form, isEditMode);
```

Returns whether the whole editor form can be saved (name/version via
`builder-form`'s shared validation, endpoint URL, and auth block).

## Constants

- `DEFAULT_TOOLSET_NAME` — `'New toolset'`, the display name seeded into a
  new form.
- `DEFAULT_TOOLSET_VERSION` — `'0.0.1'`, the display version seeded into a
  new form.
- `AUTH_TYPE_ICONS` — icon per `ToolsetAuthTypes` segment; segment labels
  arrive through the auth labels, not this map.

## Enums

### `ToolsetTransportType`

| Member | Value    | Meaning                          |
| ------ | -------- | -------------------------------- |
| `Http` | `'HTTP'` | Streamable HTTP MCP transport    |
| `Sse`  | `'SSE'`  | Server-sent events MCP transport |

### `ToolsetOAuthLoginStatus`

How the host's OAuth flow settled, returned from `onOAuthLogin`.

| Member          | Value              | The editor's reaction                             |
| --------------- | ------------------ | ------------------------------------------------- |
| `Success`       | `'success'`        | Marks the toolset logged in, success notification |
| `Cancelled`     | `'cancelled'`      | Silent — nothing failed                           |
| `PopupBlocked`  | `'popup-blocked'`  | `labels.errorPopupBlocked` notification           |
| `InvalidConfig` | `'invalid-config'` | `labels.errorOAuthConfigMissing` notification     |
| `Failed`        | `'failed'`         | `labels.errorLoginFailed` notification            |

The auth enums the form model uses (`ToolsetAuthTypes`, `WithLogin`,
`ToolsetCredentialsLevel`) are owned by `@epam/ai-dial-chat-hooks` and are
imported from there — this lib never re-declares them.

## Types

All types reachable through the public props are exported from the barrel:
`ToolsetEditorProps`, `ToolsetEditorLabels` (with its `layout`, `general`,
`settings`, `validation` groups), `GeneralFormProps`, `GeneralFormLabels`,
`SettingsFormLabels`, `AuthSectionLabels`, `ConnectMcpUrlContentLabels`,
`ToolsetFormData`, `ToolsetAuthFormData`, `DeploymentGeneralFormData`,
`ToolsetFormErrors`, `ToolsetLoginRequest`, `ToolsetLogoutRequest`,
`ToolsetAuthActions`, `ToolsetOAuthLoginHandler`, `ToolsetOAuthLoginRequest`,
and `ToolsetOAuthLoginResult`.

`ToolsetLoginRequest`/`ToolsetLogoutRequest` are structural shapes for the
credentials bodies; a host with a generated API client maps them onto its own
DTOs at the app edge, field by field.

`onOAuthLogin` is a `ToolsetOAuthLoginHandler`. It receives the current `auth`
state and an `ensureSaved` continuation that persists the form and resolves
the toolset id (or `false`), and it returns a `ToolsetOAuthLoginResult` — a
`status`, plus optional `auth` fields the flow resolved (dynamic client
registration) and a `traceId` for a failure notification. The editor calls it
synchronously from the click, before any `await`, so the host can open a popup
inside the user gesture.

```tsx
const runOAuthLogin: ToolsetOAuthLoginHandler = async ({
  auth,
  ensureSaved,
}) => {
  const popup = window.open('', '_blank');
  if (!popup) return { status: ToolsetOAuthLoginStatus.PopupBlocked };

  const toolsetId = await ensureSaved();
  if (!toolsetId) {
    popup.close();
    return { status: ToolsetOAuthLoginStatus.Cancelled };
  }

  const isLoggedIn = await authorize(popup, auth, toolsetId);
  return {
    status: isLoggedIn
      ? ToolsetOAuthLoginStatus.Success
      : ToolsetOAuthLoginStatus.Failed,
  };
};
```

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key               | Class                                  | Element                                                           |
| ----------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `metadataSection` | `dial-toolset-editor-metadata-section` | The metadata column, inside the shared editor layout              |
| `setupSection`    | `dial-toolset-editor-setup-section`    | The setup column beside it, holding the connection and auth forms |

```tsx
import { TOOLSET_EDITOR_CLASS } from '@epam/ai-dial-toolset-editor';

TOOLSET_EDITOR_CLASS.setupSection; // 'dial-toolset-editor-setup-section'
```

`GeneralForm` renders a fragment rather than an element of its own, so it
carries no class — style the column it sits in.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
