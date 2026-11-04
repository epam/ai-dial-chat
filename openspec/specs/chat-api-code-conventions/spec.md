# Spec: chat-api-code-conventions

## Purpose

Code conventions that `chat-api` enforces by test or lint rather than by comment: share-invitation route parity with the SPA router, string enums for upload mode and OTEL exporters, no nested ternaries, and the placement of the generation registry and naming services.

## Requirements

### Requirement: Share-invitation routes are checked against the frontend router

`apps/chat-api/src/share/utils/share-resource.util.ts` SHALL keep its share-invitation route prefixes as backend constants, because `chat-api` (`type:backend`) cannot import `apps/chat`. Their parity with the frontend SHALL be enforced by `apps/chat-api/src/share/tests/share-invitation-routes.spec.ts`, which runs in the `chat-api:test` target. The spec reads `apps/chat/src/types/routes.ts` as text and asserts:

| Frontend `ROUTES` member | Backend value under test |
| --- | --- |
| `SharedInvitation` | `getInvitationRoutePath` for a catalog id, followed by `/:invitationId` |
| `ConversationSharedInvitation` | `getInvitationRoutePath` for a `conversations/` id, followed by `/:invitationId` |
| `ProjectSharedInvitation` | `getInvitationRoutePath` for a project id, followed by `/:invitationId` |

The spec SHALL fail with a message that names the member when a member is missing from `routes.ts` or its value differs. The comment above the constants SHALL point at this spec instead of asking readers to keep the values in sync by hand. No runtime code reads `routes.ts`.

#### Scenario: A frontend route rename fails the backend test

- **WHEN** `ROUTES.ConversationSharedInvitation` in `apps/chat/src/types/routes.ts` changes to `'/chats/shared/:invitationId'` while the backend constant stays `'/conversations/shared'`
- **THEN** `share-invitation-routes.spec.ts` fails and names `ConversationSharedInvitation`

#### Scenario: Matching routes pass

- **WHEN** the three frontend members and the backend constants agree, as they do today
- **THEN** the spec passes and the generated share links are unchanged

### Requirement: Upload mode and OTEL exporters are string enums

`chat-api` SHALL model these value sets as string enums, not literal unions:

- `UploadMode` with `Overwrite = 'overwrite'` and `CreateOnly = 'create-only'`, in `apps/chat-api/src/files/types/upload-mode.enum.ts`;
- `SingleSignalExporter` with `Otlp = 'otlp'` and `None = 'none'`, and `MetricsExporter` with `Otlp = 'otlp'` and `Prometheus = 'prometheus'`, in `apps/chat-api/src/telemetry/otel-config.ts`.

Code that validates, documents or compares these values SHALL use the enum members or `Object.values(...)` of the enum rather than repeating the literals. The `uploadMode` validation message, its OpenAPI `enum` list and order, and the parsed OTEL configuration for every `OTEL_*_EXPORTER` input SHALL stay as they are.

#### Scenario: Upload mode contract is unchanged

- **WHEN** `npm run openapi` runs after the change, and a request sends `uploadMode=bogus`
- **THEN** `libs/chat-api-client/openapi.json` has no diff, and the 400 response carries the same `uploadMode must be one of the following values: overwrite, create-only` message as before

#### Scenario: OTEL parsing is unchanged

- **WHEN** `parseOtelConfig` receives `OTEL_METRICS_EXPORTER` unset, `'otlp,prometheus'`, `'none'`, or `OTEL_TRACES_EXPORTER='none'`
- **THEN** it returns the same exporter lists and modes as before: `[prometheus]`, `[otlp, prometheus]`, `[]` and `none` respectively

### Requirement: chat-api forbids nested ternaries

`apps/chat-api/eslint.config.mjs` SHALL set `no-nested-ternary` to `error` for `apps/chat-api/src`. A nested conditional SHALL be written as an early return, an `if`/`else` or a named helper. `apps/chat-api/src` SHALL contain no `eslint-disable` directive for `no-nested-ternary`. The archive-upload result mapping that was once exempt is now the `getArchiveEntryUploadError` helper in `apps/chat-api/src/files/upload/archive-upload.ts`.

#### Scenario: Lint rejects a new nested ternary

- **WHEN** a contributor adds `a ? b : c ? d : e` anywhere in `apps/chat-api/src`
- **THEN** `nx lint chat-api` fails with `no-nested-ternary`

#### Scenario: No nested-ternary exceptions remain

- **WHEN** `apps/chat-api/src` is searched for `no-nested-ternary`
- **THEN** no `eslint-disable` directive for that rule is found

### Requirement: Generation registry and naming services live in domain sub-folders

`ConversationGenerationService` SHALL live in `apps/chat-api/src/conversations/generation/conversation-generation.service.ts`, beside the other generation code, with its spec co-located as that folder's specs are. `ConversationNamingService` SHALL live in `apps/chat-api/src/conversations/naming/conversation-naming.service.ts`, with its spec in `conversations/naming/tests/`. Class names, providers and behavior are unchanged, and `apps/chat-api/src/conversations/` keeps no service file for generation or naming at its root.

#### Scenario: The domain root no longer holds the moved services

- **WHEN** `apps/chat-api/src/conversations/` is listed after the change
- **THEN** it contains neither `conversation-generation.service.ts` nor `conversation-naming.service.ts`, and every importer resolves the new paths
