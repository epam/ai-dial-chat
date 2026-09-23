## ADDED Requirements

### Requirement: General form theme URL field

Extending "General form (step 1)", `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` SHALL render one
additional field in the left column, **below** the shared `DeploymentCreationForm` from
`@epam/ai-dial-builder-form`, not inside it.

The field is a ui-kit 2.0 `Input` bound to a new locally-owned `themeUrl` string in the component's
`useState`, kept outside `DeploymentCreationFormValues` so that
`@epam/ai-dial-builder-form` learns nothing about themes hosts. Should the field later move into the
lib, the lib SHALL receive a labelled string value, an `onChange`, and an already-computed error
message — never the endpoint path, the origin allowlist, or any knowledge of DIAL
`catalog_properties`.

The field SHALL always be rendered. There is no client feature flag: whether a stored theme can
actually load is decided server-side by `THEMES_ALLOWED_ORIGINS`, and a theme URL saved against an
origin the operator has not allow-listed is inert rather than broken.

`GeneralFormInitialValues` SHALL gain `themeUrl?: string`, seeded once by the same ref-guarded
effect that seeds the other initial values.

`GeneralFormHandle` SHALL gain `getThemeUrl: () => string | undefined`, returning the trimmed value
or `undefined` when empty. It is deliberately **not** added to `TriggerSaveGeneralPayload`:
that interface is the postMessage wire contract with the embedded QuickApps editor, which has no
reason to know about themes and would have to be changed outside this repository to honour it.

**i18n keys** (new, under the existing `appsEditor.generalForm` namespace in
`apps/chat/src/i18n/locales/en.json`):

| Key | English |
| --- | --- |
| `appsEditor.generalForm.themeUrlLabel` | `Theme URL` |
| `appsEditor.generalForm.themeUrlPlaceholder` | `https://themes.example.com` |
| `appsEditor.generalForm.themeUrlCaption` | `Optional. Applies this application's own colours and logo while it is open.` |
| `appsEditor.generalForm.themeUrlInvalid` | `Enter a valid https:// URL` |

Each key SHALL get a corresponding member on `AppsEditorI18nKeys` in
`apps/chat/src/constants/translation-keys.ts`.

**Accessibility**: the `Input` is labelled through the ui-kit component's own label prop with
`t(AppsEditorI18nKeys.GeneralFormThemeUrlLabel)`. The caption is associated as the field's
description, and the validation message is rendered through the `Input`'s error slot so it is
announced with the field rather than as loose text.

**RTL**: the field inherits the existing left column's layout and uses no physical-direction
classes; the URL value itself renders LTR inside the input, which is the browser's own behaviour for
an `<input type="url">`-shaped value and requires no override.

#### Scenario: The field renders on the General step

- **WHEN** an author opens the General step
- **THEN** a `Theme URL` input renders below the shared form fields

#### Scenario: An existing value prefills the field

- **WHEN** the author opens the General step for an application whose stored `themeUrl` is
  `https://themes.contoso.example.com`
- **THEN** the input shows that value

#### Scenario: A later re-render does not overwrite an edit

- **WHEN** the author edits the field and the host re-renders with the same `initialValues`
- **THEN** the edited value is preserved, matching the existing ref-guarded seeding rule

---

### Requirement: The theme URL is validated in the form and blocks submission

Validation runs alongside the existing `validateDeploymentCreationFields` checks and SHALL NOT
replace them.

A non-empty `themeUrl` SHALL be accepted only when it parses as an absolute URL with protocol
`https:`. Anything else SHALL render `appsEditor.generalForm.themeUrlInvalid` inline and SHALL
prevent the create API from being called, the same way an invalid name or version does today.

An empty or whitespace-only value is valid and means "no theme".

The form SHALL NOT check the value against `THEMES_ALLOWED_ORIGINS`. That list is server-side
operator configuration; exposing it to the client would leak deployment topology for a marginal
gain. A rejected origin surfaces as a load-time no-op (the base theme stays) rather than a save
error — see the `app-theme-url` and `active-app-theme` specs.

#### Scenario: An http URL is rejected inline

- **WHEN** the author enters `http://themes.contoso.example.com` and submits
- **THEN** `appsEditor.generalForm.themeUrlInvalid` renders under the field and the create API is
  not called

#### Scenario: A non-URL value is rejected inline

- **WHEN** the author enters `themes.contoso.example.com` (no scheme) and submits
- **THEN** the inline error renders and the create API is not called

#### Scenario: An empty value submits cleanly

