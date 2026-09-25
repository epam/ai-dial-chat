**Note on sequencing.** The code for this change shipped in commit `a1067bca5` before the change was
written up — the audit and the removals were done interactively, and this change records the result
and corrects the five live specs that mandated the removed shims. Tasks are marked complete against
that commit; the verification each slice claims was actually run.

## 1. Audit

- [x] 1.1 Sweep every `.ts`/`.tsx` under `libs/*/src` and `apps/*/src` for three shapes: an
      `export … from '@epam/…'` crossing a package boundary, a file whose entire body is re-export
      statements, and `export { X };` after a local import. Nine laundering sites found, plus three
      app-edge renaming aliases classified separately (design **D3**).
- [x] 1.2 Count the real consumers of each site before deciding scope, so the cost of each removal
      was known rather than guessed — the table in `design.md` §Context. Two sites turned out to have
      **zero** consumers (`catalog`'s `FolderPath`, `chat-hooks`'s string utilities).
- [x] 1.3 Identify which sites are mandated by live specs in `openspec/specs/` — five of the nine,
      two of which had already recorded their own removal condition.

## 2. Libraries

- [x] 2.1 `conversation-panel`: stop re-exporting `FilterTab`; delete
      `src/types/conversation-classification.ts`, which held nothing else; repoint 14 internal
      importers to `@epam/ai-dial-chat-shared`.
- [x] 2.2 `conversation-panel`: drop `export { VirtualRowKind };` from `models/virtual-row.ts` and
      repoint its 4 importers to the sibling `types/virtual-row.ts` that declares it. The models file
      keeps its own import, which its interfaces need.
- [x] 2.3 `conversation-input`: stop re-exporting `AttachmentCard`, `AttachmentTray`,
      `AttachmentGroup`, `FileDndOverlay`, `getAttachmentIcon`, `AttachmentGroupProps`; repoint 6
      consumers to `@epam/ai-dial-attachment-input`.
- [x] 2.4 `catalog`: delete the `FolderPath`/`FolderPathProps` re-export from ui-kit (no consumers).
- [x] 2.5 `chat-hooks`: stop re-exporting `chat-shared`'s four conversation-transfer contracts from
      `conversation/conversation-transfer/types.ts`; repoint 5 importers. The file keeps the
      library's own transfer enums and event shapes.
- [x] 2.6 `chat-hooks`: stop re-exporting `chat-shared`'s four conversation-name string utilities
      from `shared/string-utils.ts`; repoint its own spec and `skill/useSkillFileActions.ts`
      (`files/file-name.ts` already imported from `chat-shared` directly).
- [x] 2.7 `quotations`: stop re-exporting `chat-shared`'s `AttachmentResource` from
      `utils/annotation.ts` and the barrel; repoint 2 `chat-hooks` importers. The now-unused local
      import is removed too.

## 3. Application

- [x] 3.1 Delete `apps/chat/src/server-api/api-error.ts` and repoint its 21 consumers to
      `@epam/ai-dial-chat-hooks` — satisfying the removal condition the file's own comment and the
      `api-error-trace-correlation` spec both recorded.
