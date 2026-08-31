## MODIFIED Requirements

### Requirement: Prompt details resolve through the prompts endpoints

The stable `onFetchDetails` callback SHALL be returned by
`@epam/ai-dial-chat-hooks`'s `useCatalogItemDetails` and branch before its
deployment path: for `CatalogEntityType.Prompt` it calls the injected public
prompt operation when the item came from the organisation source, the injected
personal prompt operation for a personal prompt, and parses a shared prompt's
qualified id before calling that operation with `path` and `ownerBucket`.

It SHALL resolve prompt content plus the rebuilt overview required because
fetched details replace static details wholesale. It SHALL NOT call deployment
details or limits for a prompt. Failures SHALL resolve `undefined`, so the panel
falls back to content seeded by the mapper and never throws out of the callback.
The app adapter SHALL supply the existing server-api wrappers; the hook SHALL
not import them or configure a client.

#### Scenario: Opening a personal prompt fetches its content

- **WHEN** the user opens a personal prompt's details
- **THEN** the injected personal-prompt operation receives `item.id` and the
  Content and rebuilt Overview tabs render

#### Scenario: Opening an organisation prompt uses the public operation

- **WHEN** the prompt source is Public
- **THEN** the injected public-prompt operation receives `item.id` and no
  personal request is issued

#### Scenario: Opening a shared prompt preserves the owner bucket

- **WHEN** the user opens `prompts/owner-bucket/Work/AI/summarize`
- **THEN** the personal/shared operation receives
  `('Work/AI/summarize', 'owner-bucket')`

#### Scenario: Prompt details never call deployment operations

- **WHEN** details open for a Prompt item
- **THEN** neither deployment-details nor deployment-limits is called

#### Scenario: Details failure falls back to seeded content

- **WHEN** the prompt request rejects and the mapper seeded prompt content
- **THEN** `onFetchDetails` resolves `undefined`, seeded content remains, and
  nothing throws
