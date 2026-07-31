## Context

The `+` menu in the conversation input (`AddAttachmentButton`) currently supports two extension patterns:
1. **`extraMenuItems`** — fire-and-forget menu items (used by DIAL File System Picker).
2. **`chatSettings`** — a structured config object that opens a modal/bottom-sheet with form fields.

Neither pattern supports toggle-state items in a submenu. The new Tools feature requires a third pattern: a submenu with stateful toggle rows whose selections persist across the input session and are sent as `configuration_value` on each completion request.

The existing `configuration_value` → `custom_fields.configuration` pipeline in `conversation.service.ts` already handles arbitrary `Record<string, unknown>` payloads. The backend must also retain that value when `conversation-history-builder.ts` creates a user message; otherwise only the first message keeps its tool state and regenerate can fall back to stale configuration. The other backend change is surfacing `DEEP_RESEARCH_TOOL_ID` through the app-config system so the frontend knows which deployment-configuration schema property to extract.

## Goals / Non-Goals

**Goals:**
- Add a Tools submenu to the `+` menu that renders deployment-configuration tool toggles.
- First slice: render only the configured Deep Research tool; ignore all other schema properties.
- Send selected tool configuration alongside the completion request via `configuration_value`.
- Persist selected tool configuration on every created user message so regenerate and edit reuse the message-specific state.
- Keep `libs/conversation-input` host-agnostic: it renders tool items from resolved props and emits toggle callbacks.
- Expose `DEEP_RESEARCH_TOOL_ID` through the app-config pipeline (visibility: `client`).

