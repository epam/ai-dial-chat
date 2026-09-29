## Context

- Tool toggles come from `useToolsMenu` (`libs/chat-hooks/src/useToolsMenu/useToolsMenu.ts`): every boolean property of the selected deployment's configuration schema is a tool; state is local, reset to schema defaults on deployment change, and exposed as `toolConfigurationValue` (all tools, `true`/`false`). `restoreToolConfiguration(record)` already sets only known ids with boolean values and is a no-op when nothing changes.
- Every send (`handleSend`, `submitStarter` in `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`) puts `toolConfigurationValue` into `custom_content.configuration_value`; the backend forwards it as `custom_fields.configuration` (`apps/chat-api/src/conversations/generation/chat-completions.adapter.ts:60`). So changing toggle state is sufficient to change what the app receives next turn.
- `custom_content.form_schema` of an assistant message is replaced (not merged) by each streamed chunk that carries one, on both client (`apply-chunk.ts`) and server (`apply-chunk.server.ts`), and is persisted — it is available after reload.
- `Conversation.tsx` restores tool state once per conversation id on load from `getLastUserMessageToolConfiguration(result.messages)` (`restoredToolConfigIdRef`, line ~421). `conversation.messages` is live-updated during streaming.
- Stakeholder: StatGPT (epam/statgpt-backend#683) — sends `deep_research` on while running, off with the final report.

## Goals / Non-Goals

**Goals:**
- Assistant `form_schema` sets matching tool toggles, live and on load.
- User can override at any time; an applied app value is never re-applied over a later user choice.
- Keep `libs/chat-hooks` changes pure and host-agnostic.

**Non-Goals:**
- Rendering widgets/buttons for these properties.
- Backend/OpenAPI changes; non-boolean fields; `ConversationRoute` / `AppPreviewChat`.

## Decisions

### D1. Value resolution: `default`, then single-option `oneOf[0].const`

`getToolConfigurationFromFormSchema(formSchema): Record<string, boolean> | undefined` in `libs/chat-hooks/src/conversation/message-utils.ts` returns, per property, the boolean `default`, else the boolean `const` of a one-entry `oneOf`; `undefined` when no property yields a boolean. It does not filter by tool id — `restoreToolConfiguration` already ignores unknown ids, and the page filters for the dedup key (D3).
- Why `default` first: it is the JSON-Schema-native "current value" and unambiguous; the issue's `const`-per-option phrasing is ambiguous for two options (which is selected?), so `oneOf` is accepted only when it has exactly one entry.
- Alternative: honour property-level `const` too — deferred; not requested and easy to add later.

### D2. Load-time restore: last user `configuration_value` overlaid by later assistant `form_schema`

Add `getLatestToolConfiguration(messages): Record<string, unknown> | undefined` next to `getLastUserMessageToolConfiguration` (which stays unchanged and exported). It takes the last user message's `configuration_value` and spreads over it, in order, `getToolConfigurationFromFormSchema` of each assistant message after it. `Conversation.tsx` calls it instead of `getLastUserMessageToolConfiguration` inside the existing `restoredToolConfigIdRef` guard.
- Alternative: rely on the live effect alone to fix up state after load — rejected: couples correctness to effect ordering after an async load and to the once-per-id guard.

### D3. Live sync: effect in `Conversation.tsx` with an "applied key" ref

An effect depends on the last message of `conversation.messages` and the current tool ids (from `toolsMenuItems`). If that message is an assistant message, it resolves `getToolConfigurationFromFormSchema(msg.custom_content?.form_schema)`, keeps only current tool ids, and builds a key `conversationId|messageIndex|JSON(filtered values)`. If the key differs from `appliedFormSchemaKeyRef.current`, it calls `restoreToolConfiguration(filtered)` and stores the key. The load restore (D2) seeds the ref with the key of the last message so the effect does not re-apply on load.
- Why a key and not `form_schema` identity: stream chunks and reloads produce new objects with the same content; the key changes only when the app sends a different value (or a new assistant message), which is exactly when the app should win.
- Why filter by tool ids in the key: if the deployment schema is not loaded yet, the filtered set is empty → nothing applied, nothing marked; once tools appear the key changes and the value is applied.
- Why in the page, not in `useToolsMenu`: the hook knows nothing about messages or conversation ids; keeping it message-agnostic preserves its contract. A small helper `getFormSchemaToolSyncKey` MAY live in the lib if it keeps the page lean — still pure.
- Alternative: apply in `useConversationStream` on chunk — rejected: stream lib would need to know about tools state (cross-hook coupling) and would miss the load path.

### D4. No rendering changes

`getStartersFromSchema` already recognizes only `starter` / `button`, so a `deep_research` property renders nothing. No code change; a regression test asserts it.

### Library isolation

Only pure functions over `Message` / `DeploymentConfigurationSchema` (from `@epam/ai-dial-chat-shared`) are added to `libs/chat-hooks`. Messages, tool ids and the `restoreToolConfiguration` callback are supplied by the app page. No contexts, routing, env or client usage. Exports added to `libs/chat-hooks/src/index.ts` and documented in `libs/chat-hooks/README.md` (section "isMessageStreaming / getLastDeploymentId / … / getLastUserMessageToolConfiguration").

### Memoisation

The effect's inputs are the last message object and a memoised tool-id signature (`useMemo` over `toolsMenuItems` ids joined) so it does not run on unrelated renders; `restoreToolConfiguration` is already stable (`useCallback`).

## Risks / Trade-offs

- [App and user race during a stream: user toggles, then the app sends a new value] → by design the app's *new* value wins; an unchanged value is never re-applied. Documented in the spec.
- [Deployment reset effect in `useToolsMenu` fires after the restore when the deployment changes on load (inherited behaviour of the existing restore)] → unchanged risk; D3's tool-id-filtered key re-applies the live assistant value once tools appear. Covered by a page test with late-loaded configuration.
- [Apps may send two-option `oneOf` expecting it to work] → ignored by D1; contract communicated in issue #8968.
- [Regenerate/edit] → unaffected: they use the stored user-message configuration server-side; after the regenerated response streams, D3 applies its new `form_schema`.

## Migration Plan

Additive frontend-only change; no data migration. Rollback: revert the commit — conversations keep their stored `form_schema`, which is then simply ignored again.

## Open Questions

- Confirm with StatGPT that `default` (or single-option `oneOf`) is how they will send the value (comment on #8968 / statgpt-backend#683).
