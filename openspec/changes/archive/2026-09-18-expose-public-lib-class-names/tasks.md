# Tasks

**Slicing strategy: vertical, one library per slice.** Each of slices 2–6 delivers a
complete, independently verifiable and independently revertable contract for one
library — constants file, stamps, guard tests, README — before the next library starts.
Slice order follows the issue's own P0 → P2 priority, so work can legitimately stop
after slice 3 with a coherent result. Slice 7 (the Tailwind preset) is last and shares
no file with slices 2–6, so a visual regression there reverts alone.

**Read before starting:** `AGENTS.md` §Library isolation, `openspec/lib-styling-guide.md`
(especially §Dead-style checks and §Class merging), and `.claude/rules/docs.md`.

**Conventions for every task below:**

- Relative TypeScript imports are extensionless (`./public-class-names`, not `.js`).
- Public class names are read from the library's constants record — never written as a
  string literal in a component file.
- Guard tests locate elements by role, label, or text and *then* assert the class; they
  never query by the public class itself, and they never add `data-testid`.
- The class is appended inside the element's existing `mergeClasses` call, after the
  CSS-module class and Tailwind utilities, before any caller-supplied `className`.
- Scope discipline: touch only what the task names. Anything else found goes to §9.

## 1. Shared groundwork

- [x] 1.1 Add the public-class convention section to `openspec/lib-styling-guide.md`:
      the `dial-<lib-prefix>-<element>[-<state>]` grammar, the prefix table
      (`sb`/`cp`/`cm`/`ci`/`ai`), flat kebab-case with additive state classes and why
      not BEM, the constants-record pattern, the rule that a public class carries no
      declarations, the rule that ARIA attributes are not styling hooks, and the
      stability promise (including that `libs/*` versions are pinned at `0.0.1` so the
      promise rests on tests and docs, not a version bump).
- [x] 1.2 In the same section, record the guard-test requirement and the
      locate-by-role-then-assert rule, cross-referencing §Dead-style checks as the
      precedent for why a silent styling failure needs a test.
  - Verification: `npm run validate:docs`

## 2. Composer classes — `libs/conversation-input` (P0)

- [x] 2.1 Create `libs/conversation-input/src/constants/public-class-names.ts` exporting
      `CONVERSATION_INPUT_CLASS` as an `as const` record with `wrapper`, `actionRow`,
      `textareaWrap`, `addCluster`, `footerActions`, `modelSelectorButton`, `modelMenu`,
      `modelMenuSearch`, `modelMenuItem`, `modelMenuItemSelected`. Add a file-header
      comment marking it public API.
- [x] 2.2 Re-export `CONVERSATION_INPUT_CLASS` from `libs/conversation-input/src/index.ts`,
      alongside the existing exports.
- [x] 2.3 Stamp `wrapper`, `actionRow`, `textareaWrap`, `addCluster`, and
      `footerActions` in `libs/conversation-input/src/components/Input/Input.tsx` — the
      root `<div>` carrying `styles.wrapper`, the action-row wrapper, the textarea-area
      wrapper, the add-button wrapper, and the trailing `ms-auto` cluster. Leave every
      existing Tailwind utility, `className`, and `inputClassName` behaviour untouched.
- [x] 2.4 Stamp `modelSelectorButton` on all three `styles.modelSelectorButton` sites in
      `libs/conversation-input/src/components/Input/ModelSelectorControl.tsx` (mobile
      `GhostIconButton`, `modelPickerOverlay` branch, default desktop branch).
- [x] 2.5 Add `libs/conversation-input/src/components/Input/tests/Input.classes.spec.tsx`
      asserting: each of the five composer classes on its element; `actionRow` absent
      when `hideActionBar` is `true`; `addCluster` absent when `hideAddButton` is `true`;
      a caller `className` still applied alongside `wrapper`; and
      `modelSelectorButton` present on both desktop and mobile viewports.
  - Verification: `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.classes.spec.tsx`
  - Regression: `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.layout.spec.tsx`
    and `npm run test:file -- libs/conversation-input/src/components/Input/tests/ModelSelectorControl.spec.tsx`
- [x] 2.6 Add the Public class names section to `libs/conversation-input/README.md`:
      the class/element table, the `CONVERSATION_INPUT_CLASS` import example, a
      migration table mapping each fragile selector from issue #8707 to its replacement,
      a link to `openspec/lib-styling-guide.md` for the convention, and a note that a
      host's own overrides must use CSS logical properties.
  - Verification: `npm run verify:changed` then `npm run validate:docs`

