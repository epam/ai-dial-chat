# Area (scope) taxonomy — ai-dial-chat

The `area` is the Conventional Commits **scope**: `<type>(<area>): <description>`. In this repo the
scope is the **name of the affected Nx project** (app or lib), or a technical area for cross-cutting
work. This mirrors the PR template, which requires `<type>(<scope>):` where `<scope>` is the
affected project.

## How to resolve `area`

Apply in order, stop at the first match:

1. **`area` argument given** → use it verbatim.
2. **Changes are inside one `libs/<name>/**`** → area is that lib's folder name (e.g. `catalog`).
3. **Changes are inside one `apps/<name>/`** → use `chat` for apps/chat, `chat-api` for apps/chat-api.
4. **A technical area below matches** (i18n, ci, infra, deps, openspec, docs, agents, e2e) → use it.
5. **Changes span several projects** → pick the project with the most changed lines. If a change
   touches one lib plus its host app, prefer the **lib** (that's where the substance is) unless the
   app holds the bulk of the diff.
6. **Truly cross-cutting / no clear home** → use the closest technical area, else omit the scope
   (`feat: …` is acceptable for repo-wide chores, matching repo history).

## Application areas (`apps/*`)

| Scope      | Project          | Covers                                                                              |
| ---------- | ---------------- | ----------------------------------------------------------------------------------- |
| `chat`     | `@epam/chat`     | Frontend app: pages, hooks, store, providers, app-level components not yet in a lib |
| `chat-api` | `@epam/chat-api` | NestJS backend: controllers, services, guards, auth, cookies, DIAL Core integration |

## Library areas (`libs/*`) — scope is the folder name

| Scope                   | Covers                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `attachment-canvas`     | Side canvas / attachment preview (PDF, JSON, MD rendering)    |
| `attachment-input`      | Attachment upload input and file handling UI                  |
| `builder-form`          | Shared builder/editor form page shell (header, column layout) |
| `catalog`               | Model/agent catalog UI (cards, favorites, browse)             |
| `chat-api-client`       | **Generated** OpenAPI client — regenerated, never hand-edited |
| `chat-shared`           | Shared types, utils, and components reused across libs        |
| `conversation-input`    | Message composer / prompt input                               |
| `conversation-messages` | Message list and message rendering                            |
| `conversation-panel`    | Conversation panel container and layout                       |
| `conversation-stages`   | Stage / step rendering inside a conversation                  |
| `scheduled-tasks`       | Scheduled tasks UI (detail view, cards, runs history)         |
| `sidebar`               | Sidebar navigation                                            |
| `source-panel`          | Sources panel                                                 |
| `starter-buttons`       | Starter prompt buttons                                        |

> `chat-api-client` changes are almost always the result of regenerating from OpenAPI sources. Do not
> hand-edit it; if you must scope a regeneration commit, use `chore(chat-api-client): regenerate client`.

## Technical / cross-cutting areas

| Scope      | Use when changes are limited to…                                                         |
| ---------- | ---------------------------------------------------------------------------------------- |
| `i18n`     | Locale files / translation wiring (`apps/chat/src/i18n/**`)                              |
| `ci`       | CI/CD pipelines, GitHub workflows, Nx Cloud config (`.github/workflows/**`)              |
| `infra`    | Helm, Docker, deployment, runtime/env config                                             |
| `deps`     | Dependency bumps only (`package.json` / `package-lock.json`)                             |
| `openspec` | OpenSpec changes and specs (`openspec/**`)                                               |
| `docs`     | Design docs and Markdown documentation (`docs/**`, README)                               |
| `agents`   | Agent config: `.agents/**`, `.claude/**`, `.cursor/**`, `AGENTS.md`, `CLAUDE.md`, skills |
| `e2e`      | End-to-end tests                                                                         |

## Self-extend (append-only)

If the resolved `area` is **not already in a table above**, append one row so the taxonomy grows.
Rules — be conservative:

1. **Confirm it's new** — `grep -F "<area>" .agents/skills/git-ship/areas.md`. If present, do nothing.
2. **Pick the right table**: a new `libs/*` → Library table; a new `apps/*` → Application table; a
   new non-project concern → Technical table.
3. **One new row per run**, matching the single resolved area. Don't bulk-invent areas.
4. **Append-only** — never rewrite or reorder existing rows.
5. The edit is staged by `git add`, so the taxonomy update ships in the **same commit**. Mention the
   added area in the final summary.
