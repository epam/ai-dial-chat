# Implementation notes

## Slice 1 — reproduction result (task 1.1–1.4)

The three new bearer-mode cases fail with exactly one cause, confirming the
diagnosis in `design.md`:

| Case                                        | Result                                   |
| ------------------------------------------- | ---------------------------------------- |
| `POST /conversations/completions`           | `expected 200, got 401 "Unauthorized"`   |
| `POST /conversations/completions/stop`      | `expected 204, got 401 "Unauthorized"`   |
| `POST /conversations/completions/attach`    | `expected 200, got 401 "Unauthorized"`   |

All 31 pre-existing cases in the two suites still pass. The `401` comes from
`ConversationController.requireSessionId`
(`apps/chat-api/src/conversations/conversation.controller.ts:107-114`), which
throws whenever `SessionUser.sid` is absent — and `sid` is absent by contract
for every header-authenticated caller.

## No frontend file is implicated (task 1.4)

Verified, not assumed:

- A repository-wide search for an `Authorization` **request** header across
  `apps/chat/src` and `libs/chat-hooks/src` returns no hit. Every match is UI
  label text for the toolset editor's "Authorization endpoint" field
  (`apps/chat/src/constants/translation-keys.ts`,
  `apps/chat/src/pages/ToolsetEditor/EditorForm/AuthSection.tsx`,
  `libs/chat-hooks/src/catalog/map-entity-details-to-catalog.ts`) — not a
  header construction.
