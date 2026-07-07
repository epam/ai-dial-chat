## Context

`DialFileManagerModal.tsx` (809 lines) currently owns three concerns in one file: popup chrome (`DialPopup` + attach footer), operation overlays (`UploadProgressModal`, download-loading state, error/retry panel), and the `DialFileManager` (ui-kit) prop assembly (grid/tree/toolbar/bulk option bags — `DialFileManagerModal.tsx:512-662`). `useDialFileManager.ts` (1558 lines) already has all the browsing/CRUD behavior the future standalone page needs (tabs, search, tree, upload/delete/rename/download) but has no concept of "who is hosting me" — every behavioral branch is keyed off `activeTab`, not off caller intent. This change is the prerequisite for issue #7502's standalone page (`add-file-manager-standalone-page`, sequenced after this one archives) and must not change any observable behavior of the existing attach modal.

## Goals / Non-Goals

**Goals:**

- Give `useDialFileManager` a `variant`/`actionProfile` vocabulary so a second host (the future standalone page) can express "same hook, different UI shell" without new hook duplication.
- Extract `DialFileManagerShell` so the option-bag assembly and overlay JSX exist in exactly one place.
- Zero behavior change for the attach modal — every existing `DialFileManagerModal.spec.tsx` assertion must still pass.

**Non-Goals:**

- No new route, page, or navigation entry (that's `add-file-manager-standalone-page`).
- No `folder-picker`/`full` UI or behavior — those enum members are reserved, unimplemented placeholders for #7503+.
- No move of shell code into `libs/*` — the shell needs i18n (`useTranslation`) and notification wiring, both of which are host-owned per AGENTS.md §Library isolation; moving it to a lib would require threading i18n/labels through a prop boundary for no current second consumer outside `apps/chat`. Revisit only if a non-`apps/chat` host emerges (#7506, explicitly out of scope).
- No change to the BFF/API surface — `apps/chat/src/server-api/files.api.ts` is untouched.

## Decisions

### 1. Shell file location: `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`

Follows the existing convention (`apps/chat/src/components/{ComponentName}/{ComponentName}.tsx`, folder name matches component name) used by `DialFileManagerModal` itself. Rejected: colocating under `DialFileManagerModal/` — that would suggest the shell is modal-private, which contradicts the whole point of the extraction (a second host, the standalone page, must import it as a sibling, not a submodule of the modal it's being extracted *out of*).

### 2. i18n ownership: host-owned, shell receives resolved labels

The shell does **not** call `useTranslation`. It receives a `labels` prop object (title strings, empty-state copy, action labels, confirm-dialog copy) plus resolved callback props (`onUploadFiles`, `onDelete`, etc.), mirroring how `DialFileManagerModal` already receives most of its labels via `Props` today (see `Props` interface, `DialFileManagerModal.tsx:46-79` — `attachLabel`, `emptyTitle`, `deleteLabel`, etc. are already passed in, not computed via `t()` inside a shared layer).

Rejected: shell calling `useTranslation()` directly. It would work today (i18n is global, not lib-scoped), but it means every current call site's `t()` key namespace (`dialFileManager.*`) becomes implicitly coupled to the shell's internal implementation, and the future standalone page would be forced to reuse the exact same keys or the shell would need per-variant key maps. Passing labels in keeps the shell a pure presentation layer — consistent with the "host passes resolved values" pattern this repo already uses for the modal, and easier to keep behavior-identical during this refactor since we're moving JSX, not rewriting label resolution logic.

### 3. `actionProfile` is the single source for per-tab action visibility

`useDialFileManager`'s existing `actionLabels` computation (`useDialFileManager.ts:1497-1510`) already conditions on `activeTab` (Delete/Rename only on `MyFiles`). `actionProfile` becomes an *additional* gate layered on top of that tab logic, not a replacement:

- `actionProfile: 'attach'` (derived default for `variant: 'attach'`): unchanged existing tab-conditional matrix.
- `actionProfile: 'browse'` (derived default for `variant: 'standalone'`): same tab-conditional matrix (My/Shared/Organization CRUD parity is explicitly required by #7502 AC #2) — for this change `'browse'` and `'attach'` compute an **identical** action set; the enum exists so a later change can diverge them (e.g. hide attach-only affordances) without another hook signature change.
- `actionProfile: 'full'`: reserved, unused in this change (throws in dev via an exhaustive `switch` default only if reached — it cannot be reached since no caller sets `variant: 'folder-picker'` yet).

Rejected: computing `actionProfile`-specific logic redundantly in both the hook (`actionLabels`) and the modal (`DialFileManagerModal.tsx:496-510`, which today re-filters the hook's labels). That duplication already exists pre-change; this change does not fix it (out of scope — no drive-by refactor) but does **not** add a third copy in the shell. The shell consumes whatever `actionLabels` the hook returns as-is.

### 4. Shell/modal contract: shell owns rendering, host owns orchestration state

`DialFileManagerShell` props = `{ hookResult: UseDialFileManagerResult, labels: ShellLabels, gridOptions/treeOptions overrides?: ... }` — the shell receives the *entire* `useDialFileManager` return value rather than 20 destructured individual props, so adding a new hook field later doesn't require a shell prop-signature change. `DialFileManagerModal` keeps owning: `DialPopup` open/close, attach footer, `onAttach`, attach-selection props (`allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`). The standalone page (next change) will own: page chrome, route params, and will pass `variant: 'standalone'` into the same hook + shell pairing with no attach footer.

### 5. Relationship to `useDialFileManagerState`

Not applicable to this change — `useDialFileManagerState` (referenced in `ConversationRoute.tsx`) is the modal-open/close boolean state for the attach flow. The shell has no opinion on it; it stays entirely inside the modal host. The standalone page (next change) does not touch it at all — confirmed as a design question closed here so the next change's design.md doesn't need to re-litigate it.

## Risks / Trade-offs

- [Risk] Passing the full `UseDialFileManagerResult` object into the shell (Decision 4) could make it harder to see at a glance which fields the shell actually uses → [Mitigation] the shell destructures only what it needs internally; the wide prop type is a call-site ergonomics choice, not a signal that the shell uses everything.
- [Risk] `actionProfile: 'browse'` and `'attach'` being behaviorally identical in this change could bit-rot silently (nobody exercises the branch difference) → [Mitigation] add a unit test asserting both profiles produce the same `actionLabels` for each tab today, so a future divergence is a deliberate, visible diff instead of an accidental one.
- [Trade-off] Not moving the shell into `libs/*` means the standalone page and the modal both live in `apps/chat`, so there's no cross-app reuse story yet — accepted because there is currently no second app that needs a file manager, and premature lib extraction would need a real i18n/host-adapter design (#7506) this change doesn't need to solve.