## 3. Attachment classes — `libs/attachment-input` (P0)

- [x] 3.1 Create `libs/attachment-input/src/constants/public-class-names.ts` exporting
      `ATTACHMENT_INPUT_CLASS` with `tray`, `trayItem`, `tile`, `tileSelected`,
      `tileName`, `tileType`, `tileAction`; re-export it from
      `libs/attachment-input/src/index.ts` next to `ATTACHMENT_COLLAPSE_THRESHOLD`.
- [x] 3.2 Stamp `tray` on the `role="list"` root and `trayItem` on each
      `role="listitem"` wrapper in
      `libs/attachment-input/src/components/AttachmentTray/AttachmentTray.tsx`. Keep the
      early `null` return for an empty list — an empty tray must emit nothing.
- [x] 3.3 Stamp `tile` and (when `isSelected`) `tileSelected` on the tile element in
      both `libs/attachment-input/src/components/AttachmentCard/Attachments/File.tsx`
      and `.../Image.tsx`. Leave `ATTACHMENT_TILE_BASE_CLASS` in
      `libs/attachment-input/src/constants/attachment-group.ts` unchanged — per design
      D5 it stays a pure Tailwind constant.
- [x] 3.4 Stamp `tileName` on the filename element and `tileType` on the type/size row
      in `File.tsx`, and the equivalent elements in `Image.tsx` where present.
- [x] 3.5 Stamp `tileAction` in
      `libs/attachment-input/src/components/AttachmentCard/Attachments/Actions.tsx` so
      download, retry, open-link, and remove all carry it. Keep the existing
      `group-hover/attachment-tile:opacity-100` and
      `group-focus-within/attachment-tile:opacity-100` utilities and every
      `aria-label` / `aria-describedby` exactly as they are.
- [x] 3.6 Add `libs/attachment-input/src/components/AttachmentTray/tests/AttachmentTray.classes.spec.tsx`
      asserting: one `tray` and exactly three `trayItem` for three attachments; nothing
      rendered for an empty list; `tile` on both an image and a non-previewable file
      tile; `tileSelected` present only when `isSelected`; `tileName` and `tileType`
      present; `tileAction` on both buttons of an error-state tile with retry and
      remove, with their ARIA attributes intact; and `tile` still present on a
      loading-state tile.
  - Verification: `npm run test:file -- libs/attachment-input/src/components/AttachmentTray/tests/AttachmentTray.classes.spec.tsx`
  - Regression: `npm run test:file -- libs/attachment-input/src/components/AttachmentTray/tests/AttachmentTray.spec.tsx`
    and `npm run test:file -- libs/attachment-input/src/components/AttachmentCard/tests/AttachmentCard.spec.tsx`
- [x] 3.7 Add the Public class names section to `libs/attachment-input/README.md`, with
      the same shape as 2.6 — including the explicit replacement for
      `[role='list'][aria-label='Attached files']` and a note that the `aria-label` is
      localisable and must not be used as a selector.
  - Verification: `npm run verify:changed` then `npm run validate:docs`

## 4. Model menu classes — `libs/conversation-input` (P1)

Depends on slice 2 (uses the same constants record).

- [x] 4.1 Append `modelMenu` to the `Dropdown` `listClassName` at both call sites in
      `libs/conversation-input/src/components/Input/ModelSelectorControl.tsx` (the
      `modelPickerOverlay` branch and the default desktop branch), preserving the
      existing `!w-[368px] !bg-layer-raised` and `!w-[240px]` values.
- [x] 4.2 Append `modelMenu` to the `BottomSheetShell` `className` in the mobile branch
      of the same file, so all three menu presentations carry it.
- [x] 4.3 Append `modelMenuSearch` to the sticky search-header `<div>` built in
      `libs/conversation-input/src/hooks/useModelSelector.tsx`, alongside the existing
      `searchHeaderClassName` option rather than replacing it.
- [x] 4.4 Set `className` on each deployment `DropdownItem` in the same hook:
      `modelMenuItem` always, plus `modelMenuItemSelected` when
      `item.id === selectedDeploymentId`. Confirm the `useMemo` dependency arrays for
      `menuItems` and `menuHeader` are unchanged, since the names are module-level
      constants.
