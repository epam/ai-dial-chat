## Context

The chat layout today is a fixed 60px left `Navigation` plus a flex-grow `<main>` containing `Header` and the routed page. There is no right-side region. Attachments live inside individual message bubbles (`UserMessageBubble`, `AssistantMessageBubble`) via `attachmentDtosToDisplayAttachments`. There is no aggregated view of attachments per conversation.

Figma node `27:2566` (frame `sidebar_right`, 360 × 1080) shows the target panel:

- Header bar (48 px tall): one icon-button on the left (search), two on the right (download-all, close).
- Body: stacked sections "Uploaded Files", "Generated Files", "Sources".
- File tiles: 101 × 101 instances of the existing `attachment` component, laid out in a 3-column grid with 12 px gaps.
- Sources rows: link + 80 × 1-line description + copy icon-button. Links are not yet emitted by the backend, so this slice ships the section header and an empty placeholder only.

The user explicitly asked whether the panel shell should be reusable. Yes — a future "conversations list" panel and a future "conversation settings" panel will reuse the same chrome. The split below isolates that shell from the conversation-sources content.

## Goals / Non-Goals

**Goals:**

- Add a right-side panel that opens/closes via a header toggle button and renders the three sections from Figma node `27:2566`.
- Reuse the existing `AttachmentCard` from `libs/conversation-input` — no fork, no new attachment component.
- Keep the panel shell (`RightSidebarPanel`) generic so a future panel can swap content without changing the chrome.
- Derive Uploaded / Generated file lists from `messages` already in scope; no new API, no new context for files.
- Hooked-up close button; search and download-all wired to props but no-op in this slice.

**Non-Goals:**

- Searching attachments by filename — UI affordance only; behaviour is a follow-up.
- Bulk download as zip — UI affordance only; behaviour is a follow-up.
- Sources / link list rendering — header-only this slice; populated when the backend starts emitting link metadata.
- Persisting the open/close state across reloads.
- Mobile breakpoint behaviour for the panel — the existing app does not yet implement responsive shell rules; tracked separately.
- Drag-to-resize the panel.
- Any change to `libs/conversation-input`, `libs/conversation-messages`, or `libs/chat-shared`.

## Decisions

### 1 — Panel shell lives in a new lib `libs/sidebar`

The shell is pure layout chrome — `<aside>`, header bar with two action groups, scrollable body, divider on the inner edge. It has no knowledge of conversations, messages, routing, or i18n. The user has explicitly requested reuse on both sides of the viewport, which makes the lib boundary the right home: it forces a clean contract from day one, prevents app-level concerns (`useTranslation`, app context) from leaking in under a future deadline, and makes the shell consumable from external projects without this app's theme.

The lib follows the established pattern of `libs/conversation-input`:

- Package name `@epam/ai-dial-sidebar`, alias `@epam/ai-dial-sidebar` in `tsconfig.base.json`.
- Component lives in `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx`.
- Prop types in `libs/sidebar/src/models/SidebarPanel.ts`.
- SCSS module `SidebarPanel.module.scss` holds only CSS-variable references and hex fallbacks (per `openspec/lib-styling-guide.md`).
- All user-visible strings (panel `aria-label`, close button label) accepted as props — no `useTranslation`, no `react-i18next` imports.
- `colors?` and `typography?` props for theming overrides; values plumbed in via `buildCssVars` from `@epam/ai-dial-chat-shared`.
- Module-boundary tag `type:ui` (matches `conversation-input`); Nx eslint rules enforce no app imports.
- Peer deps: `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@tabler/icons-react`, `classnames`. No `react-i18next`, no app-level peer deps.

The setup cost is roughly the same as a single Nx React lib generation plus the SCSS-module + props boilerplate. The benefit is that `ConversationSourcesPanel` (this slice), a future left-side conversations panel, a future right-side settings panel, and any external consumer all use the same vetted shell with no fork. App-level orchestration (open/close context, mount points, content composition) stays in `apps/chat`.

**Alternative considered:** keep the shell in `apps/chat/src/components/SidebarPanel/` and promote later. Rejected because (a) the user has signalled reuse intent twice and the shell itself has no app coupling, (b) deferring promotion invites soft coupling (someone reaches for `useTranslation` "just for one label") that becomes painful to undo, and (c) the cost of doing it now is bounded — one Nx generator invocation plus the boilerplate already mirrored from `libs/conversation-input`.

### 2 — Open/close state + messages co-located in `SourcesSidebarContext`

Both the toggle button (in `Header`) and the panel mount point need to read and write the open state. Lifting into `app.tsx` would force a prop drill through `Header`. The project already has `ThemeContext`, `DeploymentsContext`, and `UserContext` as the established pattern for cross-component shared state — a single flat file per context.