- `createChatStreamApi`
  (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`) sends only
  `Content-Type`, `X-CSRF-Token` and `X-Timezone`.
- `createApiConfiguration` (`apps/chat/src/server-api/api-client.ts:78-83`)
  adds only CSRF, unauthorized-handling and telemetry middleware.
- `POST .../completions/attach` already travels the same generated-client path
  as every REST call that works
  (`apps/chat/src/server-api/conversations.api.ts:132-144`) and still returns
  `401` — isolating the fault to the controller gate rather than the transport.

In the affected setup the `Authorization` header is therefore supplied
uniformly by something outside `apps/chat`: an edge proxy/gateway, or a
non-`apps/chat` client of the BFF. The fix is backend-only; task 7.4 verifies
that claim against the actual diff.

## Deviation from the task text

`tasks.md` 2.2 names `apps/chat-api/src/auth/tests/session/principal-key.spec.ts`.
No `apps/chat-api/src/auth/tests/` directory exists; the repository convention
is a `tests/` folder beside the source it covers, so the spec was written to
`apps/chat-api/src/auth/session/tests/principal-key.spec.ts`, next to the
existing `session.guard.spec.ts` and `session.service.spec.ts`. Path only — the
coverage listed in the task is unchanged.

## Slice 7 — regression guard results (task 7.1–7.4)

- **7.1 / 7.2** Cookie-mode suites and `csrf.guard.spec.ts` pass unmodified.
  The only edits to pre-existing specs were the mechanical harness upkeep
  slice 5 called for (`req.authSource = AuthSource.Cookie`, and `TEST_USER.sid`
  → `` `c:${TEST_USER.sid}` `` on owner-key assertions). No cookie-mode
  assertion needed relaxing, which is the signal that behaviour did not move.
- One further harness needed the same upkeep, not listed in `tasks.md`:
  `apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts` builds
  its `Request` fixture by hand and registers directly against the registry.
  It got `authSource: AuthSource.Cookie` and `OWNER_KEY = 'c:test-session'`.
  Same class of change as 5.3, no behavioural edit.
- **7.3 — the check did report a diff, so the regenerate branch applied.**
  `npm run openapi` changed exactly four description strings in
  `libs/chat-api-client/openapi.json` and their two doc-comment copies in
  `src/generated/src/apis/ConversationsApi.ts`. No path, method, DTO, status
  code or `operationId` changed, confirming design Decision 8. `npm run
  openapi:check` then passes, and `nx run-many -t build,lint -p
  chat-api-client` is green. Those regenerated files are part of this change.
- **7.4 — backend-only claim holds, with the one anticipated exception.**
  `git status --porcelain` shows no file under `apps/chat/` and no
  hand-authored file under `libs/`. The two changed `libs/` files are the
  generated OpenAPI client artifacts that task 7.3 explicitly folds into this
  change; `libs/chat-api-client` is the generated-client exception in
  `AGENTS.md`'s library-isolation rule, so nothing there is hand-edited.

## Slice 9 — closing verification (task 9.1–9.3)

### What passes

| Command                                        | Result                                           |
| ---------------------------------------------- | ------------------------------------------------ |
| `npm exec nx test chat-api`                    | **pass** — 189 files, 3209 tests                 |
| `npm run test:file` (every suite in slices 1–7) | **pass**                                         |
| `npm run openapi` + `npm run openapi:check`    | **pass** (after the regenerate branch of 7.3)    |
| `nx run-many -t build,lint -p chat-api-client` | **pass**                                         |
| `npm run validate:docs`                        | **pass** — 46 markdown files                     |

### Pre-existing failures this change does not cause and does not fix

`npm run verify:full` (task 9.2) was run once. It fails at its **first** stage,
`typecheck:full:quiet`, so its lint and test stages never ran under it; those two
were then run directly (`npm run test:full:quiet`, `npm run lint:check:quiet`) to
get the same coverage. All three stages have failures that predate this change:

- **`typecheck` — `@epam/chat-api`, `@epam/chat`, `mcp-app-sandbox`.**
  `apps/chat-api`'s `tsconfig.app.json` emits declarations into `dist`, the same
  directory the webpack build target writes bundles into, so `tsc --build`
  reports `TS6305: Output file ... has not been built from source file` across
  the whole project. Reproduced on a pristine `git worktree` at `HEAD` (commit
  `ed9ca26bd`): **763 errors there vs 772 here**, and a per-error-code comparison
  is identical on every code except `TS6305`, which grows by exactly 9 — one per
  import line in the new/edited spec files. **This change introduces zero new
  type errors.** `@epam/chat`'s failure is in
  `apps/chat/src/utils/attachment-display-resolvers.ts` and `mcp-app-sandbox`'s
  is its own; neither app has a single changed file in this diff.
- **`lint` — 8 files, 24 errors, all `prettier/prettier`.** Six of the eight are
  files this change never touches (`conversation-publish.service.ts`,
  `external-services.mapper.ts`, `files-batch-operations.service.ts`,
  `publish.service.ts`, `trace-propagation.spec.ts`, `user-config.dto.ts`), all
  reporting the same union-type formatting disagreement — a prettier-version
  drift in the working copy. The one error inside a file this change edits,
  `conversation-generation.service.ts:36`, is on the pre-existing
  `GenerationTerminalEvent` union, which is **not in this diff** (verified with
  `git diff -U0`). The 5 warnings are pre-existing non-null assertions.
  Every line this change authored is prettier-clean.
- **`test:full` — `@epam/ai-dial-conversation-input`, `@epam/ai-dial-chat-hooks`.**
  4 failures in `AddAttachmentButton.tools.spec.tsx` and
  `create-files-api.spec.ts`. Neither library has a changed file in this diff.

### Acceptance criteria 1–8 (task 9.3)

| # | Criterion                                   | Evidence                                                                                                                                                                          |
| - | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Bearer caller can stream a completion       | `completions.integration.spec.ts` — "streams a completion for a bearer caller with no session cookie" (200 + SSE + owner key `h:keycloak:header-sub`). Persistence itself is unchanged code, covered by the existing streaming suites. |
| 2 | Same principal can stop (204) and attach    | "stops a bearer caller's own generation with 204"; `attach-generation.integration.spec.ts` — "replays snapshot, live chunks and one terminal event for the bearer principal".      |
| 3 | Different `sub` / different `providerId` → `404` | "does not let a different sub of the same provider stop the generation"; "treats the same sub under a different provider as a different principal"; "returns 404 and opens no stream for a non-owning principal" (also asserts the snapshot body does not leak). |
| 4 | Separator-colliding components stay distinct | `principal-key.spec.ts` — "keeps components that contain the separator distinct"; endpoint-level in "keeps principals whose components would concatenate identically isolated".     |
| 5 | Token renewal preserves ownership           | "keeps ownership across an access-token renewal" (stop 204 + live attach under T2); "conflicts on the same path after a token renewal instead of starting a second generation" (409). |
| 6 | Bad tokens → `401` + `AUTH_HEADER_TOKEN_*`  | `header-token.strategy.spec.ts` — pre-existing cases for expired / invalid-signature / untrusted-issuer / malformed, plus the two new `sub`-less cases. **Reasoned, not tested:** that these hold *on the three completion endpoints specifically* — rejection happens in `SessionGuard`/`HeaderTokenStrategy` before any controller runs, so it is endpoint-independent by construction. |
| 7 | Cookie-mode regression holds                | Every pre-existing cookie suite passes with only the mechanical harness edits of 5.3/5.4 — `csrf.guard.spec.ts`, `attach-generation-backpressure.spec.ts`, `conversation.controller.integration.spec.ts`, the 409/404/persistence/replay cases. |
| 8 | The four commands pass                      | `nx test chat-api`, `openapi:check` and `validate:docs` pass. **`nx lint chat-api` does not** — but only on pre-existing prettier drift in lines this change did not author, detailed above. |

## Slice 10 — out-of-scope findings, recorded as follow-ups (task 10.1–10.2)

Neither is fixed here. Both are accepted, documented consequences rather than
regressions introduced by this change.

### 10.1 A cookie session and a bearer client of the same human are distinct principals

Because the two authentication modes live in disjoint `c:` / `h:` namespaces
(design Decision 2), one person signed in through a browser cookie *and* holding
a bearer token is two principals. Both can start a generation on the same
conversation path at the same time, and both persist into the same conversation
resource — last writer wins.

This is not a new failure mode: two browser sessions of one user can already do
exactly this today, and the generation registry has never been the mechanism
that serialises writes to a conversation resource. The alternative — unifying
both modes onto `providerId` + `sub` — was rejected because it would change the
common, working cookie path's semantics (two tabs in different sessions would
start colliding with `409`) to fix a defect that only affects the bearer path.

**Follow-up, if it ever matters:** serialise writes at the conversation resource
itself (an ETag/optimistic-concurrency check on save), not at the registry. That
is a different change with a different blast radius.

### 10.2 `streamCompletion` captures the access token once, at request start

`ConversationStreamingService.streamCompletion` captures `token` at request start
and reuses it for the upstream relay *and* for the persistence writes that follow
the stream. A token that expires mid-generation therefore fails that generation:
DIAL Core rejects the calls and the generation finalises as an error.

This is pre-existing and shared with cookie mode — transparent refresh rotates
the cookie per request, not mid-stream — but it bites harder under header auth,
where the BFF refreshes nothing by contract. The mitigation shipped here is
bounded exposure and documentation, not a code change:
`MAX_GENERATION_DURATION_MS` caps how long a captured token can be in flight, and
`apps/chat-api/README.md` now tells operators to size token lifetime against that
bound.

**Follow-up, if it ever matters:** mid-stream credential rotation — the relay and
the persistence writes would need to re-read a refreshed token rather than close
over one. A separate change.
