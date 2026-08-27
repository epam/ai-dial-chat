## Context

`libs/conversation-panel` (`@epam/ai-dial-conversation-panel`) currently exports exactly one component
(`ConversationPanel`) plus its prop/label/style types and the `FilterTab` enum. `libs/chat-hooks`
(`@epam/ai-dial-chat-hooks`) already hosts the transfer-job queue primitive
(`useConversationTransferQueue`) and the two public hooks built on it (`useConversationExport`,
`useConversationImport`), following an established pattern: hooks take injected API-shaped params
(`Pick<ConversationsApi, ...>`), injected classification/error callbacks, and emit structured
`onSuccess`/`onWarning`/`onError` events — never pre-rendered, translated strings.

`ImportExportQueue.tsx` and `RenameConversationPopup.tsx` are the UI shells that render those events;
today they live in `apps/chat/src/components/`, import `react-i18next` directly, and are the last piece
of the export/import/rename UX not yet published. `PromptsContext`, `SkillsContext`, and
`FavoriteApplicationsContext` are three independent React Context state machines with materially
different edge-case behavior (Prompts: always fetches, surfaces errors; Skills: gated by a feature flag
and auth-readiness; Favorites: silently swallows load failures, has no `error` field at all, does
optimistic update+rollback) but a shared shape: fetch-on-mount with cancellation, an aggregate refetch,
and a memoized context value. `ConversationPanelView.tsx` (1,388 lines) is the largest remaining
concentration of non-portable-looking logic that is, on inspection, mostly portable: DTO→panel-item
mapping, ID lookup maps, active-conversation-sync effects, six near-duplicate async
pending/loading/error dialog state machines (plus a seventh in `ConversationPanelMenu.tsx`), and
import-file-picker wiring are all free of `react-i18next`, routing, or context imports once the
app-specific resolvers (icon URL, localized text, route builder) are passed in as callbacks — the same
injection pattern `useConversationExport`'s `normalizeConversationPath` already uses.

A downstream host application already depends on `@epam/ai-dial-conversation-panel` and
`@epam/ai-dial-chat-hooks` as ordinary npm packages and already consumes `ConversationPanel`,
`useConversationExport`/`useConversationImport`, and `useShareRecipientsCount` as designed — but still
copy-pastes `ImportExportQueue.tsx`/`RenameConversationPopup.tsx` verbatim and has no equivalent of the
three resource-state contexts, because those are not yet published. This design closes that gap.

## Goals / Non-Goals

**Goals:**

- Move `ImportExportQueue` and `RenameConversationPopup` into `libs/conversation-panel` as controlled,
  labels-driven, i18n-free components with named exports from the package root.
- Move the minimal UI-facing transfer contracts and the pure name-validation/sanitization utilities they
  depend on into `libs/chat-shared`, with compatibility re-exports preserved from `libs/chat-hooks`.
- Add `usePromptsState`, `useSkillsState`, `useFavoriteEntitiesState` to `libs/chat-hooks` as
  dependency-injected headless hooks; keep the three app Contexts as thin wrappers over them.
- Extract a small number of focused, cohesive headless hooks/utilities from `ConversationPanelView` into
  `libs/chat-hooks` (item mapping, lookup maps, active-conversation sync, a generic async confirm-dialog
  state machine, row-action decision logic, import-file-picker handling) without moving the component
  itself.
- Preserve every documented current behavior (auto-close timing, validation rules, cancellation
  semantics, optimistic rollback, publish/unpublish mutual exclusivity, etc.) byte-for-byte — this is a
  structural move, not a behavior change.
- Keep the dependency graph acyclic and add no new third-party dependency.

**Non-Goals:**

- Do not move `ConversationPanelView` itself, `ConversationPanelMenu`'s JSX, routing, i18n label
  construction, feature-flag policy, or main-chat-specific publish/share business rules.
- Do not introduce a new library — everything lands in `conversation-panel`, `chat-hooks`, or
  `chat-shared`.
