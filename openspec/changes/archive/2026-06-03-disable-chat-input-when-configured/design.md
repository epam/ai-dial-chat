## Context

`DeploymentsContext` already fetches and exposes `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` for the selected deployment. `ConversationRoute` reads it today (for starter buttons). `ConversationView` currently destructs from `useDeployments()` without pulling `selectedDeploymentConfiguration`.

`DeploymentConfigurationSchema` is an open interface (`[key: string]: unknown`) — `dial:chatMessageInputDisabled` is a valid key but has no typed field, requiring callers to cast from `unknown`.

`ConversationInput` and its inner `Input` component have no `isInputDisabled` prop. The existing `isStreaming` prop disables Enter and swaps the send button for a stop button — it does not disable the textarea or the attach path. The `isDisabled={!hasModelSelected}` on the send button (line 363 in Input.tsx) is the only partial precedent.

## Goals / Non-Goals

**Goals:**

- When `selectedDeploymentConfiguration?.['dial:chatMessageInputDisabled'] === true`, prevent the user from: typing in the textarea, submitting via Enter, clicking the send button, opening the attach menu, and dropping files.
- Keep starter, form, and action buttons rendered and usable regardless of this flag.
- Apply consistently on both the welcome/new-conversation screen (`ConversationRoute`) and inside an existing conversation (`ConversationView`).
- Add an explicit `'dial:chatMessageInputDisabled'?: boolean` typed field to `DeploymentConfigurationSchema` for type-safe app-edge access.
- Keep all DIAL-specific config knowledge in the app layer; `libs/conversation-input` receives only a generic `isInputDisabled?: boolean`.

**Non-Goals:**

- Server-side enforcement — DIAL Core already validates; this change reduces UX friction, not adds a security gate.
- Disabling the `EditMessageInput` path — editing an existing message is a different flow and is not affected by this flag.
- Inferring disabled state from `message.custom_content.form_schema` — the source of truth is the deployment configuration schema, not the message.
- Any UI change to how starter/action buttons look when input is disabled.

## Decisions

### 1. Add `isInputDisabled` to both `Input` and `ConversationInput`

**Chosen**: Add `isInputDisabled?: boolean` to `InputProps` and `ConversationInputProps`. `ConversationInput` passes it straight through to `Input`.

**Alternative considered**: Only add it to `ConversationInput` and implement the behavior inside `ConversationInput` wrapping `Input`. Rejected because `Input` already owns the textarea, Enter key handler, send button, and attach button — duplicating those guards at `ConversationInput` would create two places to maintain the same invariant.

**Alternative considered**: A compound approach — `isDisabledReason?: 'config' | undefined` — would let the UI render a tooltip explaining why it is disabled. Deferred; the spec does not require tooltip messaging for this flag.

### 2. App-edge mapping — no new hook or context value

**Chosen**: In `ConversationRoute` and `ConversationView`, derive `isInputDisabled` inline:

```ts
const isInputDisabled =
  selectedDeploymentConfiguration?.['dial:chatMessageInputDisabled'] === true;
```

Pass it directly as `isInputDisabled` to `ConversationInput`. `ConversationView` must add `selectedDeploymentConfiguration` to its `useDeployments()` destructuring.

**Alternative considered**: Add `isChatMessageInputDisabled: boolean` to `DeploymentsContextType` and compute it once in the provider. Rejected because the provider would need to know about a specific DIAL schema key, coupling a generic context to an application-protocol detail. The calculation is trivial and belongs at the render edge.

### 3. Disabled behavior in `Input`

When `isInputDisabled` is `true`:

- `<textarea>` receives the native `disabled` attribute (blocks keyboard input, caret, paste, and screen-reader interaction).
- `handleSend` short-circuits early when `isInputDisabled` is `true` (guards against programmatic calls).
- Send button is rendered with `isDisabled={isInputDisabled || !hasModelSelected}`.
- Attach (`+`) button is rendered with `isDisabled={isInputDisabled}` (menu cannot open).
- Drop zone: the `dragover`/`drop` handlers short-circuit when `isInputDisabled` is `true`, so files dropped on the component are ignored.

**Alternative considered**: Conditionally not rendering the textarea and send/attach buttons. Rejected — removing DOM elements causes layout shifts and makes the disabled state harder to test and reverse.

### 4. `DeploymentConfigurationSchema` typed field

Add `'dial:chatMessageInputDisabled'?: boolean` to `libs/chat-shared/src/models/deployment-configuration.ts`. The index signature `[key: string]: unknown` remains for other unknown keys. This lets app-edge code use the field without an `as boolean` cast and makes the intent discoverable via TypeScript tooling.

## Risks / Trade-offs

- **Prop ignored by third-party embedders**: If another host mounts `ConversationInput` without the prop, nothing changes — `isInputDisabled` defaults to `false`. No breaking change risk.
- **Stale config during deployment switch**: If the user switches deployment while a config is loading (async), the input briefly remains enabled. Mitigation: `selectedDeploymentConfiguration` is set to `null` during the load transition (see context implementation), so `isInputDisabled` evaluates to `false` during the gap — acceptable UX; worst case the user types a message that fails server validation, which is the current behaviour anyway.
- **EditMessageInput unaffected**: Intentional non-goal. If a future requirement surfaces, `EditMessageInputProps` can receive `isInputDisabled` independently.

## Migration Plan

No API changes, no data migrations, no feature flags. The change is a pure prop addition:

1. Add typed field to `DeploymentConfigurationSchema` (shared type, no runtime change).
2. Add `isInputDisabled` prop to `Input` and `ConversationInput`; implement disabled behavior.
3. Update `ConversationRoute` and `ConversationView` to read `selectedDeploymentConfiguration` and pass `isInputDisabled`.
4. Run `npm exec nx test @epam/ai-dial-conversation-input` and `npm exec nx lint @epam/ai-dial-conversation-input` and `npm exec nx lint @epam/chat` and `npm exec nx build @epam/ai-dial-conversation-input` to verify.

Rollback: revert the three file changes; the missing prop falls back to `undefined`/`false`, restoring current behavior.

## Open Questions

None — all decisions are resolved above.