Following the same convention, this slice ships `SourcesSidebarContext` — a single file at `apps/chat/src/context/SourcesSidebarContext.tsx`:

```ts
interface SourcesSidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
}
```

`messages` is co-located in the same context rather than a separate data context because:

1. The data and the open/close state are consumed together in `ConversationSourcesPanelView` — separating them adds complexity with no gain.
2. `ConversationPage` calls `setMessages(conversation.messages)` in a `useEffect` and `setMessages([])` on cleanup, keeping the context always in sync without the stale-data risk of lifted prop drilling.
3. The `ConversationSourcesPanelView` wrapper (in `components/ConversationSourcesPanel/`) isolates all context subscriptions from `App`, so the main layout tree does not re-render on streaming chunks.

The context is provided at the app root in `main.tsx` alongside `ThemeProvider`, `DeploymentsProvider` etc. A future left-side panel would follow the same pattern with its own flat context file.

### 3 — Panel mounts beside `<main>`, not inside it

Putting a panel inside `<main>` would force every route to know about the sidebars, and would require each panel to occupy flex space the routed content already claims. Mounting panels as siblings of `<main>` inside the existing root flex row keeps `main` unchanged and lets each sidebar take a fixed 360 px column when open. The right-side slot renders after `<main>`; a future left-side slot renders before `<main>` (and after `<Navigation>` if it stays).

```
<div class="flex size-full flex-row">
  <Navigation />
  {/* future: <LeftSidebarSlot />  — renders <SomeLeftPanel /> when open */}
  <main>{Header + Routes}</main>
  <RightSidebarSlot /> {/* renders <ConversationSourcesPanel /> when open */}
</div>
```

Each slot renders nothing when `isOpen === false`, so closed state has zero layout cost on either side.

### 4 — `SidebarPanel` is content-agnostic and side-agnostic

The shell is named `SidebarPanel` and takes a required `side: 'left' | 'right'` prop so the same component is the canonical chrome for both sides. Future panels reuse it without forking the shell. The component lives in `libs/sidebar` and exposes the same prop-shape pattern as `libs/conversation-input`: required functional props + optional `colors` / `typography` overrides, no i18n inside.

Props:

```ts
interface SidebarPanelProps {
  /** Which edge of the viewport the panel anchors to. Controls divider edge and close-button placement. */
  side: 'left' | 'right';
  /** Rendered on the left of the header bar (regardless of `side`). */
  leftActions?: ReactNode;
  /** Rendered on the right of the header bar (regardless of `side`). */
  rightActions?: ReactNode;
  /** Called when the user clicks the close button. */
  onClose: () => void;
  /** ARIA label for the panel region. Caller supplies the localised string. */
  ariaLabel: string;
  /** ARIA label and tooltip for the close button. Caller supplies the localised string. */
  closeLabel: string;
  /** Body content (sections). */
  children: ReactNode;
  /** CSS custom-property overrides for theming (background, border, header text). */
  colors?: SidebarPanelColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: SidebarPanelTypography;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

interface SidebarPanelColors {
  /** Panel background color. */
  background?: string;
  /** Divider color on the inner edge. */
  border?: string;
  /** Header bar bottom-border color. */
  headerBorder?: string;
}

interface SidebarPanelTypography {
  /** Optional font utility class applied to the panel root (takes priority over individual vars). */
  fontClassName?: string;
  /** Font family applied to the panel root. */
  fontFamily?: string;
  /** Font size applied to the panel root. */
  fontSize?: string;
}
```

What `side` controls (and only this):

- The divider edge: `side === 'right'` → `border-l border-secondary`; `side === 'left'` → `border-r border-secondary`.
- The DOM position of the built-in close `IconX` button. The shell appends it to whichever header-bar group sits on the **outer** edge: for `side: 'right'` the close icon goes into the right group (sticking to the viewport's right edge); for `side: 'left'` it goes into the left group (sticking to the viewport's left edge). This matches the universal "X near the edge users came from" convention.

What `side` does **not** control:

- `leftActions` / `rightActions` always mean header-bar positions — left vs right inside the header — independent of which side of the viewport the panel sits on. Callers compose the same way regardless of `side`.
- Width, height, body scroll, header-bar height — all identical for both sides.

The shell renders fixed chrome: 360 px width, full-height column, 48 px header bar, scrollable body. Section composition is the caller's responsibility.

### 5 — `ConversationSourcesPanel` is the only consumer in this slice

It assembles:

- `<SidebarPanel side="right">` as the shell.
- A search `GhostIconButton` (`IconSearch`) as `leftActions` — passes `onSearch` callback (no-op default).
- A download-all `GhostIconButton` (`IconDownload`) as `rightActions` — passes `onDownloadAll` callback (no-op default). The shell's built-in close button is appended after it (right edge).
- Two `FilesSection` components (uploaded, generated) and one `SourcesSection` in the body.

