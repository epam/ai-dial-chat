# Santa History Delivery: MR verification

The accepted 27-second scene is prepared against current development in Chat
and Themes. Before MR creation, the user requested `happy new year` activation
instead of gift clicks and confirmed that the MRs have no linked issue.

## Final behavior

An operator-admitted `santa-history-delivery` joins only the compiled New Year
secret pool through `secretTrigger.externalSceneIds`. Existing secret scenes,
gift-click scenes, phrase matching and selection controls remain available.
Removing the allowlist entry removes only Santa. The notification no longer asks
the user to send the phrase that already triggered it.

The rejected chimney prototype, its adapter, Storybook entry and stale assets are
excluded. Shared protected geometry and poster helpers remain because the final
history/rope scene uses them. The Themes source is pinned at
`14477f5dea0541bafa0997f3d981f4fbea9eb805`; asset bytes are unchanged from the
accepted revision.

## Checks

- Celebrations Nx tests: 111 files, 2,394 passed, 16 existing skipped tests.
- Chat pack composition/labels: 40 passed. API manifest normalization: 45 passed.
- Celebrations Nx typecheck and lint pass; existing lint warnings remain.
- Documentation validation: 60 Markdown files pass. Spec reference validation:
  478 specs, zero errors (existing advisory warnings remain).
- Themes publication checker and authored-source checker: zero warnings.
  Validator tests: 287 passed. All five source assets match their pinned hashes.
- Branch i18n/theming scans report no candidates. No new dependency, application
  endpoint, generated client, environment file or local agent preference ships.

## Actual Chat browser checks

With fake user, conversation and model fixtures, the real Chat composer and
local API/Themes delivery were exercised at 1280×800 with history open and
collapsed, and at 390×844 on mobile. Gift clicks do not request Santa assets;
submitting `happy new year` selects Santa without a conversation/completion POST.
Desktop uses the native history or rope route. The constrained mobile layout
uses the safe poster. Escape leaves zero row copies, native SVGs or hidden rows,
and there are no page errors. The screenshots and compact JSON records beside
this document contain only test data.

The accepted native motion, viewport entrance/departure and performance evidence
is recorded in `tasks.md`. This MR preparation changes activation, documentation
and prototype cleanup; it does not change the accepted artwork or timelines.

## Release boundary

These changes deliver reusable runtime support and maintained source assets.
Ordinary-pack publication remains separate: complete the retained-version
prerequisite and remaining release matrix before preparing an immutable version
and switching catalog defaults. Existing published assets and defaults are intact.