- Do not change any REST endpoint, DTO, or backend behavior — this is a frontend-only structural
  refactor.
- Do not build a single monolithic `useConversationPanelController` hook — prefer several small, focused
  exports (per `AGENTS.md` precedent: prefer cohesive units over one hook that just relocates the whole
  component).
- Do not change `PromptsContext`/`SkillsContext`/`FavoriteApplicationsContext`'s public Context API —
  existing consumers (`CatalogView`, `PromptSelector`, `PromptEditor`, `SkillEditor`,
  `SharedInvitation`, `DeploymentSelector`) must not need changes.

## Decisions

### D1 — Slice sequencing in one change, ordered by contract dependency

Following the precedent set by `2026-08-24-extract-conversation-lifecycle-hooks`, this is one OpenSpec
change with four ordered slices (queue UI → rename UI → resource state → controller hooks) rather than
four separate changes. Slice 1 must land before slice 2 only insofar as both touch
`libs/conversation-panel`'s export surface and are easiest to review together; slices 3 and 4 are
independent of 1–2 and of each other. Sequencing avoids redesigning an already-published contract mid-change.

### D2 — UI-facing transfer contracts move to `chat-shared`, not `conversation-panel`

`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, `ConversationTransferSubject`, and
`ConversationTransferJob` currently live in `libs/chat-hooks/src/conversation/conversation-transfer/types.ts`.
The proposal's constraint is that `conversation-panel` must not depend on `chat-hooks` (wrong direction:
UI lib depending on the hooks lib would invert the acyclic-graph rule that "conversation-panel MUST NOT
depend on chat-hooks"). Moving the four contracts to `chat-shared` — which both `conversation-panel` and
`chat-hooks` may already depend on — lets `ImportExportQueue` import them from `chat-shared` while
`useConversationTransferQueue`/`useConversationExport`/`useConversationImport` keep using the same types
via a `chat-hooks` barrel re-export (`export type { ConversationTransferJob, ... } from
'@epam/ai-dial-chat-shared'`). No behavior in `queue.ts` changes — only the import path of the type
declarations.

Alternative considered: keep the types in `chat-hooks` and have `conversation-panel` depend on
`chat-hooks` for just these four types. Rejected — it's exactly the dependency direction the proposal
forbids, and it would make every future `conversation-panel` consumer pull in all of `chat-hooks`'
peer-dependency surface (`ag-grid-community`, `fflate`, a dozen `@epam/ai-dial-*` packages) merely to get
four enums/interfaces.

### D3 — Name-validation utilities also move to `chat-shared`, consolidating the duplicated `getUtf8ByteLength`

`sanitizeConversationName`, `stripTrailingDots`, and `getUtf8ByteLength` currently live in
`libs/chat-hooks/src/shared/string-utils.ts`; `chat-shared/src/utils/string-utils.ts` already has its own
`getUtf8ByteLength` (byte-identical behavior, `TextEncoder().encode(...).length`). `RenameConversationPopup`
needs all three functions and must not depend on `chat-hooks` (same D2 rationale). Move
`sanitizeConversationName` and `stripTrailingDots` to `chat-shared/src/utils/string-utils.ts`, delete the
duplicate `getUtf8ByteLength` from `chat-hooks` and re-export the `chat-shared` one instead. `chat-hooks`
keeps `export * from '@epam/ai-dial-chat-shared'`-style re-exports for all three names so existing
`chat-hooks` consumers (including the app's own `RenameConversationPopup` call site during the transition)
do not break.

`includesIgnoreCase`, `safeDecodeURI`/`safeDecodeURIComponent`, `stripSurroundingSlashes` stay in
`chat-hooks` — they are not needed by the moved components and have no `conversation-panel` consumer.

### D4 — `ImportExportQueue`/`RenameConversationPopup` take a `labels` prop object, never `useTranslation`

Matches the existing `ConversationPanelLabels`/`FilterLabels` pattern already established in
`conversation-panel`. `apps/chat` builds the labels object once (via `useTranslation`) and passes it down;
the two moved components have zero i18n import. Concretely:

```ts
export interface ImportExportQueueLabels {
  allConversationsJobLabel: string;
  closeJobAriaLabel: (title: string) => string;
  retryJobAriaLabel: (title: string) => string;
  collapseQueueAriaLabel: string;
  expandQueueAriaLabel: string;
  closeQueueAriaLabel: string;
  closeQueueConfirmHeader: string;
  closeQueueConfirmDescriptionInProgress: string;
  closeQueueConfirmDescriptionFailed: string;
  closeQueueConfirmDescriptionMixed: string;
  closeLabel: string;
  cancelLabel: string;
}

