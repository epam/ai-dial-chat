## Context

A workspace-wide audit found nine sites where a module re-published another module's symbols. The
audit was mechanical (a script over every `.ts`/`.tsx` under `libs/*/src` and `apps/*/src`, looking
for three shapes: `export … from '@epam/…'` crossing a package boundary, files whose entire body is
re-export statements, and `export { X };` after a local import), so the list is exhaustive for those
shapes rather than a sample.

The important finding was not the count but the **spread of real cost**, which decided the scope:

| Site | Laundered | Consumers to repoint |
| --- | --- | --- |
| `conversation-panel` barrel | `FilterTab` ← `chat-shared` | 14 internal + 2 app |
| `conversation-panel/models/virtual-row.ts` | `VirtualRowKind` ← sibling `types/virtual-row.ts` | 4 |
| `conversation-input` barrel | 6 names ← `attachment-input` | 6 |
| `catalog` barrel | `FolderPath`, `FolderPathProps` ← `ui-kit` | **0** |
| `chat-hooks/conversation-transfer/types.ts` | 4 contracts ← `chat-shared` | 5 |
| `chat-hooks/shared/string-utils.ts` | 4 utilities ← `chat-shared` | 2 |
| `quotations` barrel | `AttachmentResource` ← `chat-shared` | 2 |
| `apps/chat/server-api/api-error.ts` | 5 names ← `chat-hooks` | 21 |
| `apps/chat/utils/locale.ts` | 4 helpers ← `chat-hooks` | 5 |

Two constraints shaped the work. First, five of the nine were **mandated by live specs**, so removing
them is a spec change, not just a refactor — hence this change exists at all. Second, `AGENTS.md`
§Library isolation makes the package boundary load-bearing: a lib's declared dependencies are how the
boundary is enforced, so a re-export that hides an edge is a correctness problem, not a style one.

## Goals / Non-Goals

**Goals:**

- One import path per symbol: the package that declares it.
- Correct the five live specs that mandate the removed shims, so the written contract and the code
  agree.
- Make the dependency the `attachment-input` re-export hid explicit in `package.json`, the bundler
  config, and the Nx project graph.

**Non-Goals:**

- Touching the app-edge **renaming** aliases (D3).
- Any behavioural change. Every edit is an import path, a `package.json` field, or spec prose.
- Fixing the unrelated `libs/chat-overlay/src/protocol.ts` file-beside-same-named-directory
  violation found during the audit (D5).

## Decisions

### D1 — Direct imports, no replacement shim

