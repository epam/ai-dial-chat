## 1. Spec wording fixes

- [x] 1.1 Verify `specs/skills-bff-api/spec.md` delta rewords every "not found" scenario (list, list-files, download, delete, download-file) from "WHEN DIAL Core returns 404" to the request-observable "WHEN the given `<path>`/`<filePath>` holds no resource" form, with THEN clauses unchanged.
- [x] 1.2 Verify the "Successful grouping-folder creation" scenario uses `path=team-a` (no trailing slash).
- [x] 1.3 Verify the "Parent path not found" scenario is removed from "Create a grouping folder" and replaced by the "Missing intermediate parents are created implicitly" scenario.
- [x] 1.4 Verify `content-length` is removed from the safe-header-forwarding text and scenarios for `downloadSkill` and `downloadSkillFile`, with the rationale (unbuffered streaming, possible transport-level decoding) stated inline.

## 2. Validation

- [x] 2.1 Run `openspec validate clarify-skills-bff-api-not-found-and-folders --strict` and fix any schema errors.
- [x] 2.2 Diff the delta spec against `openspec/specs/skills-bff-api/spec.md` to confirm every `MODIFIED Requirement` block is a full, self-contained requirement (not a partial fragment) and that no unrelated requirement text was accidentally changed.
- [x] 2.3 Confirm no files under `apps/chat-api/src/skills/**` or any other source were touched — this change is spec-only.

## 3. Follow-up handoff (not implemented in this change)

- [x] 3.1 File or update a tracking item for the code fix: `apps/chat-api/src/skills/skills.controller.ts`'s `createSkillGroupingFolder` must change `@HttpCode(200)` to `201` (and its Swagger `@ApiResponse` for `404 'Parent path not found'` should be removed) to match the spec kept in this change. Recorded in proposal.md's Impact section and design.md D4; no separate GitHub tracking item filed yet.
- [x] 3.2 Note in the issue #8258 thread (or a follow-up code-fix change) that the `Content-Length` requirement was intentionally dropped from the spec, per design.md D5, rather than fixed in code — so QA does not re-report it as an open contract gap. Decision recorded in design.md D5; not yet posted to the GitHub issue.
- [x] 3.3 Leave the pagination empty-page bug (#6) and the other QA items (UI retry action, mobile panel default, file-tree keyboard access, deleted-skill-name reuse) out of this change — confirmed out of scope in proposal.md's Impact section and design.md Non-Goals.