export interface RenameConversationPopupLabels {
  popupTitle: string;
  inputPlaceholder: string;
  renameWithAiLabel: string;
  renameWithAiError: string;
  nameTooLongError: string;
  saveLabel: string;
  cancelLabel: string;
}
```

Exact field names are finalized during implementation against every string currently produced by
`ButtonsI18nKeys`/`ConversationExportI18nKeys`/`ConversationPanelI18nKeys` lookups in the two components —
the requirement is one labels field per distinct rendered string, no string ever hardcoded in the library
component.

### D5 — Generic `useAsyncConfirmDialog<T>` state machine for the six-plus duplicated pending/loading/error triads

`ConversationPanelView` has six independent state machines (delete, unshare, revoke, rename, unpublish,
and — structurally, minus the `ConfirmationPopup` — publish) each shaped as: a `pending<X>` value (often
`{id, title}`), an `is<X>ing` boolean, a `<x>Error` string, a `handleConfirm<X>` async callback, and a
`handleClose<X>` callback. `ConversationPanelMenu`'s delete-all flow independently reimplements the same
triad a seventh time. Extract one generic hook to `chat-hooks`:

```ts
interface UseAsyncConfirmDialogResult<T> {
  pending: T | null;
  isPending: boolean;
  isRunning: boolean;
  error: string | null;
  open: (value: T) => void;
  close: () => void;
  confirm: (run: (value: T) => Promise<void>, onError: (error: unknown) => string) => Promise<void>;
}
function useAsyncConfirmDialog<T>(): UseAsyncConfirmDialogResult<T>;
```

`confirm` guards re-entry while `isRunning`, sets `error` from `onError(caughtError)` on failure (so the
i18n message stays app-owned), and calls `close()` on success. Six of the seven current call sites adopt
this hook directly; `ConversationPanelMenu`'s delete-all keeps its own bespoke result-branching (partial
vs total failure) layered on top since that decision logic is domain-specific, not generic — the hook
only replaces its pending/loading/error triad, not its business branching.

Alternative considered: a `Map`-keyed hook (`useAsyncConfirmDialog<T>(id)`) matching
`useShareRecipientsCount`'s per-resource-id caching shape. Rejected — none of the six call sites need more
than one pending item active at a time (opening a new dialog while one is open is not a real UI state),
so the simpler single-slot hook is sufficient and matches `AGENTS.md`'s "prefer several focused exports"
guidance without over-generalizing.

### D6 — Row-action decision logic split from `DropdownItem`/icon/label construction

`getActions` (275 lines) mixes three concerns: pure decisions (is this row readonly; which folders is it
published to, deduplicated; is revoke visible; does publish or unpublish apply), i18n-labeled
`DropdownItem` construction (icons, `t()` strings), and side-effecting closures (the duplicate action's
async try/catch, `setPending*Id` calls). Extract only the pure decision layer:

```ts
interface ConversationRowActionState {
  isReadonly: boolean;
  publishedFolders: string[]; // deduplicated by joined folder path
  isRevokeVisible: boolean;
  isPublishApplicable: boolean;   // publishedFolders.length === 0
  isUnpublishApplicable: boolean; // publishedFolders.length > 0
}
function deriveConversationRowActionState(
  item: Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe' | 'isReadonly'>,
  publishHistory: PublishHistoryEntry[] | undefined,
  recipients: RecipientsCountState,
): ConversationRowActionState;
```

`getActions` itself, its `DropdownItem[]` construction, and every `t()` call stay in
`ConversationPanelView` — this decision only removes the branch-condition duplication, not the JSX/i18n
layer, matching the proposal's explicit boundary ("app-specific publishing/sharing policy stays in
`ConversationPanelView`").

### D7 — Item-mapping and lookup-map hooks take resolvers as injected callbacks, not moved utilities

`resolveCatalogIconUrl`, `resolveLocalizedText`, and `getConversationRoute` are app-local (icon-path
resolution, locale formatting, route construction) and out of scope to relocate — they're exactly the
kind of host-owned integration detail `AGENTS.md`'s library-isolation section reserves for the app edge.
The mapping hook accepts them as parameters, mirroring `useConversationExport`'s
`normalizeConversationPath` injection:

```ts
interface UseConversationPanelItemsParams {
  items: ConversationListItemDto[];
  deployments: DeploymentItemDto[];
  isDeploymentsLoading: boolean;
  toPanelConversationId: (id: string) => string;
  resolveIconUrl: (deployment: DeploymentItemDto | undefined) => string | undefined;
  resolveIconTooltip: (deployment: DeploymentItemDto | undefined, fallback: string) => string;
  resolveHref: (conversationId: string) => string;
  resolveTaskBadge?: (item: ConversationListItemDto) => { label: string; isUnread: boolean } | undefined;
}
function useConversationPanelItems(params: UseConversationPanelItemsParams): ConversationItem[];

