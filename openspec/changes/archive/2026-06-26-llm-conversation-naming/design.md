## Context

Today `ConversationService.createConversation` derives a base name via `getConversationName` + `prepareEntityName`, fetches all user titles (`fetchAllUserTitles`), and resolves a unique display name with `resolveUniqueConversationName` before persisting at path `{deploymentId}__{name}` (2-part, no UUID). The auto-index spec mandates numeric suffixes on duplicate titles.

We are removing numeric deduplication on create and optionally renaming conversations via a utility model after the first assistant reply. All logic stays in `apps/chat-api`; the frontend continues to use message-based names until/unless a subsequent `GET` reflects an LLM rename. Config and feature flags follow the existing `ASR_MODEL` / `features.asrEnabled` pattern in `EnvConfigProvider` and `CONFIG_DEFINITIONS`.

## Goals / Non-Goals

**Goals:**

- Create conversations with unsuffixed `conversation.name` derived from `firstMessage`.
- Guarantee unique DIAL Core storage paths without changing the visible title.
- Register `UTILITY_MODEL` / `utility.modelId` and `features.llmConversationNaming` as the first utility feature-flag pattern.
- When enabled, asynchronously rename after exactly one user + one assistant message with non-empty text.
- Graceful degradation: LLM or rename failures never fail `saveConversation`.

**Non-Goals:**

- Frontend awareness of the utility model or feature flag.
- Renaming on regenerate, message edit, duplicate, or 2nd+ turns.
- New REST endpoints or OpenAPI changes.
- i18n / UI copy changes.
- Client-visible config for `utility.modelId` or `features.llmConversationNaming`.

## Decisions

### 1. Path collision strategy — hidden UUID segment (not 409 on create)

**Decision:** When `{deploymentId}__{baseName}` already exists in the user's bucket, persist at `{deploymentId}__{baseName}__{uuid}` where `uuid` is `crypto.randomUUID()` generated at create time. `conversation.name` remains the unsuffixed `baseName` in all cases.

When the 2-part path is free, keep using `{deploymentId}__{baseName}` (no UUID) for backward compatibility and cleaner URLs.

**Rationale:**

| Approach | Pros | Cons |
|---|---|---|
| **409 on path collision** | Simple contract | Poor UX: user's first message fails after model selection; frontend must handle retry/rename |
| **Hidden UUID on collision (chosen)** | Create always succeeds; display name stays clean; reuses existing 3-part path parsing (`getConversationTitleFromName`, `buildRenamedConversationPath`) | Two path shapes coexist; list shows duplicate display titles |
| **Always 3-part path** | Simplest collision logic; drops `fetchAllUserTitles` on create entirely | Changes every new conversation's URL shape |

409 is rejected because conversation create is on the critical first-send path. Always-UUID is rejected to avoid unnecessary URL churn for the common case.

**Collision detection:** Replace `fetchAllUserTitles` on create with a targeted metadata lookup: check whether a resource exists at `{deploymentId}__{baseName}` (via `getConversationMetadata` with `path` scoped to that filename, or equivalent SDK call). No full-bucket title scan.

### 2. Remove numeric suffix on create; keep utility for duplicate only

**Decision:** Delete `resolveUniqueConversationName` and `fetchAllUserTitles` calls from `createConversation`. Retain both for `duplicateConversation`, which still needs a unique title **and** path distinct from the source.

Duplicate flow is unchanged in spirit: numeric suffix on the **duplicate's** `name` and path remains acceptable (out of scope for this change).

### 3. Idempotency marker — `llmNamingDone` on conversation JSON

**Decision:** Add optional boolean `llmNamingDone?: boolean` to the persisted conversation object (OpenAPI `ConversationResponseDto` + stored DIAL Core body). Set `false` implicitly on create; set `true` after a successful LLM rename.

**Alternatives considered:**

- **Heuristic (`name === deriveFromFirstMessage`)** — fragile when the LLM returns the same string as the message-derived name; cannot distinguish "not yet run" from "ran and kept same title".
- **Message-level custom_content flag** — leaks into message history; harder to query.

Trigger conditions in `saveConversation` hook (all must hold):

1. `features.llmConversationNaming` resolves `true` for the request context.
2. `llmNamingDone` is not `true`.
3. Exactly 2 non-status messages: 1 user + 1 assistant.
4. Both messages have non-empty `content` (after trim).
5. Assistant message is the last message in the array (not a mid-save partial).

### 4. Hook location — fire-and-forget from `saveConversation`

**Decision:** After a successful DIAL Core `saveConversation`, call `void conversationNamingService.maybeRenameAfterFirstReply(...)` without awaiting.

`ConversationNamingService` is a new `@Injectable()` in `conversations/`, injected into `ConversationService`. It owns the LLM call and updates the display name via in-place `saveConversation` at the same storage path (no `renameConversation` / path move).

