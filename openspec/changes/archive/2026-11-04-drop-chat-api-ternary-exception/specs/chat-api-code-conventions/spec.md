## MODIFIED Requirements

### Requirement: chat-api forbids nested ternaries

`apps/chat-api/eslint.config.mjs` SHALL set `no-nested-ternary` to `error` for `apps/chat-api/src`. A nested conditional SHALL be written as an early return, an `if`/`else` or a named helper. `apps/chat-api/src` SHALL contain no `eslint-disable` directive for `no-nested-ternary`. The archive-upload result mapping that was once exempt is now the `getArchiveEntryUploadError` helper in `apps/chat-api/src/files/upload/archive-upload.ts`.

#### Scenario: Lint rejects a new nested ternary

- **WHEN** a contributor adds `a ? b : c ? d : e` anywhere in `apps/chat-api/src`
- **THEN** `nx lint chat-api` fails with `no-nested-ternary`

#### Scenario: No nested-ternary exceptions remain

- **WHEN** `apps/chat-api/src` is searched for `no-nested-ternary`
- **THEN** no `eslint-disable` directive for that rule is found