The obvious alternative to each removal is to move the re-export somewhere else (for example, have
`conversation-panel`'s barrel forward `FilterTab` from `chat-shared` instead of from a local file).
That preserves the exact problem: the consumer still names the wrong package.

So every site is resolved the same way — the consumer imports from the owner — and nothing is left
behind. Three files whose entire body was forwarding are deleted rather than emptied.

The cost is a wide diff (~80 files) with one property that makes it safe: **every edit is
compiler-checked**. A missed or misspelled import is a build failure. That is why the sweep was
applied as a single codemod with `eslint --fix` settling `import/order`, rather than by hand.

### D2 — `vi.mock()` is the one thing the compiler cannot check

`vi.mock('<path>')` takes the module path as a **string literal**, so a mock aimed at a module that
no longer exports the name it stubs still compiles — and then the component under test receives the
real implementation.

This bit four times: `source-panel`'s `FilesSection` and `ConversationSourcesPanel` specs mocked
`AttachmentCard` on `@epam/ai-dial-conversation-input`, and the `ScheduledTaskDetailPage` /
`ScheduledTaskEditPage` specs mocked the deleted `../../../server-api/api-error`. All four failed
loudly at test time, so nothing shipped silently, but the class of breakage is worth recording: **any
re-export removal must sweep `vi.mock` call sites for the old path**, not just imports. The
Scheduled-Task pair also had to become partial mocks (`importOriginal`), because the replacement
target — the whole `chat-hooks` package — carries far more than the two functions they stub.

### D3 — Renaming a generated symbol is adaptation, not laundering

Three app-edge sites look like the same pattern but are not:

```ts
export { SendCompletionDtoModeEnum as CompletionMode };          // ~60 call sites
export { ReportClientChannelDtoResultEnum as ClientChannelReportResult };
export { FileParamsDto as DownloadFileDto };
```

Each gives a generated-client symbol a domain name at the application edge, which is precisely what
`AGENTS.md` asks apps to do with generated clients. The test that separates the two categories: does
removing the line change what call sites *say*? For a pure forward, no — the name is identical either
way, and the only effect is a shorter path to the truth. For these three, yes — 70 call sites would
start naming DTO enums instead of domain concepts.

Kept deliberately, and recorded here so a future audit does not read the omission as an oversight.

### D4 — The hidden dependency is declared, and the stale one dropped

Removing `conversation-input`'s attachment re-export was the only site with real dependency-graph
work, and that is itself the argument for doing it: `conversation-messages` and `source-panel`
*render* `attachment-input`'s components while declaring only `conversation-input`. The dependency
was always real; the re-export just kept it off the books.

Both libs now declare `@epam/ai-dial-attachment-input` as a peer dependency and mark it external.
`nx sync` then added the matching `tsconfig.lib.json` project references **and** removed the
`conversation-input` references, because after the codemod neither lib imports anything from that
package any more — so its peer dependency and bundler external are dropped too. The graph now states
what the code does, in both directions.

One pre-existing oddity noted, not fixed: `conversation-messages`'s vite config never listed
`@epam/ai-dial-conversation-input` as external even while importing from it, so its build bundled the
dependency. The new `attachment-input` entry is listed correctly.

### D5 — Prose overviews are corrected in the live spec, not as a delta

A delta spec can carry ADDED / MODIFIED / REMOVED **requirements**. Two of the corrections are not
requirements: `attachment-input-lib`'s capability overview paragraph, and `conversation-input`'s
README overview sentence, both of which describe the re-export in prose.

The overview paragraph in `openspec/specs/attachment-input-lib/spec.md` is therefore corrected in
place rather than expressed as a delta, and this decision records why the change touches a live spec
file directly. The README is ordinary same-change documentation upkeep.

### D6 — An out-of-scope finding, recorded rather than fixed

The audit also surfaced `libs/chat-overlay/src/protocol.ts` — a one-line barrel
(`export * from './protocol/overlay-protocol'`) sitting beside a `protocol/` directory of the same
name. `.claude/rules/all-ts.md` forbids exactly this, using this shape as its own counter-example,
because `'./protocol'` silently resolves to the file and shadows the directory.

It is a different rule from the one this change enforces (a same-package barrel, not cross-package
laundering), so it is left alone and recorded as a follow-up rather than folded in.

## Risks / Trade-offs

- **[Breaking package API]** → Ten names leave five packages' public surfaces. Mitigation: every
  name is still exported by the package that declares it, so each migration is a one-line import
  change the compiler locates precisely. No name was deleted.
- **[Wide diff invites a missed call site]** → ~80 files. Mitigation: the compiler covers imports;
  D2 covers the one hole (`vi.mock` strings), which the full suites exercised.
- **[Re-litigating shims added on purpose]** → Two of the five spec-mandated shims documented their
  own removal condition, and this change satisfies it; the other three are reversed on the recorded
  grounds above rather than silently. The renaming aliases are explicitly reaffirmed (D3), so the
  earlier judgement is narrowed, not discarded wholesale.
- **[Trade-off accepted]** Consumers now need two imports where one used to do (e.g. `FilterTab`
  from `chat-shared` alongside `ConversationPanel` from `conversation-panel`). That is the intended
  cost: the second import is what makes the dependency visible.
