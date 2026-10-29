---
name: ui-kit-review
description: Review a diff or pull request for @epam/ai-dial-ui-kit adoption — hand-rolled markup the kit already provides (ErrorText, CaptionText, StateScreen, Notification, LinkButton, Dropdown, Spinner, …), legacy Dial* components, ErrorText/CaptionText a11y wiring, icon stroke, and typography that does not come from the kit dial-*-text scale (raw Tailwind sizes, font CSS, unknown classes). Use when reviewing an MR/PR or local changes for UI kit usage, or as the UI-kit pass of code-review-and-quality.
---

# UI kit review

Find the places in a change where code re-implements something
`@epam/ai-dial-ui-kit` already ships, or uses the kit in a way the installed
version no longer supports. Report verified findings only — a regex hit is a
candidate, not a finding.

## Inputs

| Mode         | Diff source                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| Local        | uncommitted changes (`git diff HEAD`) — the default                          |
| Branch       | the branch against its base, `--base origin/development`                     |
| Pull request | only when the user gives a PR number or URL — `--pr <n>` (uses the `gh` CLI) |

Review comments on GitHub are written in English, and are posted only when
the user explicitly asks; otherwise the report goes to the chat.

## Workflow

1. **Collect candidates.** Run the scanner over the added lines:

   ```sh
   node .claude/skills/ui-kit-review/scan-diff.mjs [--base <ref> | --pr <n>]
   ```

   It groups hits by signal (table below) and flags any `dial-*-text` class
   that the installed kit CSS does not define. It only reads added lines in
   `apps/*/src` and `libs/*/src`; it never decides anything.

2. **Pin the kit version.** Read `@epam/ai-dial-ui-kit` in the root
   `package.json`, and skim the matching section of
   `node_modules/@epam/ai-dial-ui-kit/dist/CHANGELOG.md` for behaviour the
   diff relies on (a dev version `x.y.z-dev.N` maps to release `x.y.z`).

3. **Verify every candidate.** Read the surrounding code, then confirm the
   replacement with the `ai-dial-ui-kit` MCP tools (`getEntityDetails`,
   `searchEntity`) — never grep the kit. A replacement counts only when the kit
   component keeps the behaviour, the theming hooks and the a11y semantics of
   the hand-rolled code. If it cannot, it is a kit gap, not a finding.

4. **Report** with the format below.

## Signals and what to check

