# Refactoring audit — document templates

Use these templates when writing/updating local docs. **English only.** Replace `{DATE}` with audit date (YYYY-MM-DD). Compare against previous audit if `refactoring*.md` exist.

**Important:** Example table rows below use `{path}` placeholders. Fill every path from **current `collect-metrics.sh` output** — never copy stale paths from a prior audit or from this template.

---

## Index — `refactoring.md`

```markdown
# Refactoring Plan — Index

> Local document. Not committed — see `.git/info/exclude`.
> **Last review:** {DATE}

## Documents

| Document                                               | Scope              |
| ------------------------------------------------------ | ------------------ |
| **[refactoring-backend.md](refactoring-backend.md)**   | `apps/chat-api`    |
| **[refactoring-frontend.md](refactoring-frontend.md)** | `apps/chat` + libs |

## Scorecard (summary)

| Area                               | Status |
| ---------------------------------- | ------ |
| Phase 1                            | X/7    |
| Phase 2.1 DialCoreModule           | ✅/…   |
| Phase 2.3 Split FilesService       | …      |
| Phase 2.2 ConversationService      | …      |
| Phase 3.2 Split useDialFileManager | …      |
| Phase 4 Platform                   | …      |

## Top debt

| #   | Backend | Frontend |
| --- | ------- | -------- |

## Next steps

| P | Task | OpenSpec |

## OpenSpec prompts (exclude)

| Change | Status | File |
```

---

## Backend — `refactoring-backend.md`

Required sections:

1. Header (local-only notice, date, link to frontend doc)
2. **Scorecard** — Phase 2.x progress table
3. **Completed** — extractions with evidence (line counts, archive names)
4. **God modules** — services table (path, lines, Δ vs last audit, priority)
5. **Test monoliths** — spec files table
6. **New domains** — domains added since last audit
7. **Structural smells** — dispatch/registry/else-if/switch/nested ternary
8. **Convention violations** — AGENTS.md / RTL / lib isolation / imports / logging
9. **Issues** — numbered, prioritized
10. **Plan** — checkbox phases
11. **Priority matrix** — P0–P3
12. **PR order**
13. **Next OpenSpec prompt**
14. **Risks**
15. **Summary**

### Structural smells table (populate from metrics)

| File                  | Pattern          | Branches | Suggested fix | P   |
| --------------------- | ---------------- | -------: | ------------- | --- |
| `{path from metrics}` | `{pattern type}` |      {N} | {fix}         | P2  |

### Convention violations table (populate from metrics)

| File                  | Rule                   | Detail             | Fix   | P   |
| --------------------- | ---------------------- | ------------------ | ----- | --- |
| `{path from metrics}` | `{AGENTS/eslint rule}` | {count or snippet} | {fix} | P2  |

### Reference patterns (not file paths)

- Completed splits → matching archived OpenSpec under `openspec/changes/archive/`
- NestJS conventions → `apps/chat-api/AGENTS.md`
- Architecture + lib isolation → `openspec/config.yaml`, root `AGENTS.md`

---

## Frontend — `refactoring-frontend.md`

Required sections:

1. Header (local-only, link to backend doc)
2. **Scorecard** — Phase 1, 3.x, 4 (libs)
3. **Completed** — hook splits, shell, lib extractions
4. **Lib inventory** — table: lib name, total LOC, largest files, role
5. **God modules — App** — components, hooks, contexts, utils tables
6. **Test monoliths**
7. **Lib isolation** — ✅ good / ⚠️ issues
8. **Structural smells**
9. **Convention violations**
10. **Remaining duplication**
11. **Plan**
12. **Priority matrix**
13. **PR order**
14. **Next OpenSpec prompts**
15. **Risks**
16. **Summary**

### Reference patterns (not file paths)

- Hook decomposition → archived OpenSpec `split-use-dial-file-manager`
- Module boundaries → `eslint.config.mjs`
- Lib isolation rules → `openspec/config.yaml`, root `AGENTS.md`

---

## OpenSpec prompt — `docs/{change-name}-openspec-prompt.md`

Only when user asks for next-step prompt or P0 item needs OpenSpec. **English only.**

Structure:

1. Title + usage (`/opsx:propose`)
2. Fenced prompt block with: Why, What Changes, Boundaries table, Test strategy, Migration slices, Capabilities, Goals/Non-Goals, Constraints, Verification checklist, Reference files
3. How to use

Add filename to `.git/info/exclude`.

---

## Phase checklist (repo-specific)

Verify each item with grep/counts from the current run — see SKILL.md Step 4.

### Phase 1 — shared quick wins

- [ ] 1.1 dial-error.mapper
- [ ] 1.2 encode-dial-path
- [ ] 1.3 bucket validator
- [ ] 1.4 attachment mapper (chat-shared)
- [ ] 1.5 conversation hooks
- [ ] 1.6 useDialFileManagerState in conversation view
- [ ] 1.7 ThemesModule

### Phase 2 — backend

- [ ] 2.1 DialCoreModule
- [ ] 2.2 ConversationService split
- [ ] 2.3 FilesService split
- [ ] 2.4 toolsets/deployments/prompts
- [ ] 2.5 integration tests + mega-spec split

### Phase 3 — frontend

- [ ] 3.1 Conversation input extractions
- [ ] 3.2 useDialFileManager split
- [ ] 3.3 context slimming + share routes
- [ ] 3.4 server-api adapters

### Phase 4 — platform

- [ ] 4.1 Nx tags + depConstraints
- [ ] 4.2 chat-shared scope
- [ ] 4.3 type/route sync
- [ ] 4.4–4.7 mega-specs, RTL, metrics

Update checkbox states from code evidence, not from memory.
