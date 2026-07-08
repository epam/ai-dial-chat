# Commit message examples — ai-dial-chat

Format:

```
<type>(<area>): <short description> (Issue #<ticket>)
```

- `<area>` is the affected project or technical area — see `.agents/skills/git-ship/areas.md`.
- Scope is **recommended** for `feat` / `fix` / `refactor` / `chore` that touch one project.
- Scope may be **omitted** for repo-wide work (`chore: …`, `ci: …`) — matches repo history.
- Breaking change → add `!` before the colon: `feat(catalog)!: …`.
- `(Issue #<ticket>)` is appended when a ticket exists; drop it when there genuinely is none.

## Type selection

| Type       | When to use                           |
| ---------- | ------------------------------------- |
| `feat`     | New feature or capability             |
| `fix`      | Bug fix                               |
| `chore`    | Maintenance, deps, config, tooling    |
| `refactor` | Restructuring without behavior change |
| `docs`     | Documentation only                    |
| `test`     | Tests only                            |
| `ci`       | CI/CD pipeline changes                |
| `style`    | Formatting, no logic change           |

## Examples (drawn from real repo history)

```
feat(attachment-canvas): support PDF preview in side canvas (Issue #7213)
fix(conversation-input): add tooltip for send button (Issue #7452)
feat(catalog): equal card heights and favorites star toggle (Issue #7432)
feat(chat): add conversation settings (Issue #7087)
fix(chat): add side margins for mobile confirmations popup (Issue #7383)
feat(chat-api): add shared and public file listing endpoints (Issue #7407)
chore(chat-shared): extract common Card component
refactor(conversation-input): split Input component (Issue #7408)
ci: fix development tag conflict (Issue #7442)
chore(deps): remove @nestjs/testing and add @types/multer
docs: actualize and archive chat settings spec (Issue #7422)
```

## Branch name

Derive the branch from the description slug — lowercase, hyphens only, **no ticket number**:

```
<type>/<short-slug>
```

Example:

- Commit: `feat(catalog): equal card heights and favorites star toggle (Issue #7432)`
- Branch: `feat/equal-card-heights-favorites`
