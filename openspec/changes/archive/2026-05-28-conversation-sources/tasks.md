## 1. i18n keys (`apps/chat`)

- [x] 1.1 Add `sidebar.sources.*` keys to `apps/chat/src/i18n/locales/en.json`:
  - `sidebar.sources.toggleOpen` → `"Open sidebar"`
  - `sidebar.sources.toggleClose` → `"Close sidebar"`
  - `sidebar.sources.ariaLabel` → `"Conversation sources"`
  - `sidebar.sources.close` → `"Close"`
  - `sidebar.sources.search` → `"Search files"`
  - `sidebar.sources.downloadAll` → `"Download all"`
  - `sidebar.sources.sections.uploadedFiles` → `"Uploaded Files"`
  - `sidebar.sources.sections.generatedFiles` → `"Generated Files"`
  - `sidebar.sources.sections.sources` → `"Sources"`
  - `sidebar.sources.empty.uploadedFiles` → `"No uploaded files in this conversation."`
  - `sidebar.sources.empty.generatedFiles` → `"No generated files in this conversation."`
  - `sidebar.sources.empty.sources` → `"No sources available."`
- [x] 1.2 Add the matching keys to `apps/chat/src/constants/translation-keys.ts` so consumers reference them via the typed map (mirror the existing `ChatI18nKeys` pattern, adding a `SidebarI18nKeys` group).

## 2. Sidebar context (`apps/chat`)

Single flat file following project convention (`DeploymentsContext`, `ThemeContext`, `UserContext`). No factory — a second sidebar would be a separate flat context file with the same shape.

- [x] 2.1 Create `apps/chat/src/context/SourcesSidebarContext.tsx` exporting `SourcesSidebarProvider`, `useSourcesSidebar`, and `SourcesSidebarContextValue { isOpen, toggle, messages, setMessages }`. `messages` is co-located in the same context so `ConversationSourcesPanelView` can read both state and data in one subscription without separating concerns. `setMessages([])` on cleanup prevents stale data when navigating away from a conversation.
- [x] 2.2 Wrap the app in `<SourcesSidebarProvider>` in `apps/chat/src/main.tsx` alongside `ThemeProvider`, `DeploymentsProvider`, etc.
- [x] 2.3 Unit tests in `apps/chat/src/context/tests/SourcesSidebarContext.spec.tsx` — initial state, `toggle`, `setMessages`, `setMessages([])` clears data, hook-outside-provider error.

## 3. `useConversationSources` hook (`apps/chat`)

- [x] 3.1 Create `apps/chat/src/hooks/useConversationSources.ts` exporting `useConversationSources(messages: Message[]): { uploaded: DisplayAttachment[]; generated: DisplayAttachment[] }`.
- [x] 3.2 Implementation: walk `messages` once, partition by `msg.role === MessageRole.User` vs `MessageRole.Assistant`, flat-map each message's `custom_content?.attachments`, map via the existing `attachmentDtosToDisplayAttachments` utility from `apps/chat/src/utils/attachment-dto-to-display.ts`. Return `useMemo`-wrapped object keyed on the `messages` reference.
- [x] 3.3 JSDoc the hook (purpose, return shape).
- [x] 3.4 Unit tests in `apps/chat/src/hooks/tests/useConversationSources.spec.ts` covering: empty messages, only-user attachments, only-assistant attachments, mixed roles, message without `custom_content`.

## 4. Sidebar toggle button (`apps/chat`)

- [x] 4.1 Update `apps/chat/src/components/Header/Header.tsx`: switch the root from a centred flex to `grid-cols-[1fr_auto_1fr]`, keep `<Logo />` in the centre column, add a right-aligned `DialGhostIconButton` with `IconFile` (`@tabler/icons-react`).
- [x] 4.2 Wire the button to `useRightSidebar().toggle()`. Set `aria-pressed={isOpen}`. Use `t(SidebarI18nKeys.ToggleOpen)` when closed, `t(SidebarI18nKeys.ToggleClose)` when open, for both `aria-label` and `tooltipProps.tooltip`.
- [x] 4.3 Update `apps/chat/src/components/Header/tests/Header.spec.tsx`: assert toggle present, clicking it toggles the context value (wrap test in `<RightSidebarProvider>`), `aria-pressed` reflects state, `aria-label` switches strings.

## 5. New lib `libs/sidebar` with `SidebarPanel` shell

