## ADDED Requirements

### Requirement: PublishPanel renders an optional, host-driven credentials opt-in

`PublishPanel` SHALL accept an optional credentials section:

- `publishCredentials?: boolean` — the current value;
- `onPublishCredentialsChange?: (value: boolean) => void` — called with the next value on toggle;
- `labels.credentialsLabel?: string` — the checkbox label, defaulting to `'Publish with my credentials'`;
- `labels.credentialsHint?: string` — the caption below it, defaulting to text stating that members will use the resource without authorising and that the credential itself is never shown to them.

The section SHALL render only when `onPublishCredentialsChange` is supplied, so a host that has no use for it (a conversation publish panel, for example) gets exactly the panel it has today. When rendered, it SHALL sit inside the destination block alongside the author field and the access rules, and SHALL be `disabled` while `isSubmitting` is `true`, matching every other field in the panel.

The control SHALL be ui-kit's 2.0 `Checkbox` with `labelProps={{ label }}` and `caption={hint}`, so the hint is wired as the control's accessible description by the kit rather than by hand-rolled ARIA. The hint SHALL state the consequence of ticking the box, not merely restate the label.

The library SHALL hold no knowledge of what the flag means to any backend. It SHALL NOT reference toolsets, credential levels, authentication types, sign-in status, or DIAL Core; the decision of whether to offer the control, and all of its copy, belong to the host — consistent with the library's existing independence from catalog domain models, i18n, and app context.

#### Scenario: Host supplies the change handler

- **WHEN** `PublishPanel` receives `onPublishCredentialsChange`
- **THEN** the credentials checkbox renders with the supplied (or default) label and caption, reflecting `publishCredentials`

#### Scenario: Host omits the change handler

- **WHEN** `PublishPanel` receives no `onPublishCredentialsChange`
- **THEN** no credentials checkbox is rendered and the panel is identical to its pre-change output

#### Scenario: Toggling reports the next value

- **WHEN** the user toggles the checkbox
- **THEN** `onPublishCredentialsChange` is called with the negation of the current `publishCredentials`, and the panel holds no state of its own for it

#### Scenario: The control is disabled while submitting

- **WHEN** `isSubmitting` is `true`
- **THEN** the credentials checkbox is disabled

#### Scenario: The hint is the control's accessible description

- **WHEN** the credentials checkbox is rendered with a caption
- **THEN** assistive technology reads the caption as the checkbox's description, and the caption states what happens when the box is ticked

### Requirement: usePublishFlow owns the credentials opt-in and always clears it

`usePublishFlow` SHALL own the credentials opt-in as flow state alongside `rules` and `author`:

- `publishCredentials: boolean`, initialised to `false`;
- `setPublishCredentials: (value: boolean) => void`;
- `reset()` SHALL restore it to `false`, together with the folder selection, locally created folders, rules, and submit error it already resets.

The value SHALL NOT be derived from, or pre-filled by, publish history, the selected destination folder, or a previous publication — unlike `rules`, which pre-fill from the destination folder. Selecting it is always a deliberate act, so a folder whose previous publication carried shared credentials SHALL still open with the option cleared.

`onPublish` SHALL receive it as a fifth positional argument: `onPublish(item, folderPath, rules, author, publishCredentials)`. The argument is additive — a host callback that declares only the first four parameters remains assignable and keeps compiling.

`handleSubmit` SHALL pass the current value; a successful publish SHALL NOT clear it on its own, because the flow is closed and `reset()` runs on close.

#### Scenario: The option starts cleared

- **WHEN** `usePublishFlow` initialises
- **THEN** `publishCredentials` is `false`

#### Scenario: reset clears a selected option

- **GIVEN** the user has set `publishCredentials` to `true`
- **WHEN** `reset()` is called
- **THEN** `publishCredentials` is `false` again

#### Scenario: A previous publication with shared credentials does not pre-select it

- **GIVEN** publish history contains an entry for the selected folder whose `publishCredentials` is `true`
- **WHEN** the flow is initialised and that folder is selected
- **THEN** `publishCredentials` is `false`

#### Scenario: The value reaches onPublish

- **GIVEN** `publishCredentials` is `true` and a destination folder is selected
- **WHEN** `handleSubmit()` runs
- **THEN** `onPublish` is called with `true` as its fifth argument

#### Scenario: A four-parameter host callback still works

- **WHEN** a host passes an `onPublish` declaring only `(item, folderPath, rules, author)`
- **THEN** the call type-checks and behaves exactly as before, ignoring the extra argument

### Requirement: PublishHistoryEntry records whether a publication carried shared credentials

`PublishHistoryEntry` SHALL gain `publishCredentials?: boolean`, meaning that publication requested the publisher's credentials be shared. It is optional on the model because an unversioned or host-synthesised entry may not know, and absent SHALL read the same as `false`.

`PublishHistoryList` SHALL mark entries whose `publishCredentials` is `true` with a host-supplied label (`sharedCredentialsLabel`, defaulting to `'Shared credentials'`). The marker SHALL be text, not an icon alone; any icon rendered beside it SHALL carry `aria-hidden`. Entries without the flag SHALL render exactly as they do today.

The marker reports what a publication **requested**. The library SHALL NOT claim the credential was applied, and SHALL NOT display, echo, or accept any credential value.

#### Scenario: An entry with shared credentials is marked

- **WHEN** `PublishHistoryList` renders an entry whose `publishCredentials` is `true`
- **THEN** that row carries the shared-credentials label as text

#### Scenario: An entry without the flag is unchanged

- **WHEN** `PublishHistoryList` renders an entry whose `publishCredentials` is `false` or absent
- **THEN** that row renders exactly as it did before this change, with no marker
