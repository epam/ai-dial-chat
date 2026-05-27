## Context

The initial chat input (`ConversationRoute`) currently hard-codes no model; the backend defaults blindly. The `ThemeContext` pattern (`apps/chat/src/context/ThemeContext.tsx`) establishes the canonical approach for async-loaded, app-wide state in this project: `createContext<T | undefined>(undefined)`, `useMemo` on context value, provider-guard consumer hook. The generated API client (`@epam/chat-api-client`) is integrated (see archived change `connect-generated-api-client`) and already exposes `modelsApi.listModels()` via `apps/chat/src/server-api/models.ts`. `CreateConversationDto` currently carries only `firstMessage` — no `modelId` field exists anywhere in the stack.

The Figma design (node 33:4536) shows the model selector as a 40 px button in the input bar's `right_controls` group: a model icon (24 × 24) with an overlapping chevron (20 × 20) riding a small semi-transparent background badge. Node 27:4520 shows the open dropdown (240 px wide, dark `layer-0` background, 40 px items, model icon + name, divider after the third item, "Add from marketplace" at the bottom). The open state applies a blue-alpha accent (`rgba(125,164,255,0.36)`) to the button background. The dropdown lists real model names (GPT 5.4, Gemini 3.1, Anthropic Claude 4.6, Assistant 10k, Testing-flask, Default-agent) — model icons are product-specific images. The `DialModelDto` exposes `display_name` (human-readable label, e.g. `"Gemini 3 Flash"`) and `icon_url` (SVG filename, e.g. `"Gemini.svg"`) — both optional. Icon files are served as static assets by DIAL Core.

## Goals / Non-Goals

**Goals:**

- Load the model list once when the authenticated app mounts and expose it via `ModelsContext`.
- Provide loading, error, empty, and success states from the context.
- Auto-select the first model returned by the API as the default.
- Render a model selector button in the initial chat input (`ConversationRoute`) that opens a dropdown of available models.
- Pass the selected `modelId` to `createConversation` so the backend record carries the user's choice.
- Extend `ConversationInput` with an optional `rightControls` slot without coupling the library to model logic.
- Add `modelId?: string` to the backend `CreateConversationDto` (optional, backward-compatible).

**Non-Goals:**

- Model switching inside an existing conversation (post-creation switching).
- Persisting the selected model across page reloads in this slice (recorded as an open question).
- Showing product-specific model icons via a remote URL — `icon_url` is available on the DTO but resolving it to an absolute URL (base path for DIAL Core static assets) is out of scope; the first slice uses `display_name` for the label and a generic `IconRobot` placeholder icon.
- The "Add from marketplace" item visible in Figma — out of scope.
- The `inline-select` control labelled "Optional/Fast/Expert/…" visible alongside the model selector in Figma — that is a separate feature (agent mode selection) and is out of scope here.
- Deployments vs. models distinction — this slice calls `GET /api/v1/models` only and treats every entry as selectable.
- Hiding or disabling unavailable models — out of scope without an `available` field on `DialModelDto`.

## Decisions

### 1. React Context for model state

**Decision:** `ModelsContext` following the exact `ThemeContext` pattern.

**Why:** The project uses React Context + custom hooks exclusively (no Redux, Zustand, or Jotai). Adding an external state library for a single domain would contradict the established convention and introduce a dependency others don't follow. Prop-drilling the model list from `main.tsx` through `App` → route → `ConversationRoute` is too fragile — new routes that need models would require threading the prop through multiple layers.

**Alternative considered:** Local state in `ConversationRoute`. Rejected because the selected model will eventually be needed by the in-conversation input too, and loading models per-route would cause redundant network requests.

### 2. Load models via existing `getModels()` helper, not inline fetch

**Decision:** Call `getModels()` from `apps/chat/src/server-api/models.ts` inside a `useEffect` with an `AbortController`-equivalent cancelled flag (following `useFavicon` pattern).

**Why:** `getModels()` already wraps `modelsApi.listModels()` from the generated client with the correct CSRF/unauthorized/telemetry middleware stack. Calling `modelsApi` directly from the context would bypass the server-api abstraction layer without benefit.

### 3. Provider placement in `main.tsx`

**Decision:** Wrap the authenticated portion of the tree (`RequireAuth` > `App`) with `ModelsProvider`, placed after `UserProvider` and before (or alongside) `ThemeProvider`.