- **WHEN** the field is left empty and the rest of the form is valid
- **THEN** submission proceeds and no `themeUrl` is sent

#### Scenario: A valid URL whose origin is not allow-listed still saves

- **WHEN** the author enters a well-formed `https://` URL that the operator has not allow-listed
- **THEN** the form submits successfully and no error is shown in the editor

---

### Requirement: The theme URL is persisted on both save paths

The AppsEditor has two distinct persistence paths, and the theme URL SHALL travel on both.

**Create path** — `GeneralForm.handleSubmit` with no `appId`: the trimmed value SHALL be added to
the existing `createApplication({ name, type, description, iconUrl, version, topics, applicationProperties, locales, primaryLocale })`
call as `themeUrl`, omitted when empty.

**Edit path** — `AppsEditor.handleSaveSuccess`: the trimmed value SHALL be added to the follow-up
`updateApplication(appIdForSettings, { … })` call that already runs after the embedded editor's own
save (`apps/chat/src/pages/AppsEditor/AppsEditor.tsx:291-300`), read through
`generalFormRef.current?.getThemeUrl()`.

That follow-up PATCH is the **only** place the edit path can persist it, and its position after the
embedded editor's save is load-bearing: the embedded QuickApps editor writes the application
resource itself and has no knowledge of `catalog_properties`, so re-asserting the theme URL
afterwards is what survives that write. This is the same mechanism the existing
`features.skills_supported` re-assertion relies on.

When the General step was never mounted — a deep link straight to Settings — `getThemeUrl()` is
unavailable and the field SHALL be omitted from the update, leaving the stored value alone.
Sending an empty string there would silently delete a theme the author never saw.

#### Scenario: Creating an application with a theme URL

- **WHEN** the author fills the field on a new application and clicks Next
- **THEN** `createApplication` is called with `themeUrl` set to the trimmed value

#### Scenario: Creating without a theme URL

- **WHEN** the field is empty
- **THEN** `createApplication` is called without a `themeUrl` key

#### Scenario: Editing an application's theme URL

- **WHEN** the author changes the field on an existing application and saves from the Settings step
- **THEN** the follow-up `updateApplication` call carries the new `themeUrl`

#### Scenario: Clearing an application's theme URL

- **WHEN** the author empties the field on an application that had one and saves
- **THEN** the follow-up `updateApplication` call carries `themeUrl: ""`, which deletes the stored
  key

#### Scenario: A deep link to Settings omits the field

- **WHEN** the author opens `/apps-editor?step=settings` directly and saves, never visiting the
  General step
- **THEN** the follow-up `updateApplication` call carries no `themeUrl`, and the stored value is
  unchanged

#### Scenario: The value survives the embedded editor's own save

- **WHEN** the embedded QuickApps editor persists the application and the host's follow-up PATCH
  then runs
- **THEN** the stored `catalog_properties.themeUrl` reflects the value from the form, regardless of
  what the embedded editor wrote

---

### Requirement: The editor reads the stored theme URL from deployment details

The editor SHALL read an existing application's stored theme URL from its deployment details.

`generalFormInitialValues` is built from `existingDeployment`
(`apps/chat/src/pages/AppsEditor/AppsEditor.tsx:132-157`), which comes from `DeploymentsContext`'s
**list** items and carries no `catalogProperties`. `AppsEditor` SHALL therefore fetch
`getDeploymentDetails(existingAppId)` when editing an existing application and read
`applicationDetails?.catalogProperties?.themeUrl` from it, merging the result into
`generalFormInitialValues`.

The fetch SHALL follow the established async-effect pattern — a cancelled flag, `async/await`, and
no state set after unmount — and SHALL be keyed on the application id so switching applications
refetches. A failed fetch SHALL leave the field empty and SHALL NOT block the form or show an
error: the rest of the General step is prefilled from the list item and stays usable.

The fetch SHALL be skipped when creating a new application, since there is nothing stored to read.

#### Scenario: The stored value prefills the field

- **WHEN** the author opens the General step for an existing application whose details carry
  `catalogProperties.themeUrl`
- **THEN** the field shows that value once the details resolve

#### Scenario: A failed details fetch degrades quietly

- **WHEN** the details request fails
- **THEN** the field renders empty, the rest of the form is prefilled as today, and no error is
  shown

#### Scenario: No fetch is made while creating

- **WHEN** the author opens the General step to create a new application
- **THEN** no details request is made and the field starts empty

#### Scenario: A failed details fetch leaves the field empty

- **WHEN** the details request rejects
- **THEN** the field renders empty and the rest of the form is prefilled as today
