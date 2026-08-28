## Why

`ImportExportQueue`, `RenameConversationPopup`, the `Prompts`/`Skills`/`FavoriteApplications` resource-state
contexts, and most of `ConversationPanelView`'s controller logic (DTO→panel-item mapping, ID lookup maps,
active-conversation sync, row-action derivation, six near-duplicate async confirm-dialog state machines,
import-file-picker wiring) are fully app-independent today in behavior, but are physically pinned inside
`apps/chat`. Nothing about their logic is specific to a routing setup, a translation runtime, or an
application shell — they only need labels, callbacks, and injected data as inputs, the same shape the
existing extracted `useConversationExport`/`useConversationImport`/`useConversationSources` hooks already
use. Leaving them in `apps/chat` means every other DIAL Chat host application that wants this behavior has
to copy-paste the component/context source and re-diverge it over time, instead of depending on a
published package the same way it already depends on `@epam/ai-dial-conversation-panel` and
`@epam/ai-dial-chat-hooks` for the panel itself and the transfer/sharing hooks.

This change closes that gap for the four cohesive units listed below, without moving
`ConversationPanelView` itself — routing, i18n, feature flags, application contexts, and
main-chat-specific publish/share policy stay in `apps/chat`, where they belong.

## What Changes

- Move `ImportExportQueue` into `libs/conversation-panel` as a controlled, presentational component
  (typed `jobs`/callbacks props, a typed labels object, no `react-i18next` import). Move the minimal
  UI-facing transfer contracts (`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`,
  `ConversationTransferSubject`, `ConversationTransferJob`) to `libs/chat-shared`; `chat-hooks` keeps
  compatibility re-exports. **BREAKING** for any direct deep-import of these types from
  `libs/chat-hooks/src/conversation/conversation-transfer/types.ts` (the barrel re-export is preserved,
  deep imports are not guaranteed).
- Move `RenameConversationPopup` into `libs/conversation-panel` as a controlled component (`isOpen`,
  `currentTitle`, `isSaving`, `error`, `onSave`, `onCancel`, `onGenerateWithAi`, plus a labels object).
  Move the pure name-validation/sanitization helpers it needs (`sanitizeConversationName`,
  `stripTrailingDots`) to `libs/chat-shared`, consolidating the duplicated `getUtf8ByteLength` that today
  exists separately in both `chat-shared` and `chat-hooks`; `chat-hooks` keeps compatibility re-exports.
- Add three dependency-injected, headless resource-state hooks to `libs/chat-hooks` —
  `usePromptsState`, `useSkillsState`, `useFavoriteEntitiesState` — that reproduce the current
  `PromptsContext`/`SkillsContext`/`FavoriteApplicationsContext` state machines (loading/error semantics,
  cancellation-on-unmount, aggregate refetch, `mergeSharedSkill` upsert, optimistic favorite
  toggle-with-rollback) without importing `OverlayFeature`, `useUiFeature`, `UserContext`, app auth enums,
  or any server-api module. The three app contexts become thin wrappers that compute `enabled`/`ready`,
  supply API-call callbacks, and call the hook.
- Extract a small set of focused, headless controller hooks and pure utilities from
  `ConversationPanelView` into `libs/chat-hooks`: conversation-DTO→`ConversationItem` mapping, the
  panel-id/context-id lookup map, active-conversation-sync effects, a generic `useAsyncConfirmDialog`
  state machine (replacing six near-duplicate pending/loading/error triads plus the seventh instance in
  `ConversationPanelMenu`), row-action decision logic (readonly classification, deduplicated published
  folders, publish/unpublish/revoke visibility), and import-file-picker input handling. `apps/chat` keeps
  all `react-i18next` label construction, routing, notification wording, and API-callback construction.
- Move `mapDeploymentLimitsDtoToCatalogLimits` from `apps/chat/src/utils/map-deployment-limits-to-catalog.ts`
  into `libs/chat-hooks`, replacing its `TFunction`/`CatalogI18nKeys` parameter with an injected
  `DeploymentLimitsLabels` object (per-stat labels plus `unlimitedValue`/`formatValueLabel`/
  `formatProgressAriaLabel`), so the mapping utility has no `i18next` or app translation-key dependency.
  `apps/chat/src/components/CatalogView/CatalogView.tsx` builds that labels object via `useTranslation`
  and calls the relocated function instead of the deleted app-owned utility.
