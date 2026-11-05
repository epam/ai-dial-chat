## Context

Backend items B1 to B7 of the 2026-10-26 refactoring audit are implemented: B1 to B6 are archived or in PR #9703, and B7 is in PR #9713. What remains is B8 (share-route sync) and B9 (a conventions sweep). This change rides on the B7 branch, `refactor/split-conversation-controller`, so the backend work lands in one PR.

Two follow-ups would collide with open PR #9703, which moves archive upload into `files/upload/files-archive-upload.service.ts` and `files/upload/archive-upload.ts`:

- the rename of `throwIfArchiveUploadAborted`;
- the nested ternary at the archive-entry result mapping in `files/upload/files-upload.service.ts`.

They wait for #9703 (see D3).

Controller, service and DTO rules follow `apps/chat-api/AGENTS.md`. Nothing here adds an endpoint or env var.

## Goals / Non-Goals

**Goals:**

- Turn the B8 comment into a CI-enforced check.
- Remove the remaining literal unions, nested ternaries and root-level services that the audit flags, and lint for nested ternaries from now on.
- Keep the HTTP contract, OpenAPI, validation messages, telemetry and logs unchanged.

**Non-Goals:**

- A shared route lib or a new module-boundary tag.
- Narrowing `ConfigService` types per env domain.
- Changing archive-upload code that #9703 owns.
- Celebration code.

## Decisions

### D1 — Route parity by reading `routes.ts` in a chat-api test

`share-invitation-routes.spec.ts` resolves `apps/chat/src/types/routes.ts` from the workspace root, using `join(__dirname, '../../../../chat/src/types/routes.ts')` and asserting the file exists. It extracts each member with a small regex over `Member = '<value>',` lines.

The backend side is taken through `getInvitationRoutePath` with one sample id per kind:

- `applications/bucket/app` for the catalog route;
- `conversations/bucket/c` for the conversation route;
- `projects/bucket/p` for the project route (`PROJECT_RESOURCE_PREFIX` is `projects/`).

So the private constants stay private.

Reading a file across apps is not an import, so the module-boundary lint does not apply. The test fails loudly when the file moves, because the existence assertion names the path.

### D2 — Enum values and OpenAPI stay identical

`@IsIn(Object.values(UploadMode))` keeps the class-validator message, which lists the allowed values in order. `@ApiPropertyOptional({ enum: Object.values(UploadMode) })` and the multipart schema in `files.controller.ts` keep an inline `enum` array, so Swagger emits no named enum schema and `openapi.json` does not change. `@IsEnum` and `enumName` are deliberately not used, because both change the message or the schema.

The OTEL enums keep their values, and `isMetricsExporter` becomes `Object.values(MetricsExporter).includes(token)`.

### D3 — Nested ternaries: fix five, defer one, lint all

Each site becomes the smallest equivalent shape:

- an `if`/`return` chain in `skill-metadata.util.ts` (`toSkillNodeType`) and in `conversation-titles.service.ts` (the upstream-failure mapping);
- a named local helper for the two `deployments-details.service.ts` picks (`pickRecord`, `pickString`);
- a precomputed object spread in `conversation-listing.service.ts`.

The `files-upload.service.ts` site gets `// eslint-disable-next-line no-nested-ternary -- moves with archive upload in #9703; fix there`, and `no-nested-ternary` becomes `error` in `apps/chat-api/eslint.config.mjs`.

After #9703 merges, its follow-up rewrites the moved mapping, drops the disable, and renames `throwIfArchiveUploadAborted`.

### D4 — Service moves and spec sync in the same PR

The two services are moved with `git mv` so history follows. Then:

- `generation/` co-locates specs, so `conversation-generation.service.spec.ts` sits beside its service;
- `naming/` follows `listing/` and `lifecycle/` with a `tests/` folder;
- every importer, about 20 files and mostly tests, is rewired;
- the `conversation.module.ts` provider list keeps its order.

Four main specs cite the old paths, and `validate:specs` is a PR gate that fails on a missing path. So this change's path-only deltas are synced into `openspec/specs/**` in the same PR, before merge, rather than at a later archive.

## Risks / Trade-offs

- **[The parity test depends on a file outside the project]** → The path is asserted explicitly with a clear message. A move of `routes.ts` is rare and will be caught.
- **[A regex misses a reformatted enum line]** → The test fails rather than passing silently, because each member must be found.
- **[An enum change alters OpenAPI or the validation message]** → `npm run openapi` must produce no diff. No current test asserts the `uploadMode` message, so task 2.1 first adds an `UploadFileDto` validation test that pins it on the old code, then converts the type.
- **[A conflict with #9703]** → The only shared file is `files-upload.service.ts`, and the edits are one comparison (`UploadMode.CreateOnly`) and one disable comment, away from the code #9703 moves. Whichever PR merges second rebases trivially.
- **[A main-spec sync before merge diverges if the PR changes]** → The sync is the last task and is re-run if the deltas change.
