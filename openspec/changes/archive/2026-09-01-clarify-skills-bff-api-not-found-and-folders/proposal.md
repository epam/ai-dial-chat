## Why

QA on GitHub issue [#8258](https://github.com/epam/ai-dial-chat/issues/8258) found that the archived `skills-bff-api` spec (`openspec/specs/skills-bff-api/spec.md`) contains scenarios that are unverifiable or contradicted by the current implementation:

- Several "not found" scenarios are worded as "WHEN DIAL Core returns 404", a condition on Core's internal answer rather than on anything the caller can observe — QA could not tell a genuine 404 from Core's own 403-masked-as-404 behavior, so these scenarios cannot be tested from outside the BFF.
- Creating a grouping folder under a missing parent path is only documented as a `404` ("Parent path not found") scenario, but the implementation silently creates every missing intermediate folder and returns success — an undocumented behavior that contradicts the controller's own declared `404` response.
- The spec's own example for grouping-folder creation uses a trailing-slash path (`path=team-a/`) that 404s against the real handler; the working form has no trailing slash.
- The spec requires `201 Created` for a new grouping folder and requires forwarding `Content-Length` on skill/file downloads, but the current implementation returns `200 OK` for folder creation and deliberately omits `Content-Length` (`skills-download.service.ts`, `SAFE_SKILL_DOWNLOAD_HEADERS`) because the SDK streams the raw upstream body and the wire length is not guaranteed to match what Node re-frames.

Left as-is, the spec both fails to describe real behavior and asserts requirements the code does not (and, for `Content-Length`, arguably should not) satisfy, so anyone testing or extending the Skills BFF against the spec text alone gets the wrong answer.

## What Changes

- Reword every "not found" scenario in `skills-bff-api` (skill, file, and grouping-folder not-found cases across list/download/delete operations) from "WHEN DIAL Core returns 404 for the given path" to a request-observable condition: "WHEN the given path holds no resource" (or the file/folder equivalent). No behavior changes; this only makes the scenarios testable from the caller's side.
- Document implicit parent-folder creation as the accepted behavior of `createSkillGroupingFolder`: creating `a/b/c` when `a/` and `a/b/` do not yet exist SHALL create all missing intermediate folders and return success. Remove the now-contradicted "Parent path not found -> 404" scenario, since DIAL Core's own grouping-folder write endpoint has no way to fail on a missing parent once implicit creation is the documented contract.
- Fix the grouping-folder creation example to omit the trailing slash (`path=team-a`, not `path=team-a/`), matching the path form the handler actually accepts.
- **Modify the grouping-folder-creation requirement's status code**: keep the spec's existing `201 Created` requirement (this was already correct) and flag the current `200 OK` implementation as a spec-vs-code contradiction to be resolved by a follow-up **code** change (not in this change) — recorded as a design note and an open item, not silently dropped.
- **Modify the skill/file download requirements**: drop the `Content-Length`-forwarding requirement from the safe response-header contract for `downloadSkill` and `downloadSkillFile`. Document that DIAL Core downloads are streamed via the SDK's raw `fetch` body (`parseAs: 'stream'`) without buffering, so the number of bytes this BFF re-frames is not guaranteed to equal any upstream `Content-Length` the SDK may have seen — omitting the header is the documented, intentional design already implemented, not a gap.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skills-bff-api`: reword not-found scenarios to be request-observable; document implicit grouping-folder parent creation and drop the contradicted "Parent path not found" scenario; fix the grouping-folder-creation example's trailing slash; drop the `Content-Length` forwarding requirement for skill/file downloads (keep `content-type`, `content-disposition`, `etag`); keep the `201 Created` requirement for grouping-folder creation as-is and record the current code's `200 OK` as an open follow-up item in design.md.

## Impact

- `openspec/specs/skills-bff-api/spec.md` — the only file with behavior-affecting text changes in this change.
- No production code changes in this change. Two follow-up code items are recorded in `design.md` for separate changes:
  - `apps/chat-api/src/skills/skills.controller.ts` (`createSkillGroupingFolder`, currently `@HttpCode(200)`) needs to be changed to `201` to match the spec this change keeps unchanged.
  - `apps/chat-api/src/skills/listing/skills-listing.service.ts` pagination (empty pages with a live `nextToken`) is a separate, already-identified code bug from the same QA report and is out of scope here — it does not touch the scenarios this change rewords.