- [x] 4.5 Extend `Input.classes.spec.tsx` (or add
      `libs/conversation-input/src/components/Input/tests/ModelSelectorControl.classes.spec.tsx`)
      asserting: `modelMenu` on the open desktop overlay and on the mobile sheet;
      `modelMenuSearch` on the search header for a populated, non-loading list;
      `modelMenuItem` on every row with `modelMenuItemSelected` on only the selected
      one; and that the loading-skeleton and empty/error single-row states still render
      without error.
  - Verification: `npm run test:file -- libs/conversation-input/src/components/Input/tests/ModelSelectorControl.classes.spec.tsx`
  - Regression: `npm run test:file -- libs/conversation-input/src/components/Input/tests/ModelSelectorControl.spec.tsx`
- [x] 4.6 Document the menu classes in `libs/conversation-input/README.md`, naming the
      three presentations `modelMenu` appears on, and stating that the selected row's
      check mark is drawn by `@epam/ai-dial-ui-kit` and has no class here — hosts
      descend from `dial-ci-model-menu-item-selected`.
  - Verification: `npm run verify:changed` then `npm run validate:docs`

## 5. Sidebar and panel classes — `libs/sidebar`, `libs/conversation-panel` (P2)

- [x] 5.1 Create `libs/sidebar/src/constants/public-class-names.ts` exporting
      `SIDEBAR_CLASS` with `aside` and `header`; re-export from
      `libs/sidebar/src/index.ts`.
- [x] 5.2 Stamp `aside` on the `<aside role="complementary">` in
      `libs/sidebar/src/components/SidebarPanel/SidebarPanel.tsx` and `header` on the
      root `<div>` of `libs/sidebar/src/components/Header/Header.tsx`. `Header` is
      `memo`-wrapped — add no prop.
- [x] 5.3 Create `libs/conversation-panel/src/constants/public-class-names.ts` exporting
      `CONVERSATION_PANEL_CLASS` with `newChatButton` and `search`; re-export from
      `libs/conversation-panel/src/index.ts`.
- [x] 5.4 Stamp `newChatButton` on the `<button>` in
      `libs/conversation-panel/src/components/NewChatButton/NewChatButton.tsx` and
      `search` on the `role="search"` wrapper in
      `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`.
- [x] 5.5 Add `libs/sidebar/src/components/SidebarPanel/tests/SidebarPanel.classes.spec.tsx`
      asserting `aside` on the element found by `getByRole('complementary')` and
      `header` on the rendered `Header` root.
  - Verification: `npm run test:file -- libs/sidebar/src/components/SidebarPanel/tests/SidebarPanel.classes.spec.tsx`
  - Regression: `npm run test:file -- libs/sidebar/src/components/SidebarPanel/tests/SidebarPanel.spec.tsx`
- [x] 5.6 Add `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.classes.spec.tsx`
      asserting exactly one `newChatButton` and one `search` element, both located by
      role first.
  - Verification: `npm run test:file -- libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.classes.spec.tsx`
  - Regression: `npm run test:file -- libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`
- [x] 5.7 Add the Public class names section to `libs/sidebar/README.md` and
      `libs/conversation-panel/README.md`, each with the migration mapping for the
      `[role='complementary'] > …` selectors from the issue.
  - Verification: `npm run verify:changed` then `npm run validate:docs`

## 6. Message bubble classes — `libs/conversation-messages` (P2)

- [x] 6.1 Create `libs/conversation-messages/src/constants/public-class-names.ts`
      exporting `CONVERSATION_MESSAGES_CLASS` with `userBubble` and `assistantContent`;
      re-export from `libs/conversation-messages/src/index.ts`.
- [x] 6.2 Stamp `userBubble` on the bubble `<div>` carrying `styles.userBubble` in
      `libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx`,
      and `assistantContent` on the `aria-live="polite"` content region in
      `AssistantMessageBubble.tsx`. Change no ARIA attribute.
- [x] 6.3 Add `libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.classes.spec.tsx`
      asserting `userBubble` on a user bubble with text, and `assistantContent` on the
      element carrying `aria-live="polite"` for an assistant message with text and for
      one that is still streaming.
  - Verification: `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.classes.spec.tsx`
  - Regression: `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx`
- [x] 6.4 Add the Public class names section to `libs/conversation-messages/README.md`,
      including that the fenced-code-block class requested in the issue is **not**
      provided — `MarkdownCodeBlock` lives in `libs/chat-shared` and is out of this
      change's scope — and that hosts descend from `dial-cm-assistant-content pre`.
  - Verification: `npm run verify:changed` then `npm run validate:docs`

## 7. Tailwind preset and host contract — BUILT, THEN REVERTED. NOT DELIVERED.

Independent of slices 2–6. Riskiest slice — it touches the config every project
inherits, so it lands last and is verified against unchanged CSS output.

