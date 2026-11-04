## Why

This change closes the last backend items of the 2026-10-26 refactoring audit (`refactoring-backend.md` B8 and B9). B1 to B7 are implemented or in review.

- **B8 — share-route sync.** `apps/chat-api/src/share/utils/share-resource.util.ts` hardcodes three share-invitation route prefixes (`/catalog/shared`, `/conversations/shared` and `/projects/shared`) that must match `ROUTES.SharedInvitation`, `ROUTES.ConversationSharedInvitation` and `ROUTES.ProjectSharedInvitation` in `apps/chat/src/types/routes.ts`. Only a comment ("MUST stay in sync") guards this. A frontend route rename compiles and passes every test, but generated share links break silently.
  - The two apps cannot share a constant. `chat-api` is tagged `type:backend` and may import only `type:backend` projects (`eslint.config.mjs`), and `apps/chat` cannot import `type:backend` either.
- **B9 — conventions sweep.** Three repository rules are broken in `chat-api` today:
  - **String enums over literal unions** (`.claude/rules/all-ts.md`):
    - `UploadMode` (`'overwrite' | 'create-only'`) in `files/dto/upload-file.dto.ts`, with the same literals repeated in `files.controller.ts`;
    - `SingleSignalExporter` and `MetricsExporter` in `telemetry/otel-config.ts`, compared as string literals in `otel-sdk.ts` and `request-timing.ts`.
  - **Nested ternaries.** `no-nested-ternary` reports six production sites:
    - `conversations/listing/conversation-listing.service.ts`;
    - `conversations/listing/conversation-titles.service.ts`;
    - `deployments/details/deployments-details.service.ts` (two sites);
    - `files/upload/files-upload.service.ts`;
    - `skills/utils/skill-metadata.util.ts`.

    No lint rule stops new ones.
  - **Domain sub-folders** (`apps/chat-api/AGENTS.md`). `conversations/conversation-generation.service.ts` (the generation registry) and `conversations/conversation-naming.service.ts` (LLM naming) still sit at the domain root, while their peers already live in `generation/`, `listing/`, `lifecycle/` and `streaming/`.

The audit's nested-ternary hits in `prompt-path.constants.ts`, `apply-chunk-annotations.server.ts` and `openapi-spec.ts` were false positives from regex `(?:` groups and ordinary single ternaries. The lint rule finds none there.

## What Changes

- **Share-route parity test (B8).** A new `apps/chat-api/src/share/tests/share-invitation-routes.spec.ts` reads `apps/chat/src/types/routes.ts` as text. For each of the three invitation routes, it asserts that the frontend value equals `getInvitationRoutePath(<sample id>)` followed by `/:invitationId`. The "MUST stay in sync" comment is replaced with a pointer to that test. No constant moves and no import crosses the boundary.
- **String enums (B9):**
  - `UploadMode { Overwrite = 'overwrite', CreateOnly = 'create-only' }` goes in `files/types/upload-mode.enum.ts`, next to `FileTransferKind`. `UploadFileDto` and the multipart schema in `files.controller.ts` build their `@IsIn`/`enum` lists from `Object.values(UploadMode)`, and `files-upload.service.ts` compares against `UploadMode.CreateOnly`. The values, the order, the validation message and the OpenAPI schema stay the same.
  - `SingleSignalExporter { Otlp, None }` and `MetricsExporter { Otlp, Prometheus }` become string enums in `telemetry/otel-config.ts`. Their callers in `otel-sdk.ts` and `request-timing.ts` compare against members.
- **Nested ternaries (B9).** Five of the six sites become early returns or small named helpers in the same file. Behavior is unchanged.
  - The sixth, `files/upload/files-upload.service.ts`, sits in archive-upload code that open PR #9703 moves to `files-archive-upload.service.ts`. It is fixed there after #9703 merges, so this change does not conflict with it.
  - `apps/chat-api/eslint.config.mjs` turns on `no-nested-ternary: error`. Until the deferred site is fixed, it carries a scoped `eslint-disable-next-line` with a reason.
- **Sub-folders (B9):**
  - `conversation-generation.service.ts` moves to `conversations/generation/`, and its spec moves next to it, matching that folder's co-located specs.
  - `conversation-naming.service.ts` moves to a new `conversations/naming/`, with its spec in `naming/tests/`.
  - Imports are rewired and class names are unchanged.

No behavior changes: the same routes, DTOs, validation messages, OpenAPI document, generated client, env vars, telemetry and logs.

### Non-goals