- [x] 5.1 Generate the lib: `pnpm nx g @nx/react:lib sidebar --directory=libs/sidebar --bundler=vite --unitTestRunner=vitest --linter=eslint --tags=type:ui --importPath=@epam/ai-dial-sidebar` (mirror generator flags actually used for `libs/conversation-input` if they differ — check `libs/conversation-input/project.json` first).
- [x] 5.2 Align `libs/sidebar/package.json` with `libs/conversation-input/package.json`: `private: true`, `type: "module"`, `main`/`module`/`types` pointing to `dist/`, `exports` map (including `./styles.css`), peer deps for `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@tabler/icons-react`, `classnames`. No `react-i18next`, no `react-dropzone`.
- [x] 5.3 Verify `tsconfig.base.json` has the alias `@epam/ai-dial-sidebar` → `libs/sidebar/src/index.ts`. Add it if the generator did not.
- [x] 5.4 Create `libs/sidebar/src/models/SidebarPanel.ts` with JSDoc on every exported symbol:
  - `SidebarOrientation = 'left' | 'right'` (named type alias).
  - `SidebarPanelColors { background?: string; border?: string; headerBorder?: string; }`.
  - `SidebarPanelTypography { fontClassName?: string; fontFamily?: string; fontSize?: string; }`.
  - `SidebarPanelProps { side: SidebarOrientation; leftActions?: ReactNode; rightActions?: ReactNode; onClose: () => void; ariaLabel: string; closeLabel: string; children: ReactNode; colors?: SidebarPanelColors; typography?: SidebarPanelTypography; className?: string; }`.
- [x] 5.5 Create folder `libs/sidebar/src/components/SidebarPanel/`. Add `SidebarPanel.tsx` exporting `SidebarPanel: FC<SidebarPanelProps>`. File-header comment: `leftActions` / `rightActions` are header-bar positions and are independent of `side`.
- [x] 5.6 Render `<aside role="complementary" aria-label={ariaLabel}>` with `w-[360px]`, full height column, header bar (48 px) with bottom border, scrollable body (`overflow-y-auto`). Layout via Tailwind only (no SCSS for layout, per `openspec/lib-styling-guide.md`).
- [x] 5.7 Apply the side-specific divider via Tailwind: `side === 'right'` → `border-l`; `side === 'left'` → `border-r`. The actual color comes from a CSS variable (next step), so use a class like `border-l` / `border-r` plus the SCSS module's `border-color` rule.
- [x] 5.8 Header bar layout: three logical regions (left group / spacer / right group). Always render `leftActions` in the left group and `rightActions` in the right group. Append the built-in close `DialGhostIconButton` (`IconX`) to the **outer-edge** group: `side === 'right'` → close in right group as last child; `side === 'left'` → close in left group as first child. Close button uses `closeLabel` for both `aria-label` and `tooltipProps.tooltip`.
- [x] 5.9 Create `libs/sidebar/src/components/SidebarPanel/SidebarPanel.module.scss` per the lib styling guide. Define three CSS-variable rules with hex fallbacks: `--sb-bg` (panel background, default `var(--bg-layer-2, #161B2D)`), `--sb-border` (divider color, default `var(--stroke-primary, #696e7c)`). No layout, no spacing, no border-radius in the SCSS module.
- [x] 5.10 Inside `SidebarPanel.tsx`, build CSS-var overrides via `buildCssVars` from `@epam/ai-dial-chat-shared` (`--sb-bg`, `--sb-border`, plus typography vars). Apply via `style={cssVars}`. Merge classes via `mergeClasses(styles.wrapper, …, typography?.fontClassName, className)`.
- [x] 5.11 Add `libs/sidebar/src/index.ts` exporting `SidebarPanel`, `SidebarPanelProps`, `SidebarPanelColors`, `SidebarPanelTypography`, `SidebarOrientation`.
- [x] 5.12 Update `libs/sidebar/vite.config.mts` to emit `dist/style.css` (mirror `libs/conversation-input/vite.config.mts`).
- [x] 5.13 Unit tests in `libs/sidebar/src/components/SidebarPanel/tests/SidebarPanel.spec.tsx` covering both `side` values:
  - renders children in the body for both sides.
  - `leftActions` and `rightActions` land in the correct header regions for both sides.
  - close button is positioned in the right group when `side="right"` and in the left group when `side="left"`; calls `onClose` on click in both cases.
  - divider class flips between `border-l` (right) and `border-r` (left).
  - `aria-label` applied; `role="complementary"` present.
  - `colors` / `typography` props produce the corresponding CSS-variable inline styles via `buildCssVars`.
- [x] 5.14 Verify: `pnpm nx typecheck sidebar`, `pnpm nx lint sidebar`, `pnpm nx test sidebar`, `pnpm nx build sidebar`.

## 6. Section components (`apps/chat`)

`UploadedFilesSection` and `GeneratedFilesSection` were merged into a single `FilesSection` because they are structurally identical in this slice. If a future iteration requires divergent visuals or behaviour, split `FilesSection` back into two components at that point.