function useConversationLookupMaps(params: {
  items: ConversationListItemDto[];
  toPanelConversationId: (id: string) => string;
}): {
  toContextId: (panelId: string) => string | undefined;
  getRawItem: (panelId: string) => ConversationListItemDto | undefined;
};
```

`getConversationSource` (already a pure, portable function) moves into the same `chat-hooks` module as
a small internal used by `useConversationPanelItems`; it is also kept exported standalone. Its canonical
`FilterTab` enum moves to `chat-shared`, which `conversation-panel` re-exports, so hooks and UI share one
runtime/type identity without introducing a dependency between the two feature libraries.

### D8 — Active-conversation-sync effect extracted with its dependency-array rationale preserved verbatim

`ConversationPanelView`'s two effects (refetch-if-active-conversation-missing;
mark-viewed-on-active-change) use a deliberately incomplete dependency array with an inline comment
explaining why (`items`/`refreshConversations` are excluded to avoid a refetch loop). Extracting this into
`useActiveConversationSync({ activeConversationId, items, refreshConversations, markConversationViewed,
conversationIdsMatch, toPanelConversationId })` must carry that comment into the hook's JSDoc so a future
contributor does not "fix" the lint-suppressed dependency array and reintroduce the loop. `conversationIdsMatch`
and `toPanelConversationId` are passed in as callbacks (both are small app-local utilities in
`apps/chat/src/utils/`); they are not relocated because they have no `chat-hooks` consumer beyond this one
hook and moving single-consumer app utilities is out of scope per D-precedent D6 in the prior extraction
change ("pure logic used by exactly one caller stays inlined … rather than becoming a premature library
utility") — here there are effectively two call sites inside one hook, still a single logical caller.

### D9 — `useImportFilePicker` is fully portable, no injection needed beyond `isMobile`

```ts
function useImportFilePicker(params: {
  isMobile: boolean;
  accept?: string; // desktop-only accept string; caller passes undefined on mobile
  onFileSelected: (file: File) => void;
}): {
  inputRef: RefObject<HTMLInputElement | null>;
  triggerImport: () => void;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};
