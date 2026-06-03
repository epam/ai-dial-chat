## Context

The conversation panel (`libs/conversation-panel`) was implemented as part of PR #6953 (branch `feat/conversation-panle`). The existing specs in `openspec/specs/conversations-api` and the `implement-conversation-panel` delta specs still describe an older planned design: `GET /api/v1/conversations` with offset-based pagination backed by an in-memory store. The shipped implementation uses `GET /api/v1/conversations/list` with DIAL Core metadata as the backing store and cursor-based (`nextToken`) pagination.

Two enhancements are now added on top of the shipped code:
- Panel open/close state is currently in-memory React state; it resets on every page reload.
- `listConversations` always queries from the DIAL Core bucket root with `recursive=true`; there is no way to scope the listing to a named subfolder path.

## Goals / Non-Goals

**Goals:**
- Sync `openspec/specs/conversations-api/spec.md` with the actual shipped endpoint shape.
- Add a `useLocalStorage<T>` hook that reads and writes a value to `localStorage`, replacing the `useState(false)` for `isHistoryPanelOpen` in `app.tsx`.
- Add an optional `path` query parameter to `GET /api/v1/conversations/list`; forward it to DIAL Core so callers can scope the listing to a subfolder. Empty string / omitted = root (current behavior, "My Files").

**Non-Goals:**
- Folder-tree navigation UI in the conversation panel (not this change).
- Server-side caching of the conversation list.
- SSR or cross-tab sync of the panel open/close state.

## Decisions

### 1. `useLocalStorage<T>` hook instead of Context

**Decision:** A standalone `apps/chat/src/hooks/useLocalStorage.ts` hook, following the `useFavicon` reference pattern (JSDoc, cleanup-safe, typed).

**Why:** Panel state is not shared across multiple consumers — only `app.tsx` reads and writes it. A dedicated Context for a single boolean would be over-engineering. A reusable `useLocalStorage` hook is smaller, composable, and testable in isolation.

**Alternative considered:** Extending `ThemeContext` or adding a `UIPreferencesContext`. Rejected — mixing unrelated UI preferences into a single context creates coupling and forces re-renders across all consumers whenever any preference changes.

**Implementation:** `useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void]` — reads from `localStorage` on first render, writes on every state update, guards against `JSON.parse` failures (returns `initialValue` on error). Storage key: `'conversationPanelOpen'`.

### 2. `path` as an optional query parameter, defaulting to `''`

**Decision:** Add `@IsString() @IsOptional() path?: string` to `ListConversationsQueryDto`. Pass it to `client.getConversationMetadata(bucket, path ?? '', ...)`.

**Why:** DIAL Core's metadata endpoint already accepts a path argument (the second positional parameter in the SDK). The current code hard-codes `''`, which means "bucket root". Making it a passable parameter requires only a DTO change and a one-line service change with no new DIAL Core API usage.

**Semantics:** `path === ''` or omitted → lists all conversations recursively from the bucket root ("My Files"). `path !== ''` → lists conversations recursively under that subfolder (e.g. `"work/project-x"`).

**Alternative considered:** Adding a dedicated `folder` resource and endpoint. Rejected — the path filter is a query-time scope, not a new resource; a separate endpoint would duplicate the pagination/mapping logic.

### 3. Spec sync approach

**Decision:** Overwrite `openspec/specs/conversations-api/spec.md` in place. Update the `implement-conversation-panel` delta spec to match the shipped API (endpoint path, pagination model, DTO shape). Do not add a backwards-compatibility shim or migration note — the in-memory store spec was never shipped.

**Why:** The in-memory spec was superseded before any consumer was built. Keeping a stale spec alongside the real one would confuse future implementors.

## Risks / Trade-offs

- **`localStorage` unavailable in SSR / private browsing** — `useLocalStorage` wraps `localStorage` access in `try/catch`; if storage is unavailable the hook falls back to `initialValue` and silently skips writes. No functional regression, panel just won't persist.
- **`path` forwarded verbatim to DIAL Core** — malformed paths (e.g., path traversal attempts) are validated by class-validator `@IsString()` and `@MaxLength(512)` but not further sanitised. DIAL Core is the authoritative access-control layer; the backend forwards only after authentication. Accept this risk given DIAL Core's own guardrails.
- **Spec sync is a documentation-only change** — no runtime behavior changes in the spec-sync slice. Risk of divergence again is low as long as future changes update the spec alongside the implementation.
