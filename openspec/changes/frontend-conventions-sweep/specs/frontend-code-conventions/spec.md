## ADDED Requirements

### Requirement: Production frontend code has no nested ternaries

Production TypeScript under `apps/*/src` and `libs/*/src` SHALL NOT contain a conditional expression whose `whenTrue` or `whenFalse` branch is itself a conditional expression. `eslint.config.mjs` SHALL enforce this with `no-nested-ternary` set to `error`. The rule is off for `libs/celebrations` and for spec files.

#### Scenario: A nested ternary fails lint

- **WHEN** a production file outside `libs/celebrations` contains `a ? b : c ? d : e`
- **THEN** ESLint reports `no-nested-ternary` as an error

### Requirement: Named value sets in lib public APIs are string enums

The following exported types SHALL be string enums with unchanged member values, exported under the same names from the same entry points:

- `ListViewColumnKey` (`@epam/ai-dial-catalog`);
- `SkillTextField` (`@epam/ai-dial-chat-hooks`);
- `McpDeploymentKind` and `McpAppToolDiscovery` (`@epam/ai-dial-mcp-apps`);
- `ScheduledTaskTextField` (`@epam/ai-dial-scheduled-tasks`);
- `ChatSkillDetailsTrigger` (`@epam/ai-dial-skills`).

`@epam/ai-dial-chat-hooks` SHALL export one upload-mode type, the `DialFilesApiUploadMode` enum. It SHALL NOT also export an `UploadMode` union.

#### Scenario: Runtime values are unchanged

- **WHEN** a value of one of these types is serialized or sent to DIAL Core
- **THEN** it is the same string as before the conversion