```
The `IMPORT_FILE_ACCEPT` constant and the mobile-vs-desktop accept-string decision stay in
`ConversationPanelView` (it is a product/UX decision about which file pickers to allow, not a mechanical
concern) — the hook just accepts whatever `accept` string (or `undefined`) the caller resolved.

### D10 — Prompts/Skills/Favorites: one hook shape each, app contexts compute `enabled`/`ready`

Three separate hooks (not one generic "resource state" hook) because their edge-case behavior differs
enough that a shared abstraction would need per-hook escape hatches anyway (Favorites has no `error`
field and does optimistic rollback; Skills gates on `enabled`/`ready`; Prompts always fetches). Each hook
takes only data-fetching callbacks and, where relevant, readiness flags:

```ts
function usePromptsState(params: {
  listPrompts: () => Promise<PromptListResponseDto>;
}): PromptsState; // { prompts, folders, sharedWithMe, publicPrompts, publicFolders, isLoading, error, refetch, refetchPublicPrompts }

function useSkillsState(params: {
  listSkills: () => Promise<SkillCatalogListResponseDto>;
  enabled: boolean;
  ready: boolean;
}): SkillsState; // { skills, sharedWithMe, publicSkills, isLoading, error, refetch, mergeSharedSkill }

function useFavoriteEntitiesState(params: {
  loadFavorites: () => Promise<{
    deployments: string[]; toolsets: string[]; prompts: string[]; skills: string[];
  }>;
  updateFavorite: (id: string, isFavorite: boolean, entityType: FavoriteEntityType) => Promise<void>;
}): FavoritesState; // { favoriteIds, isLoading, toggleFavorite }
```

`FavoriteEntityType` is currently defined inside `FavoriteApplicationsContext.tsx`; it moves to
`chat-hooks` alongside the hook since it is a small, dependency-neutral enum with no app coupling and the
hook's own signature needs it. It is not moved to `chat-shared` — nothing outside `chat-hooks` and
`apps/chat` needs it, so per the proposal's guidance ("place a reusable favorite entity-type contract in
`chat-shared` only if it is truly shared across packages; otherwise keep it in `chat-hooks`") it stays in
`chat-hooks`.

The three app Contexts shrink to: resolve `enabled`/`ready` (Skills only, via `useUiFeature`/`useUser`),
build the API-callback closures against the real `server-api` modules, call the hook, and expose the
result unchanged through the existing `PromptsContextType`/`SkillsContextType`/
`FavoriteApplicationsContextType` interfaces — so no consumer of `usePrompts()`/`useSkills()`/
`useFavoriteApplications()` needs to change.

Alternative considered: pass `enabled`/`ready` into `usePromptsState`/`useFavoriteEntitiesState` too, for
symmetry. Rejected — neither Prompts nor Favorites has gating behavior today; adding unused parameters
that always resolve to `true` would be speculative generality the proposal explicitly discourages ("avoid
embedding … generic defaults" for capabilities that don't exist yet).

### D11 — Dependency graph after this change

```
chat-shared  (no library dependencies)
   ^                         ^
   |                         |