- [x] 3.2 Delete `apps/chat/src/server-api/tests/api-error.spec.ts`: it asserted only that the
      re-export resolved, and says so itself ("Full behavioral coverage now lives in
      `@epam/ai-dial-chat-hooks`'s own `api-error.spec.ts`").
- [x] 3.3 `apps/chat/src/utils/locale.ts`: stop forwarding `appendLocaleCode`,
      `composeLocalePayload`, `decomposeLocalizedFields`, `toBaseLocale` and the `LocalizedText`
      type; repoint 5 importers (including `utils/toolsets.ts`). Keep the two `PRIMARY_LOCALE`-
      supplying wrappers, which the `chat-hooks-domain-utilities` spec requires.
- [x] 3.4 Remove the two dead exports from `components/ErrorBoundary/ErrorBoundary.tsx`
      (`ErrorBoundary` re-exported from `react-error-boundary`, and `ErrorFallbackProps`) — nothing
      imported either — and drop the import that existed only to feed them. `ErrorFallback.tsx`'s own
      `export type { Props as ErrorFallbackProps }` becomes unreachable at the same time (it was only
      ever consumed through that re-export), so it goes too.

## 4. Declare the dependency the re-export hid (design D4)

- [x] 4.1 Add `@epam/ai-dial-attachment-input` to `peerDependencies` in
      `libs/conversation-messages/package.json` and `libs/source-panel/package.json`, and to both
      vite configs' `rollupOptions.external`.
- [x] 4.2 Run `nx sync` to pick up the resulting `tsconfig.lib.json` project references.
- [x] 4.3 Drop `@epam/ai-dial-conversation-input` from both libs' `peerDependencies`, from
      `source-panel`'s vite externals, and from their project references (via `nx sync`) — after the
      codemod neither lib imports anything from it.

## 5. Tests the compiler could not protect (design D2)

- [x] 5.1 Retarget `vi.mock('@epam/ai-dial-conversation-input')` to
      `@epam/ai-dial-attachment-input` in `source-panel`'s `FilesSection` and
      `ConversationSourcesPanel` specs — both stub `AttachmentCard`.
- [x] 5.2 Convert `ScheduledTaskDetailPage` and `ScheduledTaskEditPage` specs from mocking the
      deleted `../../../server-api/api-error` to a **partial** mock of `@epam/ai-dial-chat-hooks`
      (`importOriginal`), since the package carries far more than the two functions they stub.

## 6. Docs and specs

- [x] 6.1 Update the five affected lib READMEs: `conversation-panel` (`FilterTab` section),
      `conversation-input` (delete the "Re-exports from @epam/ai-dial-attachment-input" section and
      fix the overview sentence), `chat-hooks` (delete the stale
      `sanitizeConversationName`/`stripTrailingDots` section, and state that the transfer contracts
      come from `chat-shared`).
- [x] 6.2 Update `docs/architecture.md`'s conversation-history layering paragraph, which said
      `conversation-panel` "re-exports the shared `FilterTab` contract".
- [x] 6.3 Write the five MODIFIED/REMOVED spec deltas in this change, and correct
      `openspec/specs/attachment-input-lib/spec.md`'s prose overview in place — a capability
      overview is not expressible as a requirement delta (design **D5**).
- [x] 6.4 Verify `npm run validate:docs` passes. It caught one real stale README import
      (`stripTrailingDots` documented as a `chat-hooks` export after the re-export was removed).

## 7. Verify

- [x] 7.1 `npx nx run-many -t typecheck lint` — green across all 30 projects, except
      `mcp-app-sandbox:typecheck` (1 error) and `chat-api:typecheck` (788), both reproduced on a
      clean `development` checkout with this change stashed. Pre-existing, unrelated, untouched by
      this change.
- [x] 7.2 Full suites green: `chat` 141 files / 1974 passed + 2 skipped, `chat-hooks` 102 files,
      `catalog` 29, `conversation-input` 14, `quotations` 8, `conversation-panel` 7,
      `source-panel` 3, `conversation-messages` 2.
- [x] 7.3 Re-run the slice-1 audit script: **cross-package re-exports: 0**. What remains is only
      the three deliberately-kept renaming aliases (design **D3** — `CompletionMode`,
      `ClientChannelReportResult`, `DownloadFileDto`) and `libs/chat-overlay/src/protocol.ts`, the
      same-package barrel recorded as follow-up 8.1.

## 8. Follow-ups — recorded, not done here

- [ ] 8.1 `libs/chat-overlay/src/protocol.ts` is a one-line barrel sitting beside a `protocol/`
      directory of the same name, which `.claude/rules/all-ts.md` forbids by name — `'./protocol'`
      resolves to the file and silently shadows the directory. Surfaced by this audit but a
      different rule (same-package barrel, not cross-package laundering); design **D6**. Fix is to
      move it to `protocol/index.ts`.
- [ ] 8.2 `libs/conversation-messages`'s vite config does not list every `@epam/*` package it
      imports as external, so its build bundles them (noted in design **D4**). Worth a separate pass
      across all lib vite configs to check externals match declared peers, rather than patching the
      one package this change happened to touch.