**Non-Goals:**
- Multi-tool support (arbitrary schema introspection, icon registry, tool categorization).
- Feature-flag gating via `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — presence of the env var is the gate.
- New backend HTTP endpoints.
- Observability/telemetry events for tool toggles (no new metrics in this slice).
- Rate limiting changes (no new endpoints).

## Decisions

### D1: State ownership — `useToolsMenu` hook in `apps/chat/src/hooks/conversation/`

**Choice:** A standalone hook, not a React Context provider.

**Why:** Tool toggle state is local to the active input session (one conversation's input area). It doesn't need global sharing across components that aren't in the input tree. A hook keeps the surface small, avoids provider proliferation, and matches how `chatSettings` values are managed (local state in the view, not a context).

**Alternatives rejected:**
- *New `ToolsContext` provider* — overkill for state consumed only by `ConversationView` → `ConversationInput` → `AddAttachmentButton`. Would add another provider wrapper for no benefit.
- *State inside `DeploymentsContext`* — violates single-responsibility; `DeploymentsContext` is a data-fetch layer, not a UI-interaction layer.

### D2: Lib contract — `toolsMenuItems` prop + `onToolToggle` callback

**Choice:** `AddAttachmentButton` gains:
```ts
toolsMenuItems?: ToolMenuItem[];
onToolToggle?: (toolId: string) => void;
```

Where `ToolMenuItem` (defined in `libs/chat-shared`):
```ts
interface ToolMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  isSelected: boolean;
}
```

**Why:** Follows the established `chatSettings` prop pattern — the lib receives a fully resolved, typed prop and emits a callback. No schema parsing, env reads, or config lookups inside the lib.

**Alternatives rejected:**
- *Extending `ExtraMenuItem`* — would require adding `isSelected`, `iconAfter`, and toggle semantics to an interface designed for fire-and-forget clicks. Mixing concerns.
- *Passing raw deployment configuration schema into the lib* — violates library isolation.

### D3: Env/config plumbing — `CONFIG_DEFINITIONS` entry with `envVar: 'DEEP_RESEARCH_TOOL_ID'`

**Choice:** Add a new `visibility: 'client'` config definition that exposes the env var's value as `config.deepResearchToolId: string | null` in `ClientConfigResponseDto` / `AppConfigState.config`.

**Why:** Follows the exact pattern of `DEFAULT_DEPLOYMENT` → `config.defaultDeploymentId`, `ASR_MODEL` → `config.asrModelId`. No new endpoint, no new service — just a new row in the registry.

When the env var is unset, `config.deepResearchToolId` is `null` and the hook produces an empty tools array → the Tools menu item is not rendered.

### D4: Tool extraction logic in `useToolsMenu`

**Choice:** The hook reads `selectedDeploymentConfiguration.properties[deepResearchToolId]`. If:
- The property exists AND
- Its type is inferrable as boolean (either `"type": "boolean"` or has a boolean `default`)

Then it constructs a single `ToolMenuItem` with:
- `id` = the tool id string
- `label` = property `title` ?? i18n fallback
- `icon` = `<IconTelescope />` (hard-coded for Deep Research; future multi-tool would need a map)
- `isSelected` = local state initialized from property `default` value

**Why:** Minimal extraction — we match exactly one key and ignore everything else. No schema introspection beyond the single property lookup.

### D5: Sending tool choices — merge into existing `configuration_value`

**Choice:** The `useToolsMenu` hook exposes `toolConfigurationValue: Record<string, boolean>` (e.g. `{ deep_research: true }`). The conversation handler merges this with any existing `configurationValue` (from starters/forms) before passing to `startStream` / `createConversation`.

**Why:** Reuses the exact existing path: `custom_content.configuration_value` → backend → `custom_fields.configuration`. No new DTO field is needed. The frontend builds its optimistic user message from the same `customContent` object passed to `startStream`, `makeUserMessage` copies the value into the backend-persisted user message, and edit forwards the preserved custom content. Local and persisted representations therefore remain aligned for later regenerate/edit requests.

**Merge semantics:** Tool values are spread **after** starter/form values, so a tool toggle can override a starter's initial configuration choice. This is intentional — the user explicitly toggled the tool after the starter auto-submitted a default.

### D6: Reset on deployment change

**Choice:** When `selectedDeploymentId` changes, the hook reinitializes tool state from the new deployment's schema defaults. Any user toggles from the previous deployment are discarded.

**Why:** Tool availability is per-deployment. A tool enabled on GPT-4 may not exist on Claude. Carrying stale state would send invalid configuration to DIAL Core.

### D7: Desktop UI — submenu inside `DialDropdown`

**Choice:** The top-level "Tools" item in the dropdown has an `iconAfter` chevron. On hover/focus it reveals a nested submenu panel listing tool rows. Each row: icon + label + trailing check icon when selected. Clicking toggles `isSelected`.

**Alternatives rejected:**
- *Separate modal (like Chat Settings)* — tools are quick toggles, not complex forms. A modal adds unnecessary interaction weight.
- *Inline toggles in the main dropdown* — clutters the main menu; submenu groups tools clearly.

### D8: Mobile UI — stacked bottom sheet

**Choice:** Tapping "Tools" in the mobile bottom sheet navigates to a second stacked bottom-sheet view (same pattern as Chat Settings bottom sheet). Tool rows are full-width with icon, label, and trailing toggle/check. Back button returns to the main menu.

**Why:** Consistent with the existing Chat Settings mobile pattern. No hover semantics needed.

### D9: Feature flag decision

**Not gated by `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`.** The feature is gated by the presence of `DEEP_RESEARCH_TOOL_ID` env var AND the deployment's configuration schema containing a matching property. This double gate (operator config + deployment capability) is sufficient for controlled rollout without role-based complexity.

## Risks / Trade-offs

- **[Compatibility] Historical messages without persisted tool configuration** → Conversations created before this fix may still lack per-message `configuration_value`; regenerate retains the existing fallback to the most recent configuration available in history. Newly sent or edited messages persist their own value.
- **[Risk] Hard-coded Telescope icon for Deep Research** → future tools need an icon resolution strategy. Mitigation: the `ToolMenuItem.icon` prop is `ReactNode`, so the app-level hook can provide any icon. A future icon map or backend-provided icon metadata can be added without lib changes.
- **[Risk] `configuration_value` merge conflicts with starters** → A starter that sets `{ deep_research: false }` could be overridden by the tool toggle. Mitigation: tool values spread after starter values is documented as intentional; tools represent explicit user intent.
- **[Risk] Config cache staleness** → `deepResearchToolId` is cached for 60s by `AppConfigService`. If an operator changes the env var, users see the old value for up to 60s. Mitigation: acceptable; matches behavior of all other client config values.

## Migration Plan

- **Deploy:** Set `DEEP_RESEARCH_TOOL_ID=deep_research` (or leave unset for no change).
- **Rollback:** Unset the env var → Tools menu disappears on next config fetch (≤60s). No data migration needed.
- **Forward migration (multi-tool):** Replace single env var with a comma-separated list or JSON array, extend `useToolsMenu` to iterate, add icon map. `ToolMenuItem[]` prop shape already supports arrays.

## Open Questions

1. **Persistence of tool selections across page reload** — Currently tool state lives in React state (hook). A page reload resets to schema defaults. Is this acceptable for V1? *Decision: Yes — matches how Chat Settings temperature/system-prompt are not persisted across reload either.*
2. **Interaction with overlay/embed mode** — Does the Tools menu render when DIAL Chat is embedded as an overlay? *Decision: Yes, if the env var is set and deployment supports it. No special overlay exclusion needed.*
