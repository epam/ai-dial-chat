# Verification evidence

## Reachability before the fix

On 2026-09-25 the new `completion-persistence.integration.spec.ts` was run through
`npm exec nx -- run chat-api:test --args="src/conversations/tests/completion-persistence.integration.spec.ts"`
against the unchanged production implementation. Two tests failed and the
successful-save control passed. Both failures reached the assertion expecting
`conversation_save_failed`: the actual downstream HTTP response contained the
text, stages, and `[DONE]`, with no storage-error frame. Earlier assertions had
already verified two actual SDK PUTs, the assembled answer in the second PUT,
the original token reused on both, and a stored empty placeholder after rejection.

The fixture runs a loopback Core HTTP server, the installed SDK through
`DialClientService`, the real persistence and streaming services, the real
generation registry, and the Nest completion controller. Identity/deployment
discovery are fixtures. One case moves a synthetic Core clock past its token's
expiry during streaming and then returns HTTP 401; the other returns HTTP 503
on the terminal write. These are real HTTP failures, not mocked persistence
exceptions. This proves application reachability; it does not establish which
failure occurred in the user's deployment or verify a particular IdP's policy.

## After the fix

The same three HTTP cases pass. Focused client coverage verifies preservation of
text/stages/state on explicit errors and legacy placeholder reloads, for both
original and attached streams; successful server enrichment and superseded
resume callbacks are also covered. The transport test verifies error processing
after `[DONE]` without exposing raw error text.

### Focused checks

All tests below ran through the owning Nx targets, prefixed with `npm exec nx -- run`.

| Target / scope | Result |
| --- | --- |
| `@epam/chat-api:test`: streaming service, attach HTTP integration, generation registry, completion-persistence HTTP integration | 112 passed in four files |
| `@epam/ai-dial-chat-hooks:test`: stream hook, resume helper, transport | 78 passed in three files |
| `@epam/chat:test`: ConversationMessageItem | 58 passed; includes answer plus warning in mobile/desktop and LTR/RTL modes |
| `@epam/ai-dial-chat-hooks:typecheck` | Passed; dependency builds and hook build also succeeded |
| `@epam/ai-dial-chat-hooks:lint` | Passed, zero errors and 12 existing warnings |
| Backend lint on changed TypeScript files | Passed after correcting one import-order error; existing warnings remain |
| App lint on changed TypeScript files | Nx dependency checks blocked execution; direct configured ESLint on the four affected files passed |
| `npm run validate:docs` | Passed, 45 Markdown files |
| `openspec validate preserve-answer-on-save-failure --strict` | Passed |
| `git diff --check` | Passed |

Total: **248 unique focused tests passed**. After the last callback guards were
adjusted, the two affected hook suites were rerun (63 passed) and the affected
hook files passed lint again. These reruns are not counted twice. UI checks are
component tests, not a browser screenshot or a production-session reproduction.

### Broad verification limitations

`npm run verify:changed` and `npm run verify:full` were each run once. Both stopped
in typecheck before their global lint/test phases. Neither broad check is green.
The failures are in existing, unmodified code:

- `libs/conversation-input`: UI-kit type mismatches, including removed Dropdown
  `listStyle`, command-menu `listboxId` / `activeOptionId`, and ModelMenuColors.
- `apps/chat-api/src/net/proxy-agent.setup.ts`: unresolved `undici`, missing
  proxy-from-env declarations, and an HttpsProxyAgent type mismatch.
- Backend spec typechecking consequently reads stale generated declarations
  after the source declaration build fails. Its missing-member diagnostics
  include the new `persistenceFailed` method as well as existing DTO/UI-event
  members. Backend-wide type safety is therefore not certified by this run.

Change-related test fixture type errors and the import-order error were fixed.
Unrelated dependencies and UI-kit migration code were left untouched. Full
verification must pass after those baseline problems are resolved before this
change can be described as merge-ready.

## Self-review

### Context and correctness

- [x] Implementation matches the proposal, design, specs, and task scope.
- [x] Regression fails before the fix, passes after it, and has a success control.
- [x] Reviewed done/stop/error finalization, one terminal write, lease checks,
  initial/attached streams, stages-only payloads, reload rejection, and stale
  callbacks after a newer generation or navigation.

### Readability and architecture

- [x] Failure signaling uses existing SSE envelopes and a typed client error.
- [x] Libraries receive host text through an optional parameter; no app context,
  auth setup, persistence adapter, or new dependency is introduced.
- [x] No REST DTO, endpoint, OpenAPI schema, or generated client changed.
- [x] Relative TypeScript imports follow the extensionless convention.

### Security and performance

- [x] Wire errors contain safe fallback text; raw SDK failures remain server-side.
- [x] Tests use a loopback fixture and synthetic credentials, not a real account.
- [x] No additional per-chunk I/O or persistence retry; retained buffers remain
  owned by the mounted hook and are replaced by subsequent generations.

### Responsive parity and documentation

- [x] Existing message alert renders with the retained answer in all four
  mobile/desktop and LTR/RTL component-test combinations.
- [x] No layout, breakpoint, directional styling, or interactive control changed.
- [x] Public hook exports/optional parameter and backend/architecture prose match
  implementation; documentation validation passed.

### Verdict

No additional implementation defect found in self-review. Broad verification is
blocked by the baseline failures above; this is not a merge approval. The fix
preserves received output locally and warns about failed persistence. Hard
reload, navigation that unmounts the hook, or process loss can still lose an
unsaved answer. Automatic recovery and auth refresh during streaming are outside
this change.
