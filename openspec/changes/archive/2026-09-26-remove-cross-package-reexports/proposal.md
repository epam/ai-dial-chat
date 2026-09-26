## Why

Nine places in this workspace re-published another module's symbols under their own name. A reader
chasing a declaration had to hop through a forwarding file to reach it, and — worse — the package
boundary read as if the symbol were locally owned, which is exactly the signal the library isolation
rules depend on being truthful.

Five of these were not incidental: they were **mandated by live specs** in `openspec/specs/`, added
deliberately as backwards-compatibility shims during earlier extractions. Two of those specs even
recorded the intent to remove the shim later:

| Live spec | What it mandated |
| --- | --- |
| `api-error-trace-correlation` | `apps/chat/src/server-api/api-error.ts` SHALL re-export five `chat-hooks` names *"until every one of its consumer files is migrated … at which point the app file SHALL be removed"* |
| `attachment-input-lib` | A whole Requirement: `libs/conversation-input` SHALL keep re-exporting the six attachment symbols it no longer owns |
| `chat-hooks-conversation-transfer` | `chat-hooks` SHALL re-export the four `chat-shared` transfer contracts from its own barrel |
| `conversation-rename` | `chat-hooks` SHALL re-export `sanitizeConversationName`/`stripTrailingDots` |
| `conversation-history-panel` | `conversation-panel` SHALL export `FilterTab` (owned by `chat-shared`) |

The shims outlived their purpose. `api-error.ts` still carried its own comment saying so. And one of
them was actively hiding a real dependency: `conversation-messages` and `source-panel` render
`attachment-input`'s components while declaring only `conversation-input` as a peer, so the true
graph edge was invisible in both `package.json` and Nx.

The four remaining sites were not spec-mandated: `catalog` re-exported ui-kit's `FolderPath` (with
**no consumers at all**), `chat-hooks` re-exported `chat-shared`'s string utilities (also none),
`quotations` re-exported `chat-shared`'s `AttachmentResource`, `conversation-panel`'s
`models/virtual-row.ts` re-exported `VirtualRowKind` from its sibling `types/virtual-row.ts`, and
`apps/chat`'s `utils/locale.ts` forwarded four `chat-hooks` locale helpers.

## What Changes

- Every call site imports the symbol from the package that owns it. Nine re-export sites removed;
  three files that did nothing but forward are deleted (`conversation-panel`'s
  `types/conversation-classification.ts`, `apps/chat`'s `server-api/api-error.ts`, and that file's
  spec, which only asserted that the re-export resolved).
- Two dead exports drop out of `apps/chat`'s `ErrorBoundary.tsx` — nothing imported either.
- `conversation-messages` and `source-panel` declare `@epam/ai-dial-attachment-input` as a peer
  dependency and mark it external; `nx sync` picks up the matching TypeScript project references,
  and the now-unused `@epam/ai-dial-conversation-input` dependency is dropped from both.
- Five live specs are corrected to describe direct imports (this change's spec deltas).

### Explicitly staying as-is

Three app-edge sites **rename** a generated-client symbol to a domain name rather than merely
forwarding it: `CompletionMode` (`SendCompletionDtoModeEnum`, ~60 call sites),
`ClientChannelReportResult` (`ReportClientChannelDtoResultEnum`), and `DownloadFileDto`
(`FileParamsDto`). Renaming a generated symbol at the application edge is the adaptation
`AGENTS.md` asks apps to perform, not laundering; removing these would spread generated DTO enum
names across ~70 call sites and make the code read worse, not better. Kept deliberately.

## Capabilities

### Modified Capabilities

- `api-error-trace-correlation`: the migration window the requirement described is closed — the
  forwarding app module is gone and consumers import from the package.
- `attachment-input-lib`: the backwards-compatibility re-export Requirement is removed and replaced
  by one requiring imports from the owning package, plus the peer-dependency declaration the
  re-export was hiding.
- `chat-hooks-conversation-transfer`: `chat-hooks` imports the four `chat-shared` contracts instead
  of re-exporting them; it keeps its own transfer enums and event shapes.
- `conversation-rename`: `chat-hooks` neither re-exports nor redeclares the name utilities.
- `conversation-history-panel`: `FilterTab` is no longer part of `conversation-panel`'s public API.

## Impact

- **Affected libs**: `conversation-panel`, `conversation-input`, `conversation-messages`,
  `source-panel`, `chat-hooks`, `catalog`, `quotations`.
- **Affected app code**: 40 `apps/chat` files switch import paths; `server-api/api-error.ts` and its
  spec are deleted; `utils/locale.ts` and `utils/toolsets.ts` adjust their imports.
- **Breaking for external consumers**: yes, at the package level — six names leave
  `@epam/ai-dial-conversation-input`'s public API, `FilterTab` leaves
  `@epam/ai-dial-conversation-panel`'s, four transfer contracts and four string utilities leave
  `@epam/ai-dial-chat-hooks`'s, `FolderPath` leaves `@epam/ai-dial-catalog`'s, and
  `AttachmentResource` leaves `@epam/ai-dial-quotations`'s. Each name is still exported by the
  package that declares it, so every migration is a one-line import change the compiler points at.
- **i18n**: none.
- **Rollback**: revert the commit. No data, route, HTTP contract, or DIAL Core change.
- **Not caught by the compiler**: `vi.mock()` takes a module path as a string, so four stale mocks
  (two in `source-panel`, two Scheduled-Task specs) failed at test time rather than build time.
  Any further consumer doing the same needs the same retargeting.

### Alternatives considered

1. **Leave the shims.** Zero risk, but two specs had already scheduled removal and one was hiding a
   dependency edge. Rejected.
2. **Remove only the four sites no spec mandated.** Cheap, but leaves the five worst cases — the
   ones a reader is most likely to trust — in place. Rejected.
3. **Remove the app-edge renaming aliases too.** Treats renaming as equivalent to forwarding. It
   is not: it is the adaptation apps are supposed to do. Rejected (see above).
4. **Remove all nine laundering sites, keep the renaming aliases** (chosen).