- Update `libs/conversation-panel` and `libs/chat-hooks` READMEs and `docs/architecture.md` for the new
  public exports and the dependency graph.

## Capabilities

### New Capabilities

- `conversation-panel-transfer-queue-ui`: the presentational Import/Export Queue component now owned by
  `libs/conversation-panel` — controlled props, labels object, auto-close/close-confirmation/progress
  behavior, no i18n or transfer-hook dependency.
- `conversation-panel-rename-popup-ui`: the presentational Rename Conversation Popup component now owned
  by `libs/conversation-panel` — controlled props, labels object, validation/sanitization via injected
  `chat-shared` utilities, AI-generation affordance driven entirely by an injected async callback.
- `chat-hooks-prompts-state`: `usePromptsState`, the headless, dependency-injected replacement for
  `PromptsContext`'s state machine.
- `chat-hooks-skills-state`: `useSkillsState`, the headless, dependency-injected replacement for
  `SkillsContext`'s state machine, including `mergeSharedSkill` upsert semantics.
- `chat-hooks-favorites-state`: `useFavoriteEntitiesState`, the headless, dependency-injected replacement
  for `FavoriteApplicationsContext`'s state machine, including optimistic update/rollback.
- `chat-hooks-conversation-panel-controller`: the focused headless hooks and pure utilities extracted
  from `ConversationPanelView` (item mapping, lookup maps, active-conversation sync, generic async
  confirm-dialog state machine, row-action decision logic, import-file-picker handling).
- `chat-hooks-deployment-limits-mapping`: `mapDeploymentLimitsDtoToCatalogLimits`, the headless,
  labels-injected replacement for the app-owned deployment-limits-to-catalog mapping utility.

### Modified Capabilities

- `chat-hooks-conversation-transfer`: the UI-facing transfer contracts (`ConversationTransferJobStatus`,
  `ConversationTransferSubjectKind`, `ConversationTransferSubject`, `ConversationTransferJob`) move to
  `chat-shared`; `chat-hooks` re-exports them for compatibility instead of owning the canonical
  definitions.
- `conversation-export` / `conversation-import`: the export/import queue UI is no longer an app-owned
  component — the app composes the `libs/conversation-panel` `ImportExportQueue` with translated labels
  and the existing `useConversationExport`/`useConversationImport` hooks instead of rendering its own
  component.
- `conversation-rename`: the rename popup UI is no longer an app-owned component — the app composes the
  `libs/conversation-panel` `RenameConversationPopup` with translated labels and its own AI-generation/save
  operations instead of rendering its own component.

## Impact

- **Affected code**: `apps/chat/src/components/ImportExportQueue/**`,
  `apps/chat/src/components/RenameConversationPopup/**`, `apps/chat/src/context/PromptsContext.tsx`,
  `apps/chat/src/context/SkillsContext.tsx`, `apps/chat/src/context/FavoriteApplicationsContext.tsx`,
  `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`,
  `apps/chat/src/components/ConversationPanel/ConversationPanelMenu.tsx`,
  `apps/chat/src/components/ConversationPanel/get-conversation-source.ts`,
  `apps/chat/src/utils/map-deployment-limits-to-catalog.ts`,
  `apps/chat/src/components/CatalogView/CatalogView.tsx`, and their test files.
- **New/changed library surface**: `libs/conversation-panel/src` (two new components + their prop/label
  types), `libs/chat-hooks/src` (three resource-state hooks, a handful of controller hooks/utilities, and
  the deployment-limits mapping utility), `libs/chat-shared/src` (transfer contracts, name-validation
  utilities, and the canonical `FilterTab` enum re-exported by `conversation-panel`).
- **Dependencies**: no new third-party packages. `libs/conversation-panel` gains no new dependency on
  `libs/chat-hooks` (dependency direction stays acyclic: `conversation-panel` → `chat-shared` only;
  `chat-hooks` also consumes the canonical `FilterTab` from `chat-shared` and does not depend on
  `conversation-panel`).
- **Consumers**: catalog views, `PromptSelector`, `PromptEditor`, `SkillEditor`, `SharedInvitation`, and
  `DeploymentSelector` consume the three contexts unchanged (same Context API surface); no broad rewrites
  expected in those call sites.
- **Downstream benefit**: other DIAL Chat host applications that already depend on
  `@epam/ai-dial-conversation-panel` and `@epam/ai-dial-chat-hooks` as published packages gain the ability
  to consume these four units directly instead of maintaining app-level copies.
