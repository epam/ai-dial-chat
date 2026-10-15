# Proposal: fix scheduled-task long-text rendering (card grid + detail view)

## Problem

Long text broke both surfaces that render a scheduled task's metadata:

- **Card grid** (`ScheduledTaskCard`): a description value too long to break at a space (a long URL and the like) stretched the card past its grid track, and the description's line clamp was unspecified against the spec (which claimed four lines).
- **Detail view** (`ScheduledTaskDetailView`): the header title ran from the back button to the action buttons (a long title pushed the actions out, because `truncate` could not engage without `min-w-0`); the Details description and both skill-name rows used `break-all`, which chops ordinary words mid-word at every column edge; and the Instructions silently rendered at the markdown viewer's 16px/26px default while every other value in the view sat at 14px.

## Solution

All fixes are prop-scoped inside `libs/scheduled-tasks` (no shared-surface changes):

- Card: `min-w-0` + `[overflow-wrap:anywhere]` on the description so unbreakable tokens wrap inside the card instead of stretching its grid track; clamp contract fixed to three lines desktop / two below.
- Detail view header: title carries `min-w-0 max-w-[600px]` on both copies (desktop header and mobile/tablet row) and renders its text through the kit's `EllipsisTooltip` — ellipsis plus a tooltip that appears only when actually clipped, with the full name kept as the accessible name.
- Details description: `whitespace-pre-wrap [overflow-wrap:anywhere]` (words wrap whole; only a token that cannot fit a line breaks) at the 14px/20px field step, with its own ink chained through `--text-primary` (dark-theme safe; `#1b212d` last-resort fallback) overridable via `styles.colors.descriptionText`.
- Instructions: a lib-scoped `MarkdownRendererClassNames` record spread from `COMPACT_MARKDOWN_CLASS_NAMES` with `ul`/`ol` carrying the prose step, passed through the viewer's existing `classNames` prop — the shared presets are untouched, so chat messages, attachment canvas, and quotations render exactly as before.
- Both skill-name rows: `break-all` → `[overflow-wrap:anywhere]`.

## Non-goals

- A dynamic title/description line pool for the card (the design's 1+3/2+2/3+1 model) — deliberately deferred; the fixed 1+3 contract stands.
- Changing list typography in any non-scheduled-task markdown consumer.
- New user-visible strings or i18n keys (none introduced).

## Acceptance criteria

- `nx test @epam/ai-dial-scheduled-tasks` and `nx test @epam/ai-dial-chat-shared` pass (335 and 605 tests), including the new assertions for the clamp classes, the title tooltip wiring, the overflow-wrap mechanism (and `break-all`'s absence), the scoped instructions record, and the `--stdv-description-text` override channel.
- `npm run validate:specs`, `validate:docs`, and `nx lint @epam/ai-dial-scheduled-tasks` pass.
- No file outside `libs/scheduled-tasks` (plus its spec/README) changed behavior.

## Alternatives considered

Fixing list-item typography by adding the paragraph step to the shared `DEFAULT`/`COMPACT_MARKDOWN_CLASS_NAMES` presets — rejected: every markdown surface consumes those presets, so a scheduled-task fix would reflow chat messages, attachment canvas, and quotations; the scoped record achieves the same result with zero blast radius. (A hardcoded `#1b212d` ink was also rejected mid-review in favor of the theme-token chain — a literal that ignores dark mode renders near-black on dark.)

## Rollback / backward compatibility

**Breaking for external hosts:** `ScheduledTaskCardTypography.descriptionSizeClassName` is removed. It was a duplicate of `descriptionClassName` on the same element (CSS source order silently decided the winner); it had no in-repo caller and the README was updated in the same change, but a host that still passes it gets a TypeScript error against the new types — migrate by moving the class to `descriptionClassName`. Everything else is additive class-level behavior inside the lib's own components, and every override channel is an optional prop. Revert = revert the commit.

## Scope-creep flag

Touches `libs/scheduled-tasks` only; host integration knowledge stays outside — every override arrives as a prop (`styles.typography`, `styles.colors`) or a kit/shared constant passed through existing props, per `AGENTS.md` §Library isolation. Closest existing models: the card's existing `styles.typography` fields and the `--stdv-subtitle-text` cascade in `ScheduledTaskDetailsSection.module.scss`.

## i18n impact

None — no new user-visible strings; the EllipsisTooltip exposes the existing `displayName`.