**Why:** `ModelsProvider` only calls the models endpoint after the user is authenticated. It must be nested inside `UserProvider` so a `401` from the models endpoint flows through the existing `onUnauthorized` middleware (which calls `UserProvider`'s session reset). If placed outside `UserProvider`, a `401` during model loading would not trigger a proper logout flow.

**Order in `main.tsx`:**
```
BrowserRouter
  UserProvider
    ThemeProvider
      ModelsProvider        ← new, after ThemeProvider is fine; models are app-wide
        RequireAuth
          App
```

### 4. `rightControls?: ReactNode` slot in `ConversationInput`

**Decision:** Add an optional `rightControls?: ReactNode` render prop to `ConversationInputProps` and render it inside the `right_controls` div in the component.

**Why:** The Figma shows the model selector inside the input bar. `ConversationInput` is a generic library component (`libs/conversation-input`) that must not know about models. A render slot keeps the library generic while matching the visual design precisely. The slot is optional — all existing `ConversationInput` usages (`ConversationRoute`, `ConversationView`) pass no `rightControls` and are unaffected.

**Alternative considered:** Overlay the model selector on top of the input from the outside using CSS positioning. Rejected — fragile, breaks with dynamic input height, and deviates from the Figma structural design.

### 5. `ModelSelectorButton` in `apps/chat/src/components/ModelSelector/`

**Decision:** A dedicated `ModelSelectorButton` component folder in `apps/chat/src/components/ModelSelector/`, not co-located with `ConversationRoute`.

**Why:** The selector may eventually also appear inside `ConversationView` (in-conversation model switching, out of scope here). Placing it in `components/` keeps it reusable per project conventions. The component owns the open/close state of the dropdown locally (not in `ModelsContext`), since open/close is view-only state not needed by other consumers.

**Component shape:**

```typescript
interface ModelSelectorButtonProps {
  models: DialModelDto[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
  isLoading: boolean;
  error: Error | null;
}
```

The component renders:
- **Loading state:** a spinner (or skeleton) in place of the button; `aria-busy="true"`.
- **Error state:** a disabled button with `role="alert"` tooltip; `aria-label={t('models.selector.errorLabel')}`.
- **Empty state:** a disabled button with `aria-label={t('models.selector.emptyLabel')}`.
- **Success state:** a `<button>` with `aria-haspopup="listbox"` and `aria-expanded`. On click, renders a `<ul role="listbox">` dropdown positioned below/above the button. Each `<li role="option">` carries `aria-selected`.

Icon used for each model: `IconRobot` from `@tabler/icons-react` (placeholder until `DialModelDto` exposes icon data). The button itself shows the icon of the currently selected model + a `IconChevronDown` / `IconChevronUp`.

Chevron background badge (visible in Figma as `chevrov_bg`): a 20 × 20 element with `bg-[var(--controls/background/neutral)]` rounded `rounded-full` stacked under the chevron icon using `relative`/`absolute` positioning.

Active (open) button state: `bg-[rgba(125,164,255,0.36)]` (design token `--controls/background/accent-primary-alpha-active`).

Dropdown:
- Width: `w-60` (240 px)
- Background: `bg-[var(--background/layer-0)]`
- Border radius: `rounded-[var(--radius-1,4px)]`
- Box shadow: `shadow-[0px_0px_4px_0px_rgba(9,13,19,0.15)]`
- Item height: `h-10` (40 px), `px-3 gap-3`
- Divider: no explicit divider in this slice (Figma shows one at position 3, but without metadata on which models warrant it, we omit it until `DialModelDto` exposes category data)

Keyboard accessibility:
- `↑`/`↓` keys navigate options, `Enter`/`Space` selects, `Escape` closes.
- Focus returns to the trigger button on close.

### 6. Backend `CreateConversationDto` extension

**Decision:** Add `modelId?: string` with `@IsOptional()`, `@IsString()`, `@MaxLength(500)` decorators. Follow `apps/chat-api/AGENTS.md` conventions (allowlist `@Matches` not needed for a plain string ID here; `@MaxLength` is sufficient).

**Why:** Inspection confirms the DTO has no model identity field. The field is optional so existing clients (tests, curl scripts) need no changes. The service can log the received `modelId` and store it on the conversation entity; deeper DIAL Core wiring is out of scope here.

### 7. Selected model persistence

**Decision:** No persistence in this first slice. `selectedModelId` lives only in `ModelsContext` React state — it resets to `models[0]?.id` on page reload.

**Why:** The simplest correct implementation. localStorage persistence introduces cache-invalidation questions (model removed from API, stale ID, serialisation format). These are recorded as open questions.

### 8. 401 from model loading

**Decision:** The `onUnauthorized` middleware in `api-client.ts` already intercepts any `401` from the generated client and dispatches the `UserProvider` session reset. `ModelsContext` requires no special handling — it catches errors generically, sets `error` state, and lets the auth flow propagate normally.

### 9. Using `modelsApi` vs. raw `server-api` helpers

**Decision:** Use `getModels()` from `apps/chat/src/server-api/models.ts`, which already calls `modelsApi.listModels()` from the generated client. The generated-client integration is complete (archived change `connect-generated-api-client`).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `DialModelDto.id` is the only display string — IDs may be machine-formatted and hard to read (e.g., `gpt-4-32k-0314`) | Document as open question; plan a `displayName` field extension in a future DTO change |
| `ModelsProvider` is nested inside `UserProvider` — if `UserProvider` is ever moved above `BrowserRouter`, provider order must be re-evaluated | Documented here; `main.tsx` ordering is stable and confirmed by existing `ThemeProvider` placement |
| `rightControls` slot in `ConversationInput` — a poorly-typed `ReactNode` could allow arbitrary content | Acceptable for first slice; if misuse is detected, can narrow to a specific union type in a follow-up |
| Backend `modelId` is persisted to the conversation record but not yet wired to DIAL Core message routing | Record as open question; the field is stored but currently informational only |
| Dropdown positioning may overflow the viewport on narrow screens | Use a positioning library or CSS `overflow: visible` with scroll guard; defer to implementation |

## Open Questions

1. **Should `selectedModelId` persist in `localStorage`?** If yes, what is the invalidation strategy when the model list changes?
2. **What is the fallback when the API returns an empty model list?** Should the input be disabled, show a warning, or allow free-text entry with no model?
3. **Should the selector surface deployments, models, or both?** The API exposes `/api/v1/models` and a separate `/api/v1/deployments`. This slice uses models only.
4. **Should unavailable or disabled models be hidden or shown as disabled?** `DialModelDto` has no `available`/`status` field; this is unresolvable without a DTO extension.
5. **Should `DialModelDto` be extended with `displayName` and `iconUrl`?** Required to show product-specific model names and icons as shown in Figma.
6. **Is `modelId` on `CreateConversationDto` forwarded to DIAL Core, or stored locally only?** Determines whether the backend service needs updating beyond persisting the field.