> **Status: reverted before merge.** Every task below was completed and then undone
> by `f5c6ce8ea4` ("revert(libs): keep the Tailwind theme in the repo-root config"),
> so none of it is in `development`. There is no `libs/chat-shared/tailwind-preset.*`,
> no `./tailwind-preset` export, no host-setup chapter in
> `openspec/lib-styling-guide.md`, no Tailwind-pass subsection in
> `docs/architecture.md`, and no "Tailwind setup" section in any library README. The
> theme is still owned solely by the repo-root `tailwind.config.js`.
>
> The boxes stay ticked because they record work that was genuinely done; the heading
> and this note record that it does not ship. The consequence is deliberate and
> stated in the revert message: a host must still run Tailwind CSS 3 and scan each
> package's `dist`, but the token theme this repo builds against is not published, so
> the missing-utilities half of issue #8707 is **unanswered**. The public class names,
> the other half, are unaffected.
>
> Because nothing here shipped, the `lib-host-tailwind-contract` delta spec is **not**
> synced into `openspec/specs/` on archive. It is kept in this change as the record of
> the analysis, to be reused when the utilities question is decided.

- [x] 7.1 Move the theme from the repo-root `tailwind.config.js` into
      `libs/chat-shared/tailwind-preset.js` as a CommonJS module. It must contain no
      `require` or `import` of another workspace project, so `chat-shared` stays a
      `type:shared` library that imports nothing.
- [x] 7.2 Add the `./tailwind-preset` subpath export to
      `libs/chat-shared/package.json`, following the existing `./file-manager`,
      `./markdown`, and `./styles.css` subpath pattern.
- [x] 7.3 Rewrite the repo-root `tailwind.config.js` to re-export the moved preset,
      keeping its current path, its `content` globs, and its exported shape so every
      `presets: [require('../../tailwind.config.js')]` in `apps/*` and `libs/*` keeps
      working untouched.
- [x] 7.4 Verify the move is visually inert: build `apps/chat` and the five affected
      libraries and confirm the emitted CSS is byte-identical to the pre-change output
      (capture it before 7.1).
  - Verification: `npm run build:quiet` — bundling and CSS emission are directly
    affected by this slice
- [x] 7.5 Confirm `chat-shared` gained no dependency and no module-boundary violation.
  - Verification: `npm exec nx lint chat-shared`
- [x] 7.6 Add the host Tailwind contract section to `openspec/lib-styling-guide.md`: that
      Tailwind CSS 3 in the host is mandatory and why (the published `styles.css` carries
      no utility layer), the `./node_modules/@epam/ai-dial-<lib>/dist/**/*.js` content
      globs, the
      `presets: [require('@epam/ai-dial-chat-shared/tailwind-preset')]` line, the
      per-library `styles.css` import, and that omitting the globs fails **silently** —
      naming collapsed 84 px tiles and invisible hover-revealed action buttons as the
      observed symptoms. Reference the repo-root config as the worked example.
- [x] 7.7 Add the same setup snippet to the Installation section of all five affected
      library READMEs and to `libs/chat-shared/README.md` (which additionally documents
      the new `./tailwind-preset` export).
- [x] 7.8 Update `docs/architecture.md` §Styling: the host owns the Tailwind pass for
      library layout utilities, the preset is published as
      `@epam/ai-dial-chat-shared/tailwind-preset`, and the public-class tier now exists —
      as a summary with a link to `openspec/lib-styling-guide.md`, not a duplicate.
- [x] 7.9 Confirm no dependency or peer-dependency changed, so the install matrix is
      still accurate.
  - Verification: `npm run docs:install-matrix` must produce no diff; then
    `npm run validate:docs`

## 8. RTL, architecture guard, and close-out

- [x] 8.1 RTL check: confirm no public class name contains `left` or `right`, that the
      emitted class set is identical under `dir="rtl"` and `dir="ltr"`, and that no
      physical-direction Tailwind utility was introduced by any stamp — every touched
      element keeps its logical utilities (`ms-auto`, `ps-4`, `pe-2`, `end-1`,
      `text-start`). Add an RTL assertion to one composer and one attachment guard test.
  - Verification: `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.classes.spec.tsx`
    and `npm run test:file -- libs/attachment-input/src/components/AttachmentTray/tests/AttachmentTray.classes.spec.tsx`
