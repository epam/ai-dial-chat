## 1. Section extraction (behavior-preserving)

- [x] 1.1 Confirm the kit `Tabs` API via the ui-kit MCP (`getEntityDetails` for `Tabs` and its tab-item type) — tab item shape, `ariaLabel` support, and whether tab elements expose referenceable ids for `aria-labelledby`
- [x] 1.2 Extract the Details field list into `ScheduledTaskDetailsSection` (content only — no `<h2>`; keeps the description/model/repeats/active-window fields, label + typography + color props it needs) with a `tests/` spec covering its field rendering
- [x] 1.3 Extract the Configuration instructions block into `ScheduledTaskConfigurationSection` (instructions label, markdown via `renderInstructions` fallback to `MDMessageViewer`) with a `tests/` spec covering both rendering paths
- [x] 1.4 Extract the History card content into `ScheduledTaskHistorySection` (next-run label, run list with all loading/error/unread states, Show-more footer) with a `tests/` spec covering its states
- [x] 1.5 Re-compose the desktop three-column body from the three section components (columns keep their `<h2>`s and existing classes) and verify the existing `ScheduledTaskDetailView.spec.tsx` desktop suite is green — no visual change at desktop

## 2. Mobile/tab layout

- [x] 2.1 Add the optional `tabsAriaLabel` field to the detail-view labels model (English default `'Scheduled task sections'`), documented per the lib JSDoc rules
- [x] 2.2 Add the `useIsMobile` branch in `ScheduledTaskDetailView`: below desktop render the kit `Tabs` row (order Details → Configuration → History, labels from the existing title strings, no count badges) with internal active-tab state (default Details) held at the component level, plus the active section's panel with `role="tabpanel"` and an accessible name from the tab label
- [x] 2.3 Render the mobile History panel in standard top-to-bottom flow — no `max-h-[70vh]` inner container, no sticky title/footer, inline Show-more — while the desktop History card keeps its current container and sticky regions
- [x] 2.4 Verify in the browser at 360 / 768 / 900 / 1280 / 1920 px: tab row order and default tab, panel switching, History flow, desktop unchanged, no horizontal overflow at 360px (note exercised breakpoints for the PR)

## 3. Tests

- [x] 3.1 Add a separate `describe('Mobile/tablet tab layout')` block in `ScheduledTaskDetailView.spec.tsx` with `useIsMobile` mocked to `true`: tab row renders in order with Details active by default; activating a tab swaps the visible panel; no tab row at desktop (mocked `false`, covered by the existing suite); tabs carry no count badges; tablist and visible panel expose accessible names; History panel renders Show-more inline with no sticky regions
- [x] 3.2 Add a test that tab selection survives a breakpoint flip (mock returns `true` → `false` → `true` around a rerender)
- [x] 3.3 Run `npm exec nx test @epam/ai-dial-scheduled-tasks` and `npm exec nx lint @epam/ai-dial-scheduled-tasks`; fix any failures

## 4. Docs and verification

- [x] 4.1 Update `libs/scheduled-tasks/README.md` if the detail-view section documents the body layout or the new label field, and `ScheduledTaskDetailView`'s component JSDoc to state the breakpoint behavior; run `npm run validate:docs`
- [x] 4.2 Full non-mutating verification before completion: `npm run verify:full` (or the lean changed-slice pass during implementation and full once at the end)