- **Renaming `throwIfArchiveUploadAborted` to `throwIfUploadAborted`.** That follow-up comes from `extract-archive-upload-service`, whose helper only exists on #9703's branch. It is done together with the deferred ternary once #9703 merges.
- Narrowing `ConfigService<EnvironmentVariables>` to per-domain env classes (`split-environment-config` follow-up 6.1). It touches about 110 files to change types only.
- Introducing a shared route-constants lib or a new module-boundary tag.
- Celebration code, which is excluded from refactoring audits.
- The frontend copy of `UploadMode` (frontend plan F11).

### Acceptance criteria

- Changing any of the three invitation routes in `apps/chat/src/types/routes.ts`, or the matching backend constant, fails `share-invitation-routes.spec.ts`. `share-resource.util.ts` no longer contains "MUST stay in sync".
- `apps/chat-api/src` declares no `type X = 'a' | 'b'` for `UploadMode`, `SingleSignalExporter` or `MetricsExporter`.
- `no-nested-ternary` is an error in `apps/chat-api/eslint.config.mjs`. `nx lint chat-api` passes with exactly one documented disable, in `files-upload.service.ts`.
- `conversations/` has no `conversation-generation.service.ts` or `conversation-naming.service.ts` at its root.
- `npm run openapi` produces no diff. `nx run-many -t test lint build typecheck -p chat-api` passes. `npm run validate:specs` passes, with the moved paths synced into the four main specs that cite them.

### Alternatives considered

For B8:

1. **A shared constants lib under a new tag that both `type:app` and `type:backend` may import.** This needs a new `type:*` tag, boundary-rule and `tools/module-boundaries.spec.mjs` changes, and a published or internal lib for three strings. Rejected as out of proportion.
2. **Serving the routes from the backend** (for example in client config), so the SPA reads them. This inverts ownership, because the SPA's router needs the route at build time. Rejected.
3. **A parity test in `chat-api` that reads the frontend file** (chosen). It is enforced in CI through the existing `chat-api:test` target, changes no runtime code and imports nothing across the boundary.

For the string enums, keeping `@IsIn([...literal list])` was also considered. Rejected, because it leaves the duplicated literals the rule targets.

### Rollback

All edits are internal to `chat-api` and its tests, plus spec path updates. Reverting the commit restores them, with no contract, env or data migration.

## Capabilities

### New Capabilities

- `chat-api-code-conventions`: the enforced conventions this change adds to `chat-api`:
  - the share-route parity test;
  - string enums for upload mode and OTEL exporters;
  - the `no-nested-ternary` lint rule;
  - the placement of the generation registry and naming services.

### Modified Capabilities

These four specs change only the cited file path:

- `generation-live-replay`: "Backend retains in-flight assistant message content per active generation" cites `conversations/generation/conversation-generation.service.ts`.
- `generation-registry`: "In-memory generation registry keyed by principal and path" cites the same new path.
- `project-conversation-read-state`: "Deleting and renaming a project conversation keep the caller's state consistent" cites `conversations/naming/conversation-naming.service.ts`.
- `responses-api-generation`: "ConversationService resolves generation API before opening the upstream stream" cites the naming service's new path.

## Impact

- **Code:** `apps/chat-api/src/`:
  - `share/utils/share-resource.util.ts` (comment only);
  - `files/dto/upload-file.dto.ts`, `files/files.controller.ts`, `files/files.service.ts` and `files/upload/files-upload.service.ts` (type import, comparison and the disabled ternary);
  - new `files/types/upload-mode.enum.ts`;
  - `telemetry/otel-config.ts`, `telemetry/otel-sdk.ts` and `telemetry/request-timing.ts`;
  - the five ternary sites;
  - the two moved services and every importer (about 20 files, mostly tests);
  - `apps/chat-api/eslint.config.mjs`.
- **Tests:**
  - new `share/tests/share-invitation-routes.spec.ts`;
  - moved `conversation-generation.service.spec.ts` and `conversation-naming.service.spec.ts`;
  - OTEL config specs keep their assertions, because string-enum members equal their literal values.
- **Specs:** four main specs get the new paths (path-only deltas, synced in this PR so `validate:specs` stays green).
- **Docs:** `apps/chat-api/AGENTS.md` mentions no file named here. `docs/` cites neither moved service by path.
- **Unaffected:**
  - the frontend and libs;
  - OpenAPI and the generated client;
  - env vars;
  - i18n: no new strings;
  - RTL and a11y, feature gating and telemetry output.
