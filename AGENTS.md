<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `npm exec nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Architecture context

Full tech stack, path aliases, commands, and architecture layout live in `openspec/config.yaml` — read it before designing or implementing features. The `opsx:*` skills use it as their primary context.

## Cross-agent feature research

For broad "global feature" research (best practices, architecture alternatives, trade-offs), use `./.claude/skills/feature-research/SKILL.md` as the default workflow before implementation.

Expected output:

- Context and constraints
- 2-4 options with trade-offs
- Recommended approach
- Risks and rollback notes
- Thin-slice implementation draft with Nx verification steps

## Skill routing

Use these local skills directly:

- `./.claude/skills/incremental-implementation/SKILL.md` for multi-file implementation and refactors
- `./.claude/skills/code-review-and-quality/SKILL.md` for review before merge or any quality pass
- `./.claude/skills/feature-research/SKILL.md` for broad feature research and trade-off analysis
- `./.claude/skills/figma/SKILL.md` for translating Figma designs into React components

Default behavior:

- Implementation work should follow incremental slices with per-slice verification.
- Before merge (or on explicit review requests), run the five-axis quality review.