conversation-panel       chat-hooks
```

- `conversation-panel` depends on `chat-shared` only (unchanged) — the new components add zero new
  library dependencies, only new imports from `chat-shared`.
- `chat-hooks` continues to depend on `chat-shared` and does not depend on `conversation-panel`.
  `ConversationItem` remains structurally compatible at the `apps/chat` call site, while the canonical
  `FilterTab` runtime/type contract lives in `chat-shared` and is re-exported by `conversation-panel`.
  This avoids both a circular feature-library edge and two nominally distinct string enums.
- No new npm dependency is introduced anywhere in this change.

### D12 — `mapDeploymentLimitsDtoToCatalogLimits` moves to `chat-hooks` with labels injected instead of `TFunction`

`apps/chat/src/utils/map-deployment-limits-to-catalog.ts` is otherwise pure (it only reads
`DeploymentLimitsResponseDto`/`LimitStatsDto` from `@epam/ai-dial-chat-api-client` — already a
`chat-hooks` peer dependency — and builds `CatalogItemLimits`/`UsageLimitProgressRow` values from
`@epam/ai-dial-catalog` — also already a `chat-hooks` peer dependency), but it currently takes a raw
`TFunction` and calls `t(mapping.labelKey)`/`t(CatalogI18nKeys.DetailsLimitsValue, {...})` directly,
coupling it to the app's own `CatalogI18nKeys` enum. That direct `i18next`/translation-key coupling is
exactly what the library-isolation boundary forbids, so the function cannot move as-is even though
everything else about it is portable. It moves with its label lookup replaced by an injected
`DeploymentLimitsLabels` object:

```ts
interface DeploymentLimitsLabels {
  requestsPerHour: string;
  requestsPerDay: string;
  tokensPerMinute: string;
  tokensPerDay: string;
  tokensPerWeek: string;
  tokensPerMonth: string;
  costPerMinute: string;
  costPerDay: string;
  costPerWeek: string;
  costPerMonth: string;
  unlimitedValue: string;
  formatValueLabel: (used: string, total: string) => string;
  formatProgressAriaLabel: (params: { label: string; used: string; total: string }) => string;
}
function mapDeploymentLimitsDtoToCatalogLimits(
  dto: DeploymentLimitsResponseDto | undefined,
  labels: DeploymentLimitsLabels,
): CatalogItemLimits | undefined;
```

The ten flat string fields replace the ten `CatalogI18nKeys` label lookups; `formatValueLabel` and
`formatProgressAriaLabel` replace the two templated `t()` calls
(`DetailsLimitsValue`/`DetailsLimitsProgressAriaLabel`) that need interpolation, since a `chat-hooks`
utility cannot call `t()` itself — the same resolver-injection shape D7 already uses for
`resolveIconTooltip`. `CatalogView.tsx` builds this object once from `useTranslation` (mapping each
`CatalogI18nKeys` entry to its labels field, and wrapping the two templated keys in small closures) and
passes it to the relocated function; the pure numeric/currency formatting (`Intl.NumberFormat`,
unlimited-total detection, `shouldShowLimitStats` filtering) is unchanged.

Alternative considered: keep accepting `TFunction` and have the caller pass its own `t`, since
`chat-hooks` already peer-depends on nothing that would forbid an `i18next` type import. Rejected — the
function's *behavior* would still be hard-wired to `CatalogI18nKeys`, an app-owned enum, so the utility
would not actually be portable to a different host with different translation keys; only the flat-labels
shape decouples the mapping logic from any specific key set, consistent with every other labels-object
decision in this change (D4, D10).

This unit has exactly one consumer (`CatalogView.tsx`) and no dependency on any of Slices 1–4's work, so
it is sequenced as its own slice and can land independently.

## Risks / Trade-offs

- **[Risk]** Splitting `getActions`'s pure decision logic (D6) from its `DropdownItem` construction could
  drift apart over time (decision hook says "revoke visible" but the JSX forgets to render it).
  → **Mitigation**: keep `deriveConversationRowActionState`'s fields 1:1 with the exact booleans
  `getActions` branches on today (verified against the current test suite's 14 revoke-visibility +
  7 unpublish-visibility test cases), and require `ConversationPanelView.spec.tsx` to keep passing
  unchanged as the regression guard.
- **[Risk]** Extracting `useActiveConversationSync`'s intentionally-incomplete dependency array (D8) into
  a reusable hook makes the "why is this array incomplete" rationale one hop further from the effect
  itself. → **Mitigation**: mandatory JSDoc on the hook carrying the original inline comment verbatim, and
  a dedicated unit test asserting no refetch loop when `items` changes without `activeConversationId`
  changing.
- **[Risk]** Moving `getUtf8ByteLength`/`sanitizeConversationName`/`stripTrailingDots` to `chat-shared`
  while keeping `chat-hooks` re-exports (D3) creates a transitional period where two import paths resolve
  to the same function — a future contributor could reintroduce a second implementation by mistake.
  → **Mitigation**: `chat-hooks`'s copies become pure re-exports (`export { X } from
  '@epam/ai-dial-chat-shared'`), not parallel definitions; `npm run validate:docs` plus a lint rule
  against duplicate exports across the two packages' READMEs catches drift.
- **[Risk]** `ImportExportQueue`/`RenameConversationPopup`'s existing component-level test suites move to
  `libs/conversation-panel`, and the app keeps only a thin wiring test — if the wiring test is too thin,
  a broken label-object wire-up (e.g. an app label field renamed but not updated at the call site) could
  slip through with only a TypeScript error at build time, not a caught test failure at PR time.
  → **Mitigation**: the app-level wiring test explicitly renders the real component with the real
  `useTranslation`-backed labels object and asserts at least one translated string appears, catching both
  wiring and missing-i18n-key regressions.
- **[Trade-off]** `FavoriteEntityType` staying in `chat-hooks` rather than `chat-shared` (D10) means a
  future third consumer of that enum outside `chat-hooks`/`apps/chat` would require a follow-up move.
  Accepted per the proposal's "only if truly shared" guidance — no second consumer exists today.
- **[Risk]** `DeploymentLimitsLabels` (D12) has two function-valued fields
  (`formatValueLabel`/`formatProgressAriaLabel`) alongside ten plain-string fields — an inconsistent
  shape that could tempt a future contributor to hardcode a template string in the hook instead of
  calling the injected formatter. → **Mitigation**: keep the existing
  `map-deployment-limits-to-catalog.spec.ts` assertions (moved to `chat-hooks`) exercising both
  formatter callbacks explicitly, so a hardcoded template regresses a test immediately.

## Migration Plan

1. **Slice 1** — move `ImportExportQueue` + transfer contracts (D2, D4 partial). Land `chat-shared`
   types and re-exports first, then the component, then update `apps/chat`'s call site to the new import
   path with a labels object. Verify via `nx build`/`test`/`lint` on `conversation-panel`, `chat-hooks`,
   `chat-shared`, `chat` (affected only).
2. **Slice 2** — move `RenameConversationPopup` + name-validation utilities (D3, D4 partial). Same
   land-shared-first-then-component-then-call-site order.
3. **Slice 3** — add `usePromptsState`/`useSkillsState`/`useFavoriteEntitiesState` + `FavoriteEntityType`
   to `chat-hooks` (D10); refactor the three app Contexts to call them without changing their public
   Context API. Existing Context-level `*.spec.tsx` files should keep passing with minimal edits (mock
   target moves from the server-api module to the hook's injected callback param in a few cases).
4. **Slice 4** — extract the controller hooks/utilities from `ConversationPanelView` (D5–D9), one hook at
   a time, re-verifying `ConversationPanelView.spec.tsx` stays green after each extraction before moving
   to the next hook.
5. **Slice 5** — move `mapDeploymentLimitsDtoToCatalogLimits` (D12): land the `DeploymentLimitsLabels`
   type and the relocated function plus its tests in `chat-hooks` first, then update `CatalogView.tsx`'s
   call site to build the labels object and delete the old app-owned utility. Independent of Slices 1–4;
   may land in any order relative to them.
6. Update `libs/conversation-panel/README.md`, `libs/chat-hooks/README.md`, `libs/chat-shared/README.md`,
   and `docs/architecture.md` in the same commits that change the corresponding export surface (per
   `AGENTS.md`'s same-change documentation rule), then run `npm run validate:docs`.

**Rollback**: each slice is an independently revertible commit range (component/hook move + call-site
update + README update); reverting a later slice never requires reverting an earlier one, since slices
2–4 do not depend on 1's implementation, only on the change being sequenced after it in one PR stream.

## Open Questions

- Whether `useConversationPublishHistory` (currently app-local, structurally similar to
  `useShareRecipientsCount`) should be migrated to `chat-hooks` in this change or a follow-up — flagged
  as a good candidate by the exploration but not required by any of the four proposal slices; recommend
  a separate follow-up change to keep this one scoped to the proposal's explicit file list.