`UploadedFilesSection` and `GeneratedFilesSection` were merged into a single `FilesSection` component because they are structurally identical in this slice (same props, same layout, same `AttachmentCard` grid). If a future iteration requires divergent behaviour or visuals between uploaded and generated cards, the two-component structure can be re-introduced by splitting `FilesSection` back at that point.

It accepts `messages: Message[]` and derives the two file lists internally via `useConversationSources(messages)`.

### 6 — Files derived in `useConversationSources`, not pulled from a new API

`messages` already flows to `ConversationView` and contains `custom_content.attachments` for both roles. A small hook walks the array, partitions by `MessageRole`, maps each `MessageAttachment` to `DisplayAttachment` via the existing `attachmentDtosToDisplayAttachments` utility, and returns `{ uploaded, generated }` memoised on the messages reference.

This avoids adding a per-conversation files endpoint and avoids divergence between the inline tray and the sidebar — both render from the same source of truth.

### 7 — `AttachmentCard` is reused as-is, the grid layout lives in the section component

The existing card already supports image thumbnails, file icons, name + format label, and read-only mode (no `onRemove` / `onRetry`). It accepts a `className` for layout customisation. The sidebar section wraps cards in a CSS grid:

```tsx
<div role="list" className="grid grid-cols-3 gap-3">
  {attachments.map((att) => (
    <div key={att.id} role="listitem">
      <AttachmentCard attachment={att} className="w-full" />
    </div>
  ))}
</div>
```

Cards take the full grid-cell width and let their content drive the height — no fixed pixel height so different screen sizes, OS font scales, and longer filenames render without clipping.

No new card variant, no fork. If a future Figma iteration diverges from the existing card visuals, that becomes a separate change — and the wider impact on the input tray is the right place to evaluate it.

### 8 — Sources section ships header + empty state only

The backend does not emit link metadata yet. Hard-coding mock links would be misleading, and creating a new `Source` type before there is a server contract risks rework. The section renders its title and a localised "No sources available." line. When the backend exposes links, a follow-up change adds the data shape, the API derivation, and the row component.

### 9 — Toggle button placement in `Header`

The current `Header` is `min-h-[49px]`, centred logo only. The toggle goes at the right edge:

```
[ left spacer ] [ centred Logo ] [ right toggle button ]
```

It uses `GhostIconButton` with `IconFile` (matches Figma's "files & sources" affordance), `aria-pressed={isOpen}`, and an i18n tooltip. Header layout switches from flex-centre to a 3-column grid (`grid-cols-[1fr_auto_1fr]`) so the logo stays centred regardless of which side has buttons.

### 10 — `apps/chat` component conventions

Per `.claude/rules/apps.md`:

- Component prop interfaces are named `Props` (not `<Name>Props`).
- Components use `export default`.
- Folder structure: `apps/chat/src/components/<PascalCaseName>/<PascalCaseName>.tsx`, tests in `tests/`.

This change follows those conventions. The shell, the panel, and the section components each get their own folder.

## Risks / Trade-offs

- **`libs/sidebar` adds a new package that this slice over-invests in.** Mitigated by keeping the lib's surface minimal — one component, two prop interfaces, one SCSS module — and by reusing the generator and tooling already proven for `libs/conversation-input`. Boilerplate copy is bounded to ~30 minutes of one-time setup.
- **`side` prop adds branching that this slice never exercises.** Mitigated by keeping the branching to two places only — divider class and close-button placement — and asserting both branches in unit tests so the left-side path stays green even before a left-side consumer ships.
- **i18n strings now live in `apps/chat` while the shell labels them via props.** Mitigated by following the same pattern as `libs/conversation-input` (caller passes localised strings); the consuming `ConversationSourcesPanel` is the only translator, the shell stays decoupled.
- **Search and download-all visible but inert.** Could surprise users. Mitigated by writing the buttons disabled (`disabled` prop, `aria-disabled="true"`) until their handlers do something — the shell forwards the `disabled` flag to the buttons.
- **Sources section visible but always empty.** Mitigated by rendering an explicit "No sources available." placeholder so the section reads as a documented gap, not a bug.
- **Layout shift when the panel opens.** The 360 px column appears beside `<main>`, which already uses `flex-1` and absorbs the change cleanly. No changes to `<main>`'s internal layout are required.
- **`messages` may be empty (new conversation).** The hook returns `{ uploaded: [], generated: [] }`; both sections render an empty placeholder; the shell still opens and the search/download buttons are disabled. No special-case for empty conversations.
- **Re-deriving on every render.** `useConversationSources` memoises on the `messages` reference, which only changes when a new message arrives or attachments change — same cadence as the message list itself. No additional re-render cost.
