# Agent guides

Canonical documentation lives under [`.claude/guides`](.claude/guides), surfaced via Claude Code skills:
- **`dial-architecture`** — [Architecture](.claude/guides/architecture.md): NX layout, Redux + RxJS epics, store/selectors/actions barrels, layer responsibilities
- **`dial-api-patterns`** — [API patterns](.claude/guides/api-patterns.md): Next.js API routes, session validation, streaming, error handling
- **`dial-development`** — [Development practices](.claude/guides/development-practices.md): naming conventions, component/hook patterns, lint/format, commits
- **`dial-testing`** — [Testing patterns](.claude/guides/testing-patterns.md): Vitest + @testing-library/react, Playwright e2e, fixtures, commands

Each skill auto-triggers when relevant (e.g., `dial-architecture` on store domain work, `dial-api-patterns` on `/pages/api/` changes).

Source originals: [`.codemie/guides`](.codemie/guides) (generated 2026-03-15).

## Project setup (this repo)

- [CLAUDE.md](CLAUDE.md) — NX layout, commands, env vars, store/API overview for DIAL Chat.
