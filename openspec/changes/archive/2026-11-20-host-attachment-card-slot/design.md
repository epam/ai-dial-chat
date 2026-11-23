## Context

See proposal.md - Why. Today every consumer of an attachment card goes through one component, `libs/attachment-input/src/components/AttachmentCard/AttachmentCard.tsx`, which picks the image or file tile. Consumers are `AttachmentTray` (composer), `AttachmentGroup` (messages), `ProjectView`, `ProjectOutputs`, `ProjectCreateForm`, `FilesSection` and `StageItem` in `conversation-stages`. Each of the list consumers also hard-codes its own layout classes on the element holding the cards.

Constraints that shape the approach:

- Libs follow `.claude/rules/libs.md` and `openspec/lib-styling-guide.md`: no host knowledge, no i18n, colours through CSS variables and `styles` props, layout through Tailwind classes, public `dial-*` class names with no declarations.
- Libs pin each other to the exact release version, so one installed copy of `@epam/ai-dial-attachment-input` is the norm; a host that installs the libs from npm gets one copy.
- `mergeClasses` is `twMerge(classNames(...))`; a later conflicting utility wins.

## Goals / Non-Goals

**Goals:**

- A host replaces the attachment card for every list with one mount of one provider.
- A host changes the column layout of each list without a column-count API.
- A host that does nothing sees no change, and pays no more than one context read per card.

**Non-Goals:**

- A second built-in card or a variant prop.
- A headless hook that shares the built-in tile's accessibility logic with host cards (see Risks).
- Replacing `AttachmentTray`, `AttachmentGroup` or any list container; only the card is a slot, lists are tuned through class names.

## Decisions

### D1. The slot is a React context read inside `AttachmentCard`

`AttachmentCard` becomes a thin component that reads the provider's component and renders it, or `TileAttachmentCard` (the previous body, moved unchanged) when there is none. The context lives in `libs/attachment-input/src/context/AttachmentCardContext.tsx` next to the consumer, and exports `AttachmentCardProvider`, `AttachmentCardProviderProps` and an internal reader hook.

- Why a context and not props: the card is rendered inside other libs (`projects`, `source-panel`, `conversation-messages`, `conversation-stages`); a prop would have to cross four lib boundaries and every new consumer would have to remember it. The seam already exists at `AttachmentCard`.
- Why in `attachment-input`: it owns `AttachmentCardProps`, the contract a host component implements. The other libs already depend on it, so no new edge appears in the module graph and no lib gains a host-aware import.
- The context value is the component reference itself, not an object, so there is nothing to memoise and consumers re-render only when the host swaps the component.
- The reader hook returns `undefined` outside a provider instead of throwing. This departs from the usual "throw when used outside the provider" because the provider is optional by design: every host and every existing test renders cards without one. `CitationCardContext` in `libs/quotations` throws because its provider is mandatory.
- Alternatives: a `renderCard` prop on each consumer (rejected: seven props in five libs, silently ignored by a new consumer); a `variant` prop with a built-in row card (rejected: ships both looks to every host, see proposal); CSS-only overrides through `dial-ai-attachment-tile*` (rejected: cannot change the card's structure).

### D2. `AttachmentCard` adds nothing around the host component

The host's component is rendered as returned, with all props forwarded. The lib does not add a wrapper, `role`, class or attribute.

- Why: any wrapper would be a second layout box the host has to work around, and a lib-supplied role could clash with the host's own button semantics. The cost is that accessibility is the host's job (see Risks).
- The existing outer wrappers stay where they are in the lists (`role="listitem"` elements in `AttachmentGroup` and `AttachmentTray`, `li` in the projects lists), so list semantics are unchanged.

### D3. Layout is a class-name hook, merged last, per list

Each list consumer gets one optional string, merged as the last argument of the `mergeClasses` call that already builds the list's classes. The names follow what each component already calls things: `styles.listClassName` (`AttachmentGroup`, `ProjectOutputs`), `styles.contextListClassName` (`ProjectView`, `ProjectCreateForm`), `listClassName` on `FilesSection` with `styles.filesListClassName` on `ConversationSourcesPanel` (which owns two sections), and `styles.attachmentGroupStyles` on message bubbles.

- Why class names and not a column count: columns are a design decision (2, 3 or 4 depending on the screen) and a numeric prop would need breakpoints, gaps and min widths too. A class string covers all of them and uses the mechanism the libs already offer (`className`, `bodyClassName`).
- Why merged last: `twMerge` drops the default utility that conflicts, so `'grid grid-cols-3'` replaces `flex`, and `'grid-cols-3'` replaces the arbitrary 5-column template. A non-conflicting default such as `flex-wrap` stays and is inert on a grid.
- Message bubbles take a typed `AttachmentGroupStyles` rather than two flat strings, per the "wrapper forwards inner styles as a typed field" rule in `.claude/rules/libs.md`. The user bubble merges the host's `className` after its own `max-w-[640px]`, otherwise the group could never be wider than 640 px.
- The host's Tailwind build must see the class strings. The libs ship only the utilities they use themselves, so a host writes the class names in its own source (pg-chat: a constants module), which its Tailwind scans.

### D4. No change for hosts that do nothing

The default path differs from today by one `useContext` per card. The tile's JSX is not edited; the file is renamed to `TileAttachmentCard.tsx` and its exported symbol renamed, so its history is a move plus one identifier. The existing suites run unmodified and are the regression guard. ai-dial-chat (`apps/chat`) mounts no provider and passes none of the options.

## Risks / Trade-offs

- **Two copies of `attachment-input` in a host's tree** → a provider imported by the host would not reach cards rendered by another lib. Mitigation: libs pin the exact version, the README states the single-copy requirement, and the spec requires it to be documented.
- **Unstable component reference** (an inline component created each render) → the host card remounts on every render. Mitigation: documented in the README and spec; a module-level or `memo` component is the norm.
- **Host cards must re-implement accessibility** (overlay button, `aria-pressed`, upload progress, error announcement) that the built-in tile gets right. → Mitigation: the proposal's non-goal records it; if hosts duplicate the same logic, extract a headless hook from `TileAttachmentCard` without changing its DOM. Exported helpers (`getAttachmentCardState`, `getNameWithoutExtension`, `useLazyImageLoad`) already let a host card reuse the derivation.
- **A provider at a host's root also replaces cards in the composer and in `conversation-stages`**, which the host may not have designed. → The host scopes the provider to a subtree, and the spec makes the nearest provider win so it can restore the built-in tile for a subtree.
- **A host card has no column in a flex-wrap list** (it sizes to its content). → Lists remain the host's to configure through the class-name hooks; the host's own layout constants own the widths.
- **Public API grows in four published libs.** → All additions are optional and documented; `npm run validate:docs` checks the READMEs against the public exports.

## Migration Plan

1. Land the change in ai-dial-chat (no behaviour change for `apps/chat`).
2. Publish a dev release of `attachment-input`, `projects`, `source-panel` and `conversation-messages` through the existing publish flow.
3. A host bumps the four `@epam/ai-dial-*` versions in one commit, mounts `AttachmentCardProvider` with its card and sets the class names. Until then the host sees the built-in tile.
4. Rollback: revert the host's provider and class names (the host returns to the built-in tile and default layouts); the libs can stay, because nothing depends on the options being used.

## Open Questions

- Whether to extract the tile's accessibility logic into a shared headless hook once a second host card exists. Deferrable: it would not change the slot contract or the specs.
