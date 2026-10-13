# Design — scheduler panel fonts & sections (#9047)

## Typography map (design specs → kit classes)

| Element | Class |
| --- | --- |
| Section headings (accordion titles + files/sources `<h2>`) | `dial-tiny-semi-text` (12/16/600) |
| History run row — viewed | `dial-small-paragraph-text` (14/24/400) |
| History run row — not viewed (bold) | `dial-small-paragraph-semi-text` (14/24/600) |
| Details field labels | `dial-tiny-text text-secondary` (#57647A) |
| Details field values + Instructions markdown text | `dial-small-text` (14/20/400) |
| File cards | unchanged — `dial-caption-text` (10px) |

## Key decisions

- **D1 — Accordion title strut.** The kit `Accordion` hardcodes its title span at `dial-body-text` (line-height 24); a nested inline span can never shrink the line box below the parent's strut. Titles therefore render as `dial-tiny-semi-text block truncate py-1`: `block` escapes the strut so the 12/16 line-height applies; `py-1` grows the element to the design's 24px title height. `contentClassName="ps-3"` narrows the History content's start inset to 12px — verified against the compiled stylesheet: Tailwind generates `.ps-3` after `.px-4`, so it wins the kit's hardcoded start padding.
- **D2 — Run-row metrics.** Status icons: left of the timestamp, 19px (3px above the SM token step; no kit token sits there), stroke 2 (Tabler-native; heavier than the `DIAL_KIT_ICON_STROKE` 1.5 scale because the 1.5 outline read thin at 16px beside 14px text — a design-approved, comment-documented exception). Pill padding `px-3` (Figma `Spacing-03` = 12px). Unread dot in a fixed 12px slot at the row end. The former `.rowLayout` SCSS start-padding override (0 / 20px ≥1280px) is deleted — it fought the symmetric utility.
- **D3 — Unread timestamp channel.** `ScheduledTaskRunHistoryList` gains `typography.runTimestampUnreadClassName` (default `dial-small-paragraph-semi-text`), threaded through `ScheduledTaskHistorySection` with a default on its own 14/20 scale (`dial-small-semi-text`) so the detail page's mixed rows keep one line height.
- **D4 — Lib defaults stay host-neutral.** `source-panel`'s section indent moves behind `styles.sectionClassName` (default none); the chat app passes `px-4` (accordion-gutter alignment). `ScheduledTaskDetailsSummary`'s label/value defaults DO change (tiny+secondary / small) — its only in-repo consumer is this panel.
- **D5 — Props, not context, inside memoized sections.** `TaskHistorySection` / `TaskDetailsSection` own their accordion + reset state and take their data slices as props from the container. A memo'd section reading plain-function context mocks never re-renders in tests, so the reset-on-`scheduleId` behavior is untestable that way; the container-as-single-consumer shape is also the lower-coupling one.
- **D6 — No Process section.** The DIAL Scheduler writes no per-stage data for scheduled runs (`ScheduledTaskRunDto` carries only status/start/end/conversation_id/result.stage), so the mockup's stepper has no data source. Dropped from scope; do not re-add without a Scheduler contract change.

## RTL

All new utilities are logical (`ps-3`, `px-3`) or symmetric (`py-1`); layout flips with `dir` automatically. No directional icons were introduced.