| Signal                  | Usually means                                                         | Before flagging, check                                                                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error-text-markup`     | `dial-tiny-text text-error` span/p → `ErrorText`                      | 14px+ screen-level messages (`dial-small-text`) are not field errors — consider `ErrorMessageNotification` instead                                                                                                                                                                                      |
| `caption-text-markup`   | `dial-tiny-text text-secondary` → `CaptionText`                       | a `*ClassName` prop default in a lib is API, not markup; `CaptionText` merges classes, a prop that replaced them changes behaviour                                                                                                                                                                      |
| `error-text-wiring`     | `ErrorText`/`CaptionText` has **no live-region role** since kit 0.16  | field error: `id` + the control's `aria-describedby` + `aria-invalid` (2.0 `Input`/`Textarea`/`Select` do it through their own `error`/`caption`/`ariaDescribedBy`); submit failure: `announce={LiveRegionPoliteness.Assertive}` (kit 0.16.0-dev.55+) — the scanner skips a tag that carries `announce` |
| `live-region`           | `role="alert"`/`aria-live` added                                      | it must be mounted **before** its text appears; a region rendered together with the message is not read reliably                                                                                                                                                                                        |
| `alert-role-assumption` | a test queries `getByRole('alert')`                                   | if it targets an `ErrorText`, it passes only through a kit mock — the real component has no role                                                                                                                                                                                                        |
| `legacy-dial-component` | 1.0 `Dial*` component                                                 | MCP "Use instead"; `DialPagination`, `DialFileName`, `DialInputPopup` and the file-manager package have no 2.0 replacement                                                                                                                                                                              |
| `raw-control`           | raw `<button>`/`<select>`/`<textarea>`/checkbox/radio/`<mark>`        | underline link → `LinkButton`; styled button → `Button`/`IconButton`; deliberately unstyled rows, drop targets and full-row overlays are fine; search matches → `Highlight`; an on/off `aria-pressed` chip → `ToggleChip`                                                                               |
| `hand-rolled-popover`   | document `pointerdown`/`keydown`, `getBoundingClientRect` positioning | `Dropdown` with `renderOverlay` gives positioning, collision, outside press, Escape and focus return; a non-menu panel takes `overlayRole` (`DropdownOverlayRole.Dialog` / `None`); selection-anchored UI cannot use it                                                                                 |
| `state-screen-layout`   | centred icon + heading + text + button                                | `StateScreen` renders an `h1` in a `section` — only for a whole screen; inside a panel use `ErrorMessageNotification` or `NoDataContent`                                                                                                                                                                |
| `notification-markup`   | sunken rounded box with an alert glyph                                | `Notification` / `*MessageNotification`; warning and error variants default to `role="alert"` — pass `role="status"` for state that must not interrupt; a neutral sunken banner → `surface={NotificationSurface.Neutral}`                                                                               |
| `widget-role`           | custom tabs, tooltip, switch, progress, dialog, menu                  | the matching kit component, unless the role describes content the kit does not draw                                                                                                                                                                                                                     |
| `inline-width-bar`      | track/fill bar                                                        | `ProgressBar`; a capacity or quota gauge → `role={ProgressBarRole.Meter}`                                                                                                                                                                                                                               |
| `loading-placeholder`   | `animate-spin` / `animate-pulse`                                      | `Spinner` / `Skeleton`                                                                                                                                                                                                                                                                                  |
| `icon-stroke`           | Tabler icon without `stroke={DIAL_KIT_ICON_STROKE}`                   | filled glyphs and 48px+ empty-state art are exempt; multi-line JSX is not scanned, so read the props                                                                                                                                                                                                    |
| `unknown-typography`    | a `dial-*-text` class the kit CSS lacks — it renders unstyled         | lib-owned public class names (`dial-ci-*`, …) are not typography; otherwise look the name up with `getEntityDetails("typography")`                                                                                                                                                                      |

## Typography: the kit scale only

Every font size, weight, line height and letter spacing comes from a kit
`dial-*-text` class — in JSX, in a lib's `*ClassName` default, and in every
value an app passes to a lib. Look the name up with
`getEntityDetails("typography")`; never write one from memory.

| Signal                     | Flags                                                                                                                                         | Fix / exemption                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom-typography-class`  | `text-xs`…`text-9xl`, `text-[13px]`, `font-semibold`/`font-bold`/…, `font-mono`/`font-serif`/`font-sans`, `leading-*`, `tracking-*` in TS/TSX | the matching `dial-*-text` class — `font-mono` → `dial-code-text`, serif formula symbols → `dial-*-italic-text`; a raw utility carries no line height from the scale. Colour/alignment `text-*` pass |
| `custom-typography-style`  | `fontSize` / `lineHeight` / `fontWeight` / `fontFamily` / `letterSpacing` with a value (a `*Typography` interface field is skipped)           | a class; the only exception is the caller-driven CSS-var channel (`.claude/rules/libs.md`) for surfaces that cannot take a class                                                                     |
| `custom-typography-css`    | `font-size`, `line-height`, `font-weight`, `font-family`, `letter-spacing`, `font` declared in `.scss`/`.css`                                 | move it to a class (a monospace block → `dial-code-text`); only `em`-relative sizing of a `::before`/`::after` glyph may stay, with a comment saying why                                             |
| `redefined-kit-typography` | a local `.dial-*-text { … }` rule                                                                                                             | delete it — it shadows the kit and drifts on the next upgrade; a missing step is a gap to raise in the kit                                                                                           |
| `typography-important`     | `!important` on a typography property                                                                                                         | delete it — it silently beats the class the caller passed                                                                                                                                            |
| `lead-text-double-case`    | `uppercase`, `tracking-*` or `.toUpperCase()` next to a `*-lead-*` class                                                                      | drop them: `*-lead-*` classes uppercase and track themselves, and a pre-uppercased string is spelled out by screen readers                                                                           |
| `unknown-typography`       | a `dial-*-text` the installed kit CSS lacks                                                                                                   | see the table above                                                                                                                                                                                  |

Declarations that read `var(--…)` are skipped by the scanner: they are the
CSS-var channel, which is allowed only when the lib also exposes a
`*ClassName` prop defaulting to a scale class — check that by hand.

Also look, without a scanner signal, for:

- the same helper or hook copied into several libs — it belongs in
  `@epam/ai-dial-chat-shared` (for example `useControlErrorAssociation`, which
  links an error to a control that takes no `aria-describedby`);
- a hardcoded English string passed to a kit prop — apps use `t()`, libs
  expose a prop with an English default;
- a code comment that justifies avoiding a kit component with behaviour the
  installed kit no longer has (the "CaptionText renders `role="alert"`"
  comment survived the 0.16 change).

## Known kit gaps — report as gaps, not as defects

Confirm each still holds in the installed version before repeating it.

- The kit type scale has no display step above `dial-display1-text` (32/48),
  so a hero heading (the 404 page) keeps host-side sizing until design adds one.
- `Notification`'s own close button has a fixed English name — pass a
  lib-owned `CloseButton` instead of `closable`.
- `MarkdownEditor` and `Calendar` take no `aria-describedby`/`aria-invalid` —
  bridge with `useControlErrorAssociation` from `@epam/ai-dial-chat-shared`.

## Report format

Group verified findings by severity, most severe first:

- **Must fix** — a11y regressions (an error nobody announces or links), a
  `dial-*-text` class that does not exist, custom typography outside the kit
  scale, a legacy component with a drop-in 2.0 replacement.
- **Should fix** — hand-rolled markup with a kit component that preserves
  behaviour.
- **Kit gap** — what the kit would need; suggest raising it in the kit repo.

Each finding: `path:line`, what is hand-rolled or wrong, the kit replacement
(with the props that matter), and anything that changes visually. End with
the candidates you rejected and why, in one line each, so the author can see
they were considered.
