## Context

`CatalogView.tsx` (1685 lines) is the app's largest component: 45 `useState`/`useEffect`/`useCallback`/`useMemo` calls sitting in one function body between the data contexts (`useDeployments`, `usePrompts`, `useSkills`, `useFavoriteApplications`, plus two existing preference hooks) and a JSX return. The logic falls into clearly separable concerns — catalog-item derivation, toolset credential login/logout, publish/unpublish, share/unshare, per-item actions (use-in-chat, download, favorite), and edit/delete/create-menu navigation — each reading a different slice of context state and calling a different set of `server-api` wrappers, with only light cross-talk between them (mainly `deployments`, `t`, notification helpers, and a couple of shared callbacks like `findDeploymentByIdOrReference`).

This mirrors the shape the repo has already handled successfully: `useDialFileManager` (split into composed sub-hooks) and `ConversationPanelView`'s reusables extraction. Both landed as incremental, hook-by-hook slices rather than one large rewrite, verified after each slice.

Constraint: the extracted logic depends throughout on app-owned concerns — `server-api/*.api.ts` wrappers, React Router's `useNavigate`, several React Contexts, and i18n (`useTranslation`, `translation-keys.ts` enums). Per AGENTS.md's library isolation rule, none of this may move into `libs/*` (including `libs/catalog`, which only owns the presentational `Catalog` component and its host-agnostic types) — the new hooks belong in `apps/chat/src/hooks/`, alongside the two catalog preference hooks that already live there.

## Goals / Non-Goals

**Goals:**

- Reduce `CatalogView.tsx` to a thin composition root: call data-source hooks, call the new extracted hooks (passing each the inputs it needs and threading its outputs to the JSX/other hooks), render the existing JSX unchanged.
- Preserve behavior exactly — same i18n keys, same notification copy, same error handling (including the intentional silent-cancel and swallowed-refetch-error paths that carry explanatory comments today), same `useCallback`/`useMemo` dependency semantics.
- Land as a sequence of independently mergeable, independently testable slices (one hook group at a time), each verified with `npm run verify:changed` before moving to the next.
- Split the 5275-line `CatalogView.spec.tsx` in step with the extraction: move each group's test coverage into a co-located `useX/tests/useX.spec.ts(x)`, leaving `CatalogView.spec.tsx` covering composition/rendering and cross-hook integration only.

**Non-Goals:**

- No behavior change, no new capability, no UI change, no new API endpoints.
- No change to `libs/catalog`'s `Catalog`/`CatalogItem` public API or to any `@epam/ai-dial-chat-hooks` export.
- Not attempting to fully eliminate prop-drilling between the new hooks and the JSX in this change — some pass-through is expected and acceptable; a deeper composition redesign (e.g. a single `useCatalogView` umbrella hook) is left as a follow-up if the maintainers want it after this lands.
- Not touching `ConversationPanelView.tsx` (tracked separately as `extract-conversation-panel-view-hooks-2` per `refactoring-frontend.md`).

## Decisions

**Hook location: `apps/chat/src/hooks/useCatalogXxx/useCatalogXxx.ts`, not `libs/catalog`.**
Every extracted piece calls `server-api` wrappers, React Router's `navigate`, or reads app Context/i18n — all forbidden inside `libs/*` per AGENTS.md §Library isolation. This matches the existing `useCatalogActiveTabPreference` / `useCatalogSortFilterPreference` placement (same file/folder naming convention: `useX/useX.ts` + `useX/tests/useX.spec.ts`).

**Six hook groups, split by concern rather than by React hook type.**
Alternative considered: one large `useCatalogViewState` hook holding everything, just moved out of the component body. Rejected — that would reproduce the same 45-hook monolith one file over, with no gain in readability or testability. Splitting by concern (credentials, publishing, sharing, item actions, edit/navigation, item derivation) lets each hook be tested against a narrow, realistic set of inputs and gives each a name that describes what it's for.

Alternative considered: one hook per handler (`useHandleLogin`, `useHandleLogout`, …). Rejected as too fine-grained — several handlers in the same concern share closely-related state (e.g. `handleLogin`/`handleLogout` both need `getLevelStatus`, `showLoginSuccess`/`showLogoutSuccess`) and splitting them further would multiply prop-threading without adding clarity.

**Groups keep their current dependencies verbatim; no new memoization strategy.**
Each `useCallback`/`useMemo` moves with its existing dependency array. This is a structural move, not an optimization pass — introducing new memoization behavior here would conflate "did the refactor change behavior" with "did we also retune performance," making the diff harder to verify against the original 5275-line spec.

**`CatalogView.tsx` composes hooks in the same order the logic appears today.**
Preserves the mental model for anyone diffing before/after, and avoids surfacing ordering-dependent bugs (e.g. a hook reading a value assumed to already be computed) that a reshuffle could introduce.

**Test migration follows the hook split 1:1.**
Alternative considered: leave all 5275 lines in `CatalogView.spec.tsx` and only add thin new hook tests. Rejected — that doubles test maintenance (same behavior asserted in two places) and does nothing to address the audit's flagged "5275-line spec, largest in the repo" finding. Instead, each slice moves its own test cases out of `CatalogView.spec.tsx` into the new hook's spec, using `renderHook` from `@testing-library/react` with the same mocked `server-api`/context modules already set up in the existing spec's fixtures.

## Risks / Trade-offs

- **[Risk] `CatalogView` is a central, frequently-touched surface (catalog browsing, sharing, publishing) — a bad extraction could regress a live feature silently.** → Mitigation: one hook group per slice, `npm run verify:changed` after each slice, and no slice merges until its portion of `CatalogView.spec.tsx` has been moved and still passes green against the extracted hook.
- **[Risk] Splitting the spec file risks losing integration coverage that only exercises multiple concerns together (e.g. login success triggering a `refetchToolsets` that then updates `catalogItems`).** → Mitigation: keep `CatalogView.spec.tsx` after all slices land, scoped down to composition/integration cases that exercise more than one hook's interaction; only fully-isolated unit cases move to the per-hook specs.
- **[Risk] `useCatalogItems` sits upstream of every other group (its `catalogItems`/`visibleCatalogItems` output feeds `handleDelete`, `handleUnshare`, `createOptions`, etc.), so it's the riskiest single extraction and the one most likely to reveal a missed dependency.** → Mitigation: extract it first (before the handler groups that consume its output), so any issue surfaces while the handlers are still inline and easy to compare against.
- **[Trade-off] Some inputs (e.g. `deployments`, `t`, `showErrorNotification`/`showSuccessNotification`, `notifyOperationSuccess`) are needed by most of the six hooks, so `CatalogView.tsx` will still thread a nontrivial number of shared values into each hook call.** Accepted for this change per the stated Non-Goal — a follow-up composition redesign can revisit this if the resulting composition root still feels heavy.

## Migration Plan

Not applicable — no deployment, data, or rollback concerns; this is a same-process, same-behavior internal code move guarded by existing tests plus `npm run verify:changed`/`npm run verify:full`. If a slice reveals a regression, revert that slice's commit; earlier merged slices are unaffected since each hook group is independent.