- [x] 6.1 Create folder `apps/chat/src/components/ConversationSourcesPanel/sections/FilesSection/`.
- [x] 6.2 `FilesSection.tsx`: `Props { attachments: DisplayAttachment[]; title: string; emptyMessage: string; }`. Renders a `<section>` with `<h2>{title}</h2>` and either the 3-column grid of `AttachmentCard`s (read-only — no `onRemove`, no `onRetry`) or the empty-state line. Used twice in `ConversationSourcesPanel` — once for uploaded, once for generated.
- [x] 6.3 Create `SourcesSection/SourcesSection.tsx`: `Props { title: string; emptyMessage: string; }`. Renders only the title and the empty placeholder (no link list this slice).
- [x] 6.4 Tile sizing: each card uses `w-full` and lets its content drive the height — no fixed `h-[…]` so different screen sizes, font scales, and content lengths render correctly. Grid is `grid grid-cols-3 gap-3`. The grid has `role="list"` and each grid cell `role="listitem"`.
- [x] 6.5 Unit tests in `FilesSection/tests/` and `SourcesSection/tests/` covering: renders title, renders cards when non-empty, renders empty message when empty, `role="list"` semantics.

## 7. `ConversationSourcesPanel` (`apps/chat`)

- [x] 7.1 Create `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` with `Props { messages: Message[]; onSearch?: () => void; onDownloadAll?: () => void; }`.
- [x] 7.2 Inside the component: call `useConversationSources(messages)` for `{ uploaded, generated }`; call `useRightSidebar()` for `close`; call `useTranslation()` for labels.
- [x] 7.3 Import `SidebarPanel` from `@epam/ai-dial-sidebar` and import `'@epam/ai-dial-sidebar/styles.css'` once in `apps/chat/src/main.tsx` (alongside the existing conversation-input styles import). Compose `<SidebarPanel side="right">` with:
  - `leftActions`: `<DialGhostIconButton icon={<IconSearch />} aria-label={t(SidebarI18nKeys.Search)} disabled={!onSearch} onClick={onSearch} />`
  - `rightActions`: `<DialGhostIconButton icon={<IconDownload />} aria-label={t(SidebarI18nKeys.DownloadAll)} disabled={!onDownloadAll} onClick={onDownloadAll} />`
  - `onClose={close}`, `ariaLabel={t(SidebarI18nKeys.AriaLabel)}`, `closeLabel={t(SidebarI18nKeys.Close)}`
  - children: the three section components in order (Uploaded, Generated, Sources)
- [x] 7.4 Unit tests in `ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx` covering: derives uploaded vs generated correctly from messages, search and download buttons disabled when callbacks omitted, search and download buttons fire callbacks when provided, close button closes the sidebar via context, sections render in order.

## 8. Mount point (`apps/chat`)

`ConversationSourcesPanelView` is in `apps/chat/src/components/ConversationSourcesPanel/` and isolates all context subscriptions from `App` to prevent re-renders on streaming chunks. `App` renders it as a sibling of `<main>` — no provider wrapping, no prop drilling.

- [x] 8.1 `SourcesSidebarProvider` wraps the app in `apps/chat/src/main.tsx` alongside `ThemeProvider`, `DeploymentsProvider`, etc.
- [x] 8.2 `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanelView.tsx` subscribes to `useSourcesSidebar()` and renders `<ConversationSourcesPanel messages={messages} />` when `isOpen`, otherwise `null`.
- [x] 8.3 `app.tsx` renders `<ConversationSourcesPanelView />` as a sibling after `<main>` — no context subscription in App itself.
- [x] 8.4 `Conversation.tsx` calls `setMessages(conversation?.messages ?? [])` in a `useEffect` and `setMessages([])` on cleanup so the context stays in sync when navigating between conversations.

## 9. Final verification

- [x] 9.1 `pnpm nx run-many --target=typecheck --projects=sidebar,chat` — no type errors.
- [x] 9.2 `pnpm nx run-many --target=lint --projects=sidebar,chat` — no lint errors.
- [x] 9.3 `pnpm nx run-many --target=test --projects=sidebar,chat` — all tests pass.
- [x] 9.4 `pnpm nx run-many --target=build --projects=sidebar,chat` — production build green for both projects.
- [x] 9.5 `pnpm nx affected --target=lint,typecheck,test --base=origin/development` — no regressions in unaffected libs.
- [x] 9.6 Smoke test in browser: open `/conversations/<id>` with a conversation containing at least one user attachment and one assistant attachment; click the header toggle; verify the panel opens, both sections render the right cards, sources section shows the empty placeholder, the close button hides the panel, search and download buttons are visibly disabled.
