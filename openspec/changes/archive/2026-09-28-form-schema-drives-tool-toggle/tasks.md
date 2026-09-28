Slicing strategy: vertical, lib-first. Slice 1 adds the pure resolvers in `libs/chat-hooks` (independently testable); slice 2 wires the load-time restore; slice 3 adds the live sync; slice 4 docs and closing verification.

## 1. Pure resolvers in libs/chat-hooks

- [x] 1.1 Add `getToolConfigurationFromFormSchema(formSchema)` to `libs/chat-hooks/src/conversation/message-utils.ts`: per property, boolean `default`, else boolean `const` of a one-entry `oneOf`; returns `undefined` when nothing resolves (design D1). JSDoc explains why `default` wins and why multi-option `oneOf` is ignored.
- [x] 1.2 Add `getLatestToolConfiguration(messages)` in the same file: last user message's `configuration_value` overlaid, in order, by `getToolConfigurationFromFormSchema` of each later assistant message (design D2). Leave `getLastUserMessageToolConfiguration` unchanged.
- [x] 1.3 Add `getFormSchemaToolSyncKey(conversationId, messages, toolIds)` in the same file: returns `{ key, values }` for the last message when it is an assistant message with resolved values filtered to `toolIds`, else `undefined` (design D3).
- [x] 1.4 Export the three functions from `libs/chat-hooks/src/index.ts` (extensionless relative imports).
- [x] 1.5 Unit tests in `libs/chat-hooks/src/conversation/tests/message-utils.spec.ts`: `default` true/false; single-option `oneOf` const; two-option `oneOf` ignored; non-boolean ignored; missing schema → `undefined`; latest = user value when no later assistant; assistant after last user overrides; assistant before last user ignored; sync key filters unknown ids, changes when value changes, stable across identical re-created schemas, `undefined` when last message is a user message.
- [x] 1.6 Architecture guard: confirm the new code in `libs/chat-hooks` imports only `@epam/ai-dial-chat-shared` types — no app contexts, server-api, generated client, env, routing, i18n or UI.

Verification:
- `npm run test:file -- libs/chat-hooks/src/conversation/tests/message-utils.spec.ts`
- `npm run verify:changed`

## 2. Load-time restore prefers later assistant form_schema

- [x] 2.1 In `apps/chat/src/pages/Conversation/Conversation.tsx`, replace the `getLastUserMessageToolConfiguration(result.messages)` call inside the `restoredToolConfigIdRef` guard with `getLatestToolConfiguration(result.messages)`, and seed a new `appliedFormSchemaKeyRef` with `getFormSchemaToolSyncKey(id, result.messages, toolIds)?.key` (so slice 3 does not re-apply on load).
- [x] 2.2 Tests in `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`: opening a conversation whose last user message has `deep_research: true` followed by an assistant message with `form_schema.properties.deep_research.default = false` renders the "Deep research" chip with `aria-pressed="false"`; without a later assistant value the chip is pressed (existing behaviour kept).

Verification:
- `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`

## 3. Live sync from the streaming / last assistant message

- [x] 3.1 In `apps/chat/src/pages/Conversation/Conversation.tsx`, memoise the tool-id list from `toolsMenuItems` (`useMemo`, signature string) and add an effect on the last message of `conversation.messages` + tool ids: compute `getFormSchemaToolSyncKey`; when its `key` differs from `appliedFormSchemaKeyRef.current`, call `restoreToolConfiguration(values)` and store the key. No explicit ref reset is needed: the key embeds the conversation id. The effect runs only once `restoredToolConfigIdRef` matches the current id, so a previous conversation's lingering messages are never applied to a newly opened one.
- [x] 3.2 Tests in `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`: a streamed assistant chunk with `deep_research.default = true` presses the chip; a later chunk with `false` un-presses it and the next send's request carries `configuration_value: { deep_research: false }`; after the app turns it off, the user clicking the chip keeps it pressed across a re-render with an identical `form_schema`; tool config loaded after the message applies the value once tools appear. The "no buttons for a tool-only `form_schema`" regression lives in `libs/chat-hooks/src/conversation/tests/starter-option.spec.ts` (`getStartersFromSchema`), since the page spec mocks `ConversationView`.

Verification:
- `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`
- `npm run verify:changed`

## 4. Docs and closing verification

- [x] 4.1 Update `libs/chat-hooks/README.md` section "isMessageStreaming / getLastDeploymentId / messageHasStages / getLastUserMessageToolConfiguration / normalizeResponseFormat" to document `getToolConfigurationFromFormSchema`, `getLatestToolConfiguration`, `getFormSchemaToolSyncKey` with a compiling example (value contract: boolean `default`, or one-entry `oneOf` with boolean `const`).
- [x] 4.2 Run `npm run validate:docs`.
- [x] 4.3 Run `npm run verify:full` once. (Typecheck, lint and all project tests pass for the changed code. Two unrelated local failures remain: Prettier on the untouched `apps/chat-api/README.md`, and a stale untracked `tools/scheduled-tasks-consumer-fixture` folder with no scripts.)

## 5. Follow-ups (out of scope)

- [ ] 5.1 Comment on issue #8968 (and statgpt-backend#683) confirming the value contract (`default` / single-option `oneOf` `const`) — only after the user approves posting.