**Why not a new endpoint:** Renaming is a side effect of the normal save cycle; the frontend polls `GET conversation` for async title updates. No client contract change beyond optional `llmNamingDone` on the conversation body.

### 5. Utility model config and feature flag

**Env / registry:**

| Key | Type | Visibility | Env var | Notes |
|---|---|---|---|---|
| `utility.modelId` | config | `server` | `UTILITY_MODEL` | Optional string; not exposed to client |
| `features.llmConversationNaming` | feature | `server` | (derived) | Default `false` |

**Derived flag logic** (mirror `features.asrEnabled` in `EnvConfigProvider`):

```text
features.llmConversationNaming === true
  WHEN UTILITY_MODEL is set
   AND DIAL_API_KEY is set
   AND LLM_CONVERSATION_NAMING_ENABLED === 'true'
```

Add `UTILITY_MODEL?: string`, `DIAL_API_KEY?: string`, and `LLM_CONVERSATION_NAMING_ENABLED?: boolean` (with `@Transform` from string) to `EnvironmentVariables`.

**Pattern for future utility flags:** Each utility capability gets a `features.*` entry with `visibility: 'server'`, derived from `UTILITY_MODEL` presence plus an explicit opt-in env boolean (`*_ENABLED=true`). Config keys for model ID live under `utility.*` with `visibility: 'server'`. Client never sees utility model deployment IDs.

### 6. LLM call shape

**Decision:** Non-streaming `sendChatCompletionRequest` to `UTILITY_MODEL`, authenticated with `DIAL_API_KEY` via `Api-Key` header (not the user's session token):

- `stream: false`
- System prompt from `apps/chat-api/src/conversations/prompts/conversation-naming.prompt.ts`
- User message: plain text concatenation of first user `content` and first assistant `content`, separated by `\n\n---\n\n`
- Response: `choices[0].message.content` → `prepareEntityName` → in-place `saveConversation` with `{ name, llmNamingDone: true }`

**Timeout:** `UTILITY_NAMING_TIMEOUT_MS` env var, default `10_000`, enforced via `AbortController` passed as `signal` to `sendChatCompletionRequest`. On timeout, log warning and keep original name.

**Rate limit:** No per-user throttle in v1; utility model throughput is bounded by DIAL Core deployment limits. Log at `warn` if rename is skipped because a previous rename for the same conversation id is in-flight (in-memory `Set<string>` of pending ids, cleared on completion).

### 7. In-place display name update after LLM

After a successful LLM response, the naming service reloads the conversation and calls `saveConversation` at the **same storage path** with `{ name: sanitisedTitle, llmNamingDone: true }`. Storage path and `conversation.id` remain unchanged. If the in-place save fails, log a warning and leave the message-derived name; do not throw to the save caller.

### 8. System prompt (starting draft)

Stored in `conversation-naming.prompt.ts` as `CONVERSATION_NAMING_SYSTEM_PROMPT`:

```text
You generate short conversation titles for a chat application.

Given the user's first message and the assistant's first reply, output a concise title that describes the topic.

Rules:
- Output ONLY the title text. No quotes, labels, markdown, or explanation.
- Maximum 8 words.
- Use the same language as the user's first message.
- Be specific; avoid generic titles like "Chat", "Question", or "Help".
- Do not include personal data, secrets, or file names unless essential to the topic.
- Prefer noun phrases over full sentences.
```

## Risks / Trade-offs

- **[Duplicate display titles in sidebar]** Multiple conversations can show `"Hello"` → Mitigation: acceptable product trade-off; paths remain unique; LLM naming (when enabled) differentiates after first reply.
- **[LLM rename races with user manual rename]** User could PATCH title before LLM completes → Mitigation: check `llmNamingDone` and re-read conversation before rename; skip if flag already true or name no longer matches derived base name.
- **[Fire-and-forget errors invisible to user]** → Mitigation: structured `logger.warn` with conversation id; original name retained.
- **[Extra DIAL Core call per first reply when flag on]** → Mitigation: single call; 10s timeout; skip when flag off (zero overhead).

## Migration Plan

1. Deploy backend with flag off (default) — create behavior change only (no suffix, collision UUID).
2. Set `UTILITY_MODEL`, `DIAL_API_KEY`, and `LLM_CONVERSATION_NAMING_ENABLED=true` in target environments when ready.
3. Rollback: set `LLM_CONVERSATION_NAMING_ENABLED=false` (or unset `UTILITY_MODEL`); message-derived names remain.
4. No data migration for existing conversations; `llmNamingDone` absent is treated as `false` only when other trigger conditions match.

## Open Questions

- None blocking implementation. Operator may tune `UTILITY_NAMING_TIMEOUT_MS` after observing utility model latency in production.
