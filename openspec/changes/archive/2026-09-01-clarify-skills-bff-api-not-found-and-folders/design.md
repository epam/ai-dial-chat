## Context

`skills-bff-api` was archived from `openspec/changes/archive/2026-08-10-add-skills-bff-api` (with a follow-up contract correction in `2026-08-13-fix-skill-editor-core-contract`). A QA pass on the resulting API (issue #8258) found spec text that a black-box caller cannot verify, one undocumented real behavior, one broken example, and two places where the spec's stated requirement and the shipped code disagree. This change is spec-only: it rewrites `openspec/specs/skills-bff-api/spec.md` so the document matches what a caller can actually observe and what the implementation actually intends, without touching `apps/chat-api/src/skills/**`.

## Goals / Non-Goals

**Goals:**
- Make every "not found" scenario in `skills-bff-api` testable from the request/response the caller sees, not from an internal DIAL Core signal the caller cannot inspect.
- Document `createSkillGroupingFolder`'s real implicit-parent-creation behavior instead of leaving a scenario that cannot be reached.
- Fix the grouping-folder-creation example so a client author who copies it gets a working call.
- Resolve the two spec-vs-code contradictions (grouping-folder create status code, `Content-Length` on downloads) by deciding, per case, which side is correct, and recording that decision plus any resulting follow-up code work.

**Non-Goals:**
- No changes to `apps/chat-api/src/skills/**` in this change. Where the decision is "the code is wrong, fix the code," that fix is a separate change referencing this design doc, not part of this one.
- Not fixing the pagination empty-page bug (#6 in the QA report) — unrelated to the not-found/folder-creation scenarios this change addresses, and already scoped as its own code-fix change.
- Not resolving the QA report's UI-side items (Retry action, mobile panel default, file-tree keyboard access) — those are frontend/`skill-editor` concerns, not `skills-bff-api` contract concerns.

## Decisions

### D1 — Reword "not found" scenarios to be request-observable

**Decision:** Every scenario currently phrased "WHEN DIAL Core returns 404 for the given `<path>`" becomes "WHEN the given `<path>` holds no resource" (or the `filePath`/parent-path equivalent), with the THEN clause unchanged (`404 Not Found`).

**Why:** The old wording makes DIAL Core's internal response the trigger, which a caller testing only the BFF's public HTTP surface cannot observe or control directly — they can only control what path they ask for. QA's own investigation found this made three of these scenarios untestable, since DIAL Core's "no access" response is identical whether the path is genuinely absent or exists-but-forbidden for a different reason. Rewording to the caller-observable condition doesn't change what the BFF actually does (it already just forwards a `404` when the path is absent); it changes the spec to describe the contract from the side that can verify it.

**Alternative considered:** Mark these scenarios "internal-only, not independently testable." Rejected — the underlying behavior (return 404 for a genuinely missing path) *is* externally testable; only the old wording wasn't.

**Affected scenarios:** "Grouping folder not found" (list), "Skill not found" (list files, download, delete), "File not found" (download file).

### D2 — Document implicit parent-folder creation for `createSkillGroupingFolder`; drop "Parent path not found"

**Decision:** Add a scenario stating that creating a grouping folder under a path whose intermediate segments do not yet exist creates all of them and returns `201 Created`, matching real behavior. Remove the "Parent path not found -> 404" scenario.

**Why:** The implementation silently creates the full intermediate path and returns success; there is no code path left that can produce a "parent not found" 404 for this operation once implicit creation is the accepted behavior. Keeping the old scenario describes a case that cannot occur, which is worse than no scenario at all (per `.claude/rules/docs.md`: "when intent and code disagree, state the disagreement rather than documenting the intent" — here, once we've decided implicit creation is intended, the disagreement is resolved by removing the unreachable case, not by describing intent the code contradicts).

**Consequence for code:** The controller's declared `@ApiResponse` for `404 'Parent path not found'` on `createSkillGroupingFolder` (`apps/chat-api/src/skills/skills.controller.ts`) will need to be removed to match — recorded as a follow-up code item, not done in this change.

**Alternative considered:** Keep "Parent path not found -> 404" and treat implicit creation as the bug to fix instead. Rejected for this change: implicit parent creation is a reasonable, common REST convention (mkdir -p semantics) and QA's own report frames it as "a normal design choice... written down nowhere," not as something they expect reversed. If a future decision reverses this, it replaces this scenario again.

### D3 — Fix the grouping-folder-creation example (drop the trailing slash)

**Decision:** Change the example from `path=team-a/` to `path=team-a`.

**Why:** DIAL Core's underlying route already appends the folder-marking trailing slash itself (`PUT /v2/skills/{bucket}/{path}/`, per the requirement text one paragraph above the example) — sending a trailing slash from the client produces a doubled slash the handler 404s on. The no-slash form is the one that actually works.

### D4 — Keep `201 Created` as the spec's required status code for grouping-folder creation; flag `200 OK` in code as the item to fix

**Decision:** The spec's existing requirement text and "Successful grouping-folder creation" scenario already say `201 Created`. This change makes no wording change here — it records, as an explicit open item below, that `apps/chat-api/src/skills/skills.controller.ts`'s `createSkillGroupingFolder` handler currently has `@HttpCode(200)`, which contradicts the spec, and needs a follow-up code change.

**Why 201 is the side that should win:** `201 Created` is the correct status for a request that creates a new resource, matching every other create endpoint in this same spec (`createSkill` also returns `201`). `200 OK` gives callers no way to distinguish "created" from "already existed and nothing changed," which is exactly the ambiguity QA's report calls out.

**Alternative considered:** Change the spec to `200 OK` to match the shipped code. Rejected — that would paper over a real REST-semantics defect instead of fixing it, and would make `createSkillGroupingFolder` inconsistent with `createSkill`'s `201` in the same API.

### D5 — Drop the `Content-Length`-forwarding requirement for skill/file downloads

**Decision:** Remove `content-length` from the safe-header-forwarding requirement text for `downloadSkill` (`GET /api/v1/skills/download`) and `downloadSkillFile` (`GET /api/v1/skills/files/download`), and from the two "Successful ... download" scenarios. The forwarded set becomes `content-type`, `content-disposition`, `etag`.

**Why:** Both operations stream the DIAL Core response body straight through via the SDK's raw `fetch` (`parseAs: 'stream'`) with no buffering (`apps/chat-api/src/skills/download/skills-download.service.ts`). Node's `fetch` can transparently decode a `Content-Encoding` on the upstream response, in which case any `Content-Length` DIAL Core sent describes the wire (possibly compressed) size, not the byte count this BFF actually streams onward — forwarding it verbatim would risk a client-observed length mismatch, which is worse than omitting the header. This is already the implemented behavior, with its own code comment explaining the same reasoning; this decision brings the spec in line with a design choice that was already made and is not being revisited here.

**Alternative considered:** Fix the code to compute and forward a correct `Content-Length` (e.g. by buffering the full body first, or by only omitting it when a `Content-Encoding` is actually present). Rejected for this change: buffering full skill ZIPs (up to the documented 16 MiB / 100-file limits) defeats the explicit streaming/no-buffering requirement stated elsewhere in this same spec ("stream ... without buffering the full body"), and conditionally forwarding based on `Content-Encoding` presence is a real code change, not a documentation fix — out of scope here. If a future need for progress/integrity checking (the original QA motivation) justifies that engineering cost, it is a separate change that can revisit this decision.

## Risks / Trade-offs

- **[Risk]** Removing `Content-Length` from the documented contract means download progress bars and integrity checks relying on it will not work against this BFF. → **Mitigation:** this is already true of the shipped code; the spec change only stops promising something the implementation doesn't deliver. A future change can add correct length reporting if the product need justifies the buffering/complexity trade-off, and can reference this decision as the prior art to revisit.
- **[Risk]** Removing the "Parent path not found" scenario could be read as silently endorsing implicit parent creation without a security/quota review (e.g. arbitrarily deep folder trees created in one call). → **Mitigation:** out of scope for a wording-only spec change; flagged as an open question below for whoever owns quota/abuse limits on this endpoint.
- **[Risk]** This change intentionally leaves two known spec-vs-code mismatches unresolved in code (`200` vs `201`, pagination empty pages are out of scope entirely). → **Mitigation:** both are called out explicitly in proposal.md's Impact section and tasks.md, so they are not lost — they become the seed of the next, code-focused change(s).

## Open Questions

- Should `createSkillGroupingFolder`'s implicit parent creation have a depth or rate limit, given it can create multiple folders from a single unauthenticated-body request? (Not blocking this spec-wording change; worth raising before/alongside the `200`→`201` code fix.)
- Once the `200`→`201` code fix ships, should the "Name collision rejected" scenario be re-verified to confirm it still returns `400` for an existing skill/folder collision, given the status-code change is scoped to the "new folder" success path only?