- [x] 8.2 Architecture guard for all six touched libraries: confirm none gained a
      hardcoded `/api` path, generated API/client import, `server-api` import, app
      context, auth/session/cookie/env access, feature flag, routing or navigation
      knowledge, analytics/telemetry/logging client, deployment/tenant/provider detail,
      third-party SDK setup, platform bridge, or storage behaviour. Confirm no library
      reads `document`, host configuration, an environment variable, or a feature flag
      to decide which classes to emit, and that no `package.json` dependency or peer
      dependency was added.
  - Verification: `npm exec nx run-many -t lint -p conversation-input,attachment-input,sidebar,conversation-panel,conversation-messages,chat-shared`
- [x] 8.3 Confirm no public class name appears as a string literal in any component
      file — only in each library's `constants/public-class-names.ts` and in tests — and
      that every value exported by the five records is asserted by at least one test.
- [x] 8.4 Confirm no `.dial-sb-`, `.dial-cp-`, `.dial-cm-`, `.dial-ci-`, or `.dial-ai-`
      selector exists in any library's built `dist/index.css`; the classes must carry no
      declarations.
- [x] 8.5 Single full verification pass for the change.
  - Verification: `npm run verify:full`
- [ ] 8.6 Comment on [issue #8707](https://github.com/epam/ai-dial-chat/issues/8707) with
      the delivered class list, the selector-to-class migration table, the required host
      Tailwind setup, and the two corrections found during implementation: the selected
      row's check mark has no class here because `@epam/ai-dial-ui-kit` draws it, and
      `useModelSelector` never accepted `selectedItemClassName` /
      `selectedItemCheckClassName` — only `searchHeaderClassName`. Ask whether their
      stylesheet uses any selector outside the issue's inventory.

## 9. Follow-ups — do not implement in this change

- [x] 9.1 File a `epam/ai-dial-ui-kit` issue for `dial-kit-dropdown-icon`,
      `dial-kit-dropdown-icon-caret`, `dial-kit-dropdown-list`, `dial-kit-menuitem`, and
      a class on the `MenuItemMark.Check` indicator.
      **Delivered by the kit in `0.15.0-dev.7`**, which this repo already depends on:
      all four names ship, plus `dial-kit-menuitem-check` for the indicator, exported
      as `DIAL_KIT_CLASS`. `libs/conversation-input/README.md` points at
      `DIAL_KIT_CLASS.menuItemCheck` instead of the `svg` descendant it first suggested.
- [ ] 9.2 File a design request for the composer's desktop `flex-nowrap` action row
      (issue #8707's "ideal fix"), which needs design sign-off.
- [ ] 9.3 Fix the three `openspec/config.yaml` `rules` entries whose unquoted `": "`
      makes YAML parse them as maps, so OpenSpec silently drops **all** `proposal` and
      `tasks` rules for every change in this repo: `proposal[8]`, `tasks[4]`,
      `tasks[18]`. One-line fix, unrelated to this change.
- [x] 9.4 Extend `scripts/validate-docs.mjs` to cross-check that every `dial-*` class
      asserted in a library's tests is documented in that library's README and vice
      versa, making the contract CI-enforced rather than review-enforced.
      **Done**, with the source of truth changed from the tests to
      `src/constants/public-class-names.ts` — that record *is* the declared contract,
      whereas a test asserting a class is one step removed from it. The check runs both
      directions and is scoped to each lib's own prefixes, so a README may still cite
      `dial-kit-*`, a typography class, or a sibling lib's class.
- [x] 9.5 Consider a public class for `MarkdownCodeBlock` in `libs/chat-shared`
      (issue #8707's `dial-cm-code-block`), which sits outside the five libraries in
      this change. **Done in this change** — the stamping was widened from the five
      libraries to all 25, so `chat-shared` ships `dial-chat-shared-code-block` (plus
      `-code-block-header`, `-math-block`, `-table`, `-table-scroll`). The name follows
      the directory-name grammar rather than the issue's `dial-cm-code-block`, because
      the element lives in `chat-shared`, not `conversation-messages`.

## Notes on non-applicable conventions

No task introduces a user-visible string, so there is no `en.json` addition and no i18n
task. No task adds or changes an HTTP endpoint, DTO, generated-client operation, cache
entry, rate limit, or authorization rule, so the `apps/chat-api` and OpenAPI task
requirements in `openspec/config.yaml` do not apply. No feature flag is involved, so
there is no `ENABLED_FEATURES` wiring task. No new hook, utility, or service is created —
the new code is data (constants records) plus one-line stamps — so the unit-test
requirement is satisfied by the guard tests rather than by separate hook/utility specs.
